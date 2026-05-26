import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  User, Car, CarFees, CarStageLog, RequestClient, Customer,
  EditRequest, ChangeLog, Notification, CarStage,
} from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase: SupabaseClient

function getClient(): SupabaseClient {
  if (!supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabase
}

// --- Users ---
export async function getUsers(): Promise<User[]> {
  const { data } = await getClient().from('users').select('*').order('created_at', { ascending: false })
  return (data as User[]) || []
}

export async function getUser(id: string): Promise<User | null> {
  const { data } = await getClient().from('users').select('*').eq('id', id).single()
  return data as User | null
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { data } = await getClient().from('users').select('*').eq('username', username).maybeSingle()
  return data as User | null
}

export async function createUser(payload: Partial<User>): Promise<User> {
  const { data } = await getClient().from('users').insert(payload).select().single()
  return data as User
}

export async function updateUser(id: string, payload: Partial<User>): Promise<User> {
  const { data } = await getClient().from('users').update(payload).eq('id', id).select().single()
  return data as User
}

export async function deleteUser(id: string): Promise<void> {
  await getClient().from('users').delete().eq('id', id)
}

// --- Cars ---
export async function getCars(filter?: { stage?: CarStage; search?: string }): Promise<Car[]> {
  let q = getClient().from('cars').select('*').order('created_at', { ascending: false })
  if (filter?.stage) q = q.eq('current_stage', filter.stage)
  if (filter?.search) {
    q = q.or(`name.ilike.%${filter.search}%,serial_number.ilike.%${filter.search}%,license_plate.ilike.%${filter.search}%,seller_phone.ilike.%${filter.search}%`)
  }
  const { data } = await q
  return (data as Car[]) || []
}

export async function getCar(id: string): Promise<Car | null> {
  const { data } = await getClient().from('cars').select('*').eq('id', id).single()
  return data as Car | null
}

export async function createCar(payload: Partial<Car>): Promise<Car> {
  const { data } = await getClient().from('cars').insert(payload).select().single()
  return data as Car
}

export async function updateCar(id: string, payload: Partial<Car>): Promise<Car> {
  const { data } = await getClient().from('cars').update(payload).eq('id', id).select().single()
  return data as Car
}

export async function deleteCar(id: string): Promise<void> {
  await getClient().from('cars').delete().eq('id', id)
}

// --- Fees ---
export async function getCarFees(carId: string): Promise<CarFees | null> {
  const { data } = await getClient().from('car_fees').select('*').eq('car_id', carId).maybeSingle()
  return data as CarFees | null
}

export async function upsertCarFees(payload: Partial<CarFees>): Promise<CarFees> {
  const { data } = await getClient().from('car_fees').upsert(payload, { onConflict: 'car_id' }).select().single()
  return data as CarFees
}

// --- Stage Logs ---
export async function getStageLogs(carId: string): Promise<CarStageLog[]> {
  const { data } = await getClient().from('car_stage_logs').select('*').eq('car_id', carId).order('created_at', { ascending: true })
  return (data as CarStageLog[]) || []
}

export async function createStageLog(payload: Partial<CarStageLog>): Promise<CarStageLog> {
  const { data } = await getClient().from('car_stage_logs').insert(payload).select().single()
  return data as CarStageLog
}

export async function moveToStage(carId: string, stage: CarStage, evidenceUrl: string | null, notes: string, userId: string): Promise<void> {
  await createStageLog({ car_id: carId, stage, evidence_url: evidenceUrl, notes, moved_by: userId })
  await updateCar(carId, { current_stage: stage, updated_by: userId })
}

// --- Request Clients ---
export async function getRequestClient(carId: string): Promise<RequestClient | null> {
  const { data } = await getClient().from('request_clients').select('*').eq('car_id', carId).maybeSingle()
  return data as RequestClient | null
}

export async function upsertRequestClient(payload: Partial<RequestClient>): Promise<RequestClient> {
  const { data } = await getClient().from('request_clients').upsert(payload, { onConflict: 'car_id' }).select().single()
  return data as RequestClient
}

// --- Customers ---
export async function getCustomer(carId: string): Promise<Customer | null> {
  const { data } = await getClient().from('customers').select('*').eq('car_id', carId).maybeSingle()
  return data as Customer | null
}

export async function upsertCustomer(payload: Partial<Customer>): Promise<Customer> {
  const { data } = await getClient().from('customers').upsert(payload, { onConflict: 'car_id' }).select().single()
  return data as Customer
}

// --- Edit Requests ---
export async function getEditRequests(carId?: string): Promise<EditRequest[]> {
  let q = getClient().from('edit_requests').select('*, requested_by:users!edit_requests_requested_by_fkey(id,username,full_name), reviewed_by:users!edit_requests_reviewed_by_fkey(id,username,full_name)').order('created_at', { ascending: false })
  if (carId) q = q.eq('car_id', carId)
  const { data } = await q
  return (data as any) || []
}

export async function createEditRequest(payload: Partial<EditRequest>): Promise<EditRequest> {
  const { data } = await getClient().from('edit_requests').insert(payload).select().single()
  return data as EditRequest
}

export async function reviewEditRequest(id: string, status: 'approved' | 'rejected', reviewedBy: string, reviewNotes?: string): Promise<EditRequest> {
  const { data } = await getClient().from('edit_requests').update({
    status, reviewed_by: reviewedBy, review_notes: reviewNotes, reviewed_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  return data as EditRequest
}

// --- Change Log ---
export async function getChangeLogs(limit = 50): Promise<ChangeLog[]> {
  const { data } = await getClient().from('change_log').select('*').order('timestamp', { ascending: false }).limit(limit)
  return (data as ChangeLog[]) || []
}

export async function createChangeLog(payload: Partial<ChangeLog>): Promise<ChangeLog> {
  const { data } = await getClient().from('change_log').insert(payload).select().single()
  return data as ChangeLog
}

// --- Notifications ---
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data } = await getClient().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  return (data as Notification[]) || []
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await getClient().from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
  return count || 0
}

export async function markNotificationRead(id: string): Promise<void> {
  await getClient().from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await getClient().from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
}

export async function createNotification(payload: Partial<Notification>): Promise<Notification> {
  const { data } = await getClient().from('notifications').insert(payload).select().single()
  return data as Notification
}

// --- Bulk Import ---
export async function bulkInsertCars(cars: Partial<Car>[]): Promise<void> {
  await getClient().from('cars').insert(cars)
}

export async function bulkInsertCustomers(customers: Partial<Customer>[]): Promise<void> {
  await getClient().from('customers').insert(customers)
}
