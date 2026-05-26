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

function handleError(msg: string, err: unknown): never {
  const detail = (err as any)?.message || (err as any)?.error?.message || String(err)
  throw new Error(`${msg}: ${detail}`)
}

// --- Users ---
export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await getClient().from('users').select('*').order('created_at', { ascending: false })
    if (error) return []
    return (data as User[]) || []
  } catch { return [] }
}

export async function getUser(id: string): Promise<User | null> {
  try {
    const { data, error } = await getClient().from('users').select('*').eq('id', id).single()
    if (error) return null
    return data as User | null
  } catch { return null }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { data, error } = await getClient().from('users').select('*').eq('username', username).maybeSingle()
    if (error) return null
    return data as User | null
  } catch { return null }
}

export async function createUser(payload: Partial<User>): Promise<User> {
  const { data, error } = await getClient().from('users').insert(payload).select().single()
  if (error) handleError('createUser failed', error)
  return data as User
}

export async function updateUser(id: string, payload: Partial<User>): Promise<User> {
  const { data, error } = await getClient().from('users').update(payload).eq('id', id).select().single()
  if (error) handleError('updateUser failed', error)
  return data as User
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await getClient().from('users').delete().eq('id', id)
  if (error) handleError('deleteUser failed', error)
}

// --- Cars ---
export async function getCars(filter?: { stage?: CarStage; search?: string }): Promise<Car[]> {
  try {
    let q = getClient().from('cars').select('*').order('created_at', { ascending: false })
    if (filter?.stage) q = q.eq('current_stage', filter.stage)
    if (filter?.search) {
      q = q.or(`name.ilike.%${filter.search}%,serial_number.ilike.%${filter.search}%,license_plate.ilike.%${filter.search}%,seller_phone.ilike.%${filter.search}%`)
    }
    const { data, error } = await q
    if (error) return []
    return (data as Car[]) || []
  } catch { return [] }
}

export async function getCar(id: string): Promise<Car | null> {
  try {
    const { data, error } = await getClient().from('cars').select('*').eq('id', id).single()
    if (error) return null
    return data as Car | null
  } catch { return null }
}

export async function createCar(payload: Partial<Car>): Promise<Car> {
  const { data, error } = await getClient().from('cars').insert(payload).select().single()
  if (error) handleError('createCar failed', error)
  return data as Car
}

export async function updateCar(id: string, payload: Partial<Car>): Promise<Car> {
  const { data, error } = await getClient().from('cars').update(payload).eq('id', id).select().single()
  if (error) handleError('updateCar failed', error)
  return data as Car
}

export async function deleteCar(id: string): Promise<void> {
  const { error } = await getClient().from('cars').delete().eq('id', id)
  if (error) handleError('deleteCar failed', error)
}

// --- Fees ---
export async function getAllCarFees(): Promise<CarFees[]> {
  try {
    const { data, error } = await getClient().from('car_fees').select('*')
    if (error) return []
    return (data as CarFees[]) || []
  } catch { return [] }
}

export async function getCarFees(carId: string): Promise<CarFees | null> {
  try {
    const { data, error } = await getClient().from('car_fees').select('*').eq('car_id', carId).maybeSingle()
    if (error) return null
    return data as CarFees | null
  } catch { return null }
}

export async function upsertCarFees(payload: Partial<CarFees>): Promise<CarFees> {
  const { data, error } = await getClient().from('car_fees').upsert(payload, { onConflict: 'car_id' }).select().single()
  if (error) handleError('upsertCarFees failed', error)
  return data as CarFees
}

// --- Stage Logs ---
export async function getStageLogs(carId: string): Promise<CarStageLog[]> {
  try {
    const { data, error } = await getClient().from('car_stage_logs').select('*').eq('car_id', carId).order('created_at', { ascending: true })
    if (error) return []
    return (data as CarStageLog[]) || []
  } catch { return [] }
}

export async function createStageLog(payload: Partial<CarStageLog>): Promise<CarStageLog> {
  const { data, error } = await getClient().from('car_stage_logs').insert(payload).select().single()
  if (error) handleError('createStageLog failed', error)
  return data as CarStageLog
}

export async function moveToStage(carId: string, stage: CarStage, evidenceUrl: string | null, notes: string, userId: string): Promise<void> {
  const { error: logErr } = await getClient().from('car_stage_logs').insert({ car_id: carId, stage, evidence_url: evidenceUrl, notes, moved_by: userId }).select().single()
  if (logErr) handleError('createStageLog failed', logErr)
  const { error: carErr } = await getClient().from('cars').update({ current_stage: stage, updated_by: userId }).eq('id', carId)
  if (carErr) handleError('updateCar failed', carErr)
}

// --- Request Clients ---
export async function getAllRequestClients(): Promise<RequestClient[]> {
  try {
    const { data, error } = await getClient().from('request_clients').select('*')
    if (error) return []
    return (data as RequestClient[]) || []
  } catch { return [] }
}

export async function getRequestClient(carId: string): Promise<RequestClient | null> {
  try {
    const { data, error } = await getClient().from('request_clients').select('*').eq('car_id', carId).maybeSingle()
    if (error) return null
    return data as RequestClient | null
  } catch { return null }
}

export async function upsertRequestClient(payload: Partial<RequestClient>): Promise<RequestClient> {
  const { data, error } = await getClient().from('request_clients').upsert(payload, { onConflict: 'car_id' }).select().single()
  if (error) handleError('upsertRequestClient failed', error)
  return data as RequestClient
}

// --- Customers ---
export async function getCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await getClient().from('customers').select('*').order('created_at', { ascending: false })
    if (error) return []
    return (data as Customer[]) || []
  } catch { return [] }
}

export async function getCustomer(carId: string): Promise<Customer | null> {
  try {
    const { data, error } = await getClient().from('customers').select('*').eq('car_id', carId).maybeSingle()
    if (error) return null
    return data as Customer | null
  } catch { return null }
}

export async function upsertCustomer(payload: Partial<Customer>): Promise<Customer> {
  const { data, error } = await getClient().from('customers').upsert(payload, { onConflict: 'car_id' }).select().single()
  if (error) handleError('upsertCustomer failed', error)
  return data as Customer
}

// --- Edit Requests ---
export async function getEditRequests(carId?: string): Promise<EditRequest[]> {
  try {
    let q = getClient().from('edit_requests').select('*, requested_by:users!edit_requests_requested_by_fkey(id,username,full_name), reviewed_by:users!edit_requests_reviewed_by_fkey(id,username,full_name)').order('created_at', { ascending: false })
    if (carId) q = q.eq('car_id', carId)
    const { data, error } = await q
    if (error) return []
    return (data as any) || []
  } catch { return [] }
}

export async function createEditRequest(payload: Partial<EditRequest>): Promise<EditRequest> {
  const { data, error } = await getClient().from('edit_requests').insert(payload).select().single()
  if (error) handleError('createEditRequest failed', error)
  return data as EditRequest
}

export async function reviewEditRequest(id: string, status: 'approved' | 'rejected', reviewedBy: string, reviewNotes?: string): Promise<EditRequest> {
  const { data, error } = await getClient().from('edit_requests').update({
    status, reviewed_by: reviewedBy, review_notes: reviewNotes, reviewed_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) handleError('reviewEditRequest failed', error)
  return data as EditRequest
}

// --- Change Log ---
export async function getChangeLogs(limit = 50): Promise<ChangeLog[]> {
  try {
    const { data, error } = await getClient().from('change_log').select('*').order('timestamp', { ascending: false }).limit(limit)
    if (error) return []
    return (data as ChangeLog[]) || []
  } catch { return [] }
}

export async function createChangeLog(payload: Partial<ChangeLog>): Promise<ChangeLog> {
  const { data, error } = await getClient().from('change_log').insert(payload).select().single()
  if (error) handleError('createChangeLog failed', error)
  return data as ChangeLog
}

// --- Notifications ---
export async function getNotifications(userId: string): Promise<Notification[]> {
  try {
    const { data, error } = await getClient().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) return []
    return (data as Notification[]) || []
  } catch { return [] }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await getClient().from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
    if (error) return 0
    return count || 0
  } catch { return 0 }
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getClient().from('notifications').update({ is_read: true }).eq('id', id)
  if (error) handleError('markNotificationRead failed', error)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await getClient().from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  if (error) handleError('markAllNotificationsRead failed', error)
}

export async function createNotification(payload: Partial<Notification>): Promise<Notification> {
  const { data, error } = await getClient().from('notifications').insert(payload).select().single()
  if (error) handleError('createNotification failed', error)
  return data as Notification
}

// --- Bulk Import ---
export async function bulkInsertCars(cars: Partial<Car>[]): Promise<void> {
  const { error } = await getClient().from('cars').insert(cars)
  if (error) handleError('bulkInsertCars failed', error)
}

export async function bulkInsertCustomers(customers: Partial<Customer>[]): Promise<void> {
  const { error } = await getClient().from('customers').insert(customers)
  if (error) handleError('bulkInsertCustomers failed', error)
}
