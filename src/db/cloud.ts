import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { hash, verify } from '../utils/hash'
import type {
  User, Car, CarFees, CarStageLog, Client, Customer,
  EditRequest, ChangeLog, Notification, CarStage, CarAttachment, DeleteRequest, CustomerPayment, ClientSettlement,
  Brand, Model,
} from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase: SupabaseClient

export function getClient(): SupabaseClient {
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
export async function getLastCarCode(): Promise<string | null> {
  try {
    const { data } = await getClient().from('cars').select('code').not('code', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return data?.code || null
  } catch { return null }
}

export function generateNextCode(lastCode: string | null): string {
  if (!lastCode) return 'A01'
  const letter = lastCode[0]
  const num = parseInt(lastCode.slice(1), 10)
  if (num < 99) return `${letter}${String(num + 1).padStart(2, '0')}`
  const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1)
  if (nextLetter > 'Z') return 'A01'
  return `${nextLetter}01`
}

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

export async function getCarsPaginated(filter: { stage?: CarStage; search?: string; clientId?: string; page: number; pageSize: number }): Promise<{ cars: Car[]; total: number }> {
  try {
    const from = (filter.page - 1) * filter.pageSize
    const to = from + filter.pageSize - 1
    let q = getClient().from('cars').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
    if (filter.stage) q = q.eq('current_stage', filter.stage)
    if (filter.clientId) q = q.eq('client_id', filter.clientId)
    if (filter.search) {
      q = q.or(`name.ilike.%${filter.search}%,serial_number.ilike.%${filter.search}%,license_plate.ilike.%${filter.search}%,seller_phone.ilike.%${filter.search}%`)
    }
    const { data, error, count } = await q
    if (error) return { cars: [], total: 0 }
    return { cars: (data as Car[]) || [], total: count || 0 }
  } catch { return { cars: [], total: 0 } }
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
  const storagePaths: string[] = []

  const attachments = await getAttachments(id)
  storagePaths.push(...attachments.map(a => a.storage_path))

  const { data: evFiles } = await getClient().storage.from('car_attachments').list(`evidence/${id}`)
  if (evFiles) storagePaths.push(...evFiles.map(f => `evidence/${id}/${f.name}`))

  if (storagePaths.length > 0) {
    const { error: delErr } = await getClient().storage.from('car_attachments').remove(storagePaths)
    if (delErr) handleError('deleteCar storage cleanup failed', delErr)
  }

  const { error } = await getClient().from('cars').delete().eq('id', id)
  if (error) handleError('deleteCar failed', error)
}

export async function deleteCars(ids: string[]): Promise<void> {
  const storagePaths: string[] = []

  for (const id of ids) {
    const attachments = await getAttachments(id)
    storagePaths.push(...attachments.map(a => a.storage_path))

    const { data: evFiles } = await getClient().storage.from('car_attachments').list(`evidence/${id}`)
    if (evFiles) storagePaths.push(...evFiles.map(f => `evidence/${id}/${f.name}`))
  }

  if (storagePaths.length > 0) {
    const { error: delErr } = await getClient().storage.from('car_attachments').remove(storagePaths)
    if (delErr) handleError('deleteCars storage cleanup failed', delErr)
  }

  const { error } = await getClient().from('cars').delete().in('id', ids)
  if (error) handleError('deleteCars failed', error)
}

// --- Brands & Models ---
export async function getBrands(): Promise<Brand[]> {
  try {
    const { data, error } = await getClient().from('brands').select('*').order('name', { ascending: true })
    if (error) return []
    return (data as Brand[]) || []
  } catch { return [] }
}

export async function createBrand(name: string): Promise<Brand> {
  const { data, error } = await getClient().from('brands').insert({ name }).select().single()
  if (error) handleError('createBrand failed', error)
  return data as Brand
}

export async function updateBrand(id: string, name: string): Promise<Brand> {
  const { data, error } = await getClient().from('brands').update({ name }).eq('id', id).select().single()
  if (error) handleError('updateBrand failed', error)
  return data as Brand
}

export async function deleteBrand(id: string): Promise<void> {
  const { error } = await getClient().from('brands').delete().eq('id', id)
  if (error) handleError('deleteBrand failed', error)
}

export async function getModels(brandId: string): Promise<Model[]> {
  try {
    const { data, error } = await getClient().from('models').select('*').eq('brand_id', brandId).order('name', { ascending: true })
    if (error) return []
    return (data as Model[]) || []
  } catch { return [] }
}

export async function createModel(brandId: string, name: string): Promise<Model> {
  const { data, error } = await getClient().from('models').insert({ brand_id: brandId, name }).select().single()
  if (error) handleError('createModel failed', error)
  return data as Model
}

export async function deleteModel(id: string): Promise<void> {
  const { error } = await getClient().from('models').delete().eq('id', id)
  if (error) handleError('deleteModel failed', error)
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
  const today = new Date().toISOString().slice(0, 10)
  const payloadWithDates = { ...payload }
  if ((payload as any).deposit !== undefined && payload.deposit! > 0 && !payload.deposit_date) payloadWithDates.deposit_date = today
  if ((payload as any).deposit_02 !== undefined && payload.deposit_02! > 0 && !payload.deposit_02_date) payloadWithDates.deposit_02_date = today
  if ((payload as any).transport_01 !== undefined && payload.transport_01! > 0 && !payload.transport_01_date) payloadWithDates.transport_01_date = today
  if ((payload as any).parking !== undefined && payload.parking! > 0 && !payload.parking_date) payloadWithDates.parking_date = today
  if ((payload as any).other_fees !== undefined && payload.other_fees! > 0 && !payload.other_fees_date) payloadWithDates.other_fees_date = today
  if ((payload as any).transport_02 !== undefined && payload.transport_02! > 0 && !payload.transport_02_date) payloadWithDates.transport_02_date = today
  const { data, error } = await getClient().from('car_fees').upsert(payloadWithDates, { onConflict: 'car_id' }).select().single()
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

// --- Clients ---
export async function getLastClientCode(): Promise<string | null> {
  try {
    const { data } = await getClient().from('clients').select('code').not('code', 'is', null).order('code', { ascending: false }).limit(1).maybeSingle()
    return data?.code || null
  } catch { return null }
}

export function generateNextClientCode(lastCode: string | null): string {
  if (!lastCode) return '001'
  const num = parseInt(lastCode, 10)
  return String(Math.min(num + 1, 999)).padStart(3, '0')
}

export async function getAllClients(): Promise<Client[]> {
  try {
    const { data, error } = await getClient().from('clients').select('*').order('name', { ascending: true })
    if (error) return []
    return (data as Client[]) || []
  } catch { return [] }
}

export async function getClientById(id: string): Promise<Client | null> {
  try {
    const { data, error } = await getClient().from('clients').select('*').eq('id', id).maybeSingle()
    if (error) return null
    return data as Client | null
  } catch { return null }
}

export async function upsertClient(name: string, phone: string = ''): Promise<Client> {
  const { data: existing } = await getClient().from('clients').select('*').eq('name', name).eq('phone', phone).maybeSingle()
  if (existing) return existing as Client
  const lastCode = await getLastClientCode()
  const code = generateNextClientCode(lastCode)
  const { data, error } = await getClient().from('clients').insert({ name, phone, code }).select().single()
  if (error) handleError('upsertClient failed', error)
  return data as Client
}

export async function updateClient(id: string, payload: { name?: string; phone?: string }): Promise<Client> {
  const { data, error } = await getClient().from('clients').update(payload).eq('id', id).select().single()
  if (error) handleError('updateClient failed', error)
  return data as Client
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await getClient().from('clients').delete().eq('id', id)
  if (error) handleError('deleteClient failed', error)
}

export function generateRandomPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function getClientByUserId(userId: string): Promise<Client | null> {
  try {
    const { data, error } = await getClient().from('clients').select('*').eq('user_id', userId).maybeSingle()
    if (error) return null
    return data as Client | null
  } catch { return null }
}

export async function createClientWithUser(name: string, phone: string): Promise<{ client: Client; username: string; password: string }> {
  const lastCode = await getLastClientCode()
  const code = generateNextClientCode(lastCode)
  const password = generateRandomPassword()
  const passwordHash = await hash(password)
  const username = `client_${code}`
  const { data: user, error: userErr } = await getClient().from('users').insert({
    username, password_hash: passwordHash, role: 'client', full_name: name, is_active: true,
  }).select().single()
  if (userErr) handleError('createClientWithUser insert user failed', userErr)
  const { data: client, error: clientErr } = await getClient().from('clients').insert({
    name, phone, code, user_id: user.id,
  }).select().single()
  if (clientErr) handleError('createClientWithUser insert client failed', clientErr)
  return { client: client as Client, username, password }
}

export async function resetClientPassword(userId: string): Promise<{ username: string; password: string }> {
  const { data: user, error: fetchErr } = await getClient().from('users').select('username').eq('id', userId).single()
  if (fetchErr || !user) handleError('resetClientPassword: user not found', fetchErr)
  const password = generateRandomPassword()
  const passwordHash = await hash(password)
  const { error } = await getClient().from('users').update({ password_hash: passwordHash }).eq('id', userId)
  if (error) handleError('resetClientPassword failed', error)
  return { username: user!.username, password }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const { data, error } = await getClient().from('users').select('*').eq('id', id).single()
    if (error) return null
    return data as User | null
  } catch { return null }
}

export async function createUserForExistingClient(clientId: string, name: string): Promise<{ username: string; password: string }> {
  const lastCode = await getLastClientCode()
  let code = generateNextClientCode(lastCode)
  const password = generateRandomPassword()
  const passwordHash = await hash(password)
  let username = `client_${code}`
  while (true) {
    const { data: existing } = await getClient().from('users').select('id').eq('username', username).maybeSingle()
    if (!existing) break
    code = generateNextClientCode(code)
    username = `client_${code}`
  }
  const { data: user, error: userErr } = await getClient().from('users').insert({
    username, password_hash: passwordHash, role: 'client', full_name: name, is_active: true,
  }).select().single()
  if (userErr) handleError('createUserForExistingClient insert user failed', userErr)
  const { error: clientErr } = await getClient().from('clients').update({ user_id: user.id }).eq('id', clientId)
  if (clientErr) handleError('createUserForExistingClient update client failed', clientErr)
  return { username, password }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const { data: user, error } = await getClient().from('users').select('password_hash').eq('id', userId).single()
  if (error || !user) throw new Error('User not found')
  const ok = await verify(currentPassword, user.password_hash)
  if (!ok) throw new Error('Wrong password')
  const passwordHash = await hash(newPassword)
  const { error: updateErr } = await getClient().from('users').update({ password_hash: passwordHash }).eq('id', userId)
  if (updateErr) handleError('changePassword failed', updateErr)
}

// --- Customers ---
export async function getLastCustomerCode(): Promise<string | null> {
  try {
    const { data } = await getClient().from('customers').select('code').not('code', 'is', null).order('code', { ascending: false }).limit(1).maybeSingle()
    return data?.code || null
  } catch { return null }
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await getClient().from('customers').select('*').order('code', { ascending: true })
    if (error) return []
    return (data as Customer[]) || []
  } catch { return [] }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    const { data, error } = await getClient().from('customers').select('*').eq('id', id).maybeSingle()
    if (error) return null
    return data as Customer | null
  } catch { return null }
}

export async function upsertCustomer(fullNameLatin: string, nationalId: string, addressLatin: string, postalCode: string, phone: string, email: string = ''): Promise<{ customer: Customer; password: string | null }> {
  const { data: existing } = await getClient().from('customers').select('*').eq('full_name_latin', fullNameLatin).eq('national_id', nationalId).maybeSingle()
  if (existing) {
    if (!existing.password_hash) {
      const password = generateRandomPassword()
      const passwordHash = await hash(password)
      const { data, error } = await getClient().from('customers').update({ address_latin: addressLatin, postal_code: postalCode, phone, email, password_hash: passwordHash }).eq('id', existing.id).select().single()
      if (error) handleError('upsertCustomer update failed', error)
      return { customer: data as Customer, password }
    }
    const { data, error } = await getClient().from('customers').update({ address_latin: addressLatin, postal_code: postalCode, phone, email }).eq('id', existing.id).select().single()
    if (error) handleError('upsertCustomer update failed', error)
    return { customer: data as Customer, password: null }
  }
  const lastCode = await getLastCustomerCode()
  const code = generateNextClientCode(lastCode)
  const password = generateRandomPassword()
  const passwordHash = await hash(password)
  const { data, error } = await getClient().from('customers').insert({ full_name_latin: fullNameLatin, national_id: nationalId, address_latin: addressLatin, postal_code: postalCode, phone, email, code, password_hash: passwordHash }).select().single()
  if (error) handleError('upsertCustomer insert failed', error)
  return { customer: data as Customer, password }
}

export async function resetCustomerPassword(customerId: string): Promise<string> {
  const password = generateRandomPassword()
  const passwordHash = await hash(password)
  const { error } = await getClient().from('customers').update({ password_hash: passwordHash }).eq('id', customerId)
  if (error) handleError('resetCustomerPassword failed', error)
  return password
}

export async function ensureCustomerPassword(customerId: string): Promise<string | null> {
  try {
    const customer = await getCustomerById(customerId)
    if (customer?.password_hash) return null
    const password = generateRandomPassword()
    const passwordHash = await hash(password)
    const { error } = await getClient().from('customers').update({ password_hash: passwordHash }).eq('id', customerId)
    if (error) handleError('ensureCustomerPassword failed', error)
    return password
  } catch { return null }
}

export async function verifyCustomerPassword(customerId: string, password: string): Promise<boolean> {
  try {
    const customer = await getCustomerById(customerId)
    if (!customer?.password_hash) return false
    return await verify(password, customer.password_hash)
  } catch { return false }
}

export async function findCarBySerialNumber(serialNumber: string): Promise<Car | null> {
  try {
    const { data, error } = await getClient().from('cars').select('*').eq('serial_number', serialNumber).eq('deleted', false).maybeSingle()
    if (error) return null
    return data as Car | null
  } catch { return null }
}

export async function getCarsByCustomerId(customerId: string): Promise<Car[]> {
  try {
    const { data, error } = await getClient().from('cars').select('*').eq('customer_id', customerId).eq('deleted', false).order('created_at', { ascending: false })
    if (error) return []
    return (data as Car[]) || []
  } catch { return [] }
}

export async function updateCustomer(id: string, payload: Partial<Customer>): Promise<Customer> {
  const { data, error } = await getClient().from('customers').update(payload).eq('id', id).select().single()
  if (error) handleError('updateCustomer failed', error)
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await getClient().from('customers').delete().eq('id', id)
  if (error) handleError('deleteCustomer failed', error)
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

// --- Delete Requests ---
export async function getDeleteRequests(carId?: string): Promise<DeleteRequest[]> {
  try {
    let q = getClient().from('delete_requests').select('*').order('created_at', { ascending: false })
    if (carId) q = q.eq('car_id', carId)
    const { data, error } = await q
    if (error) return []
    return (data as DeleteRequest[]) || []
  } catch { return [] }
}

export async function createDeleteRequest(payload: Partial<DeleteRequest>): Promise<DeleteRequest> {
  const { data, error } = await getClient().from('delete_requests').insert(payload).select().single()
  if (error) handleError('createDeleteRequest failed', error)
  const req = data as DeleteRequest
  try {
    const car = await getCar(req.car_id)
    const carName = car?.name || req.car_id
    const users = await getUsers()
    const admins = users.filter(u => u.role === 'admin')
    for (const admin of admins) {
      await createNotification({
        user_id: admin.id,
        type: 'delete_requested',
        title: `طلب حذف سيارة: ${carName}`,
        body: req.reason || '',
        car_id: req.car_id,
        created_by: req.requested_by,
      })
    }
  } catch { /* notification failure is non-critical */ }
  return req
}

export async function reviewDeleteRequest(id: string, status: 'approved' | 'rejected', reviewedBy: string, reviewNotes?: string): Promise<string | null> {
  const req = await getDeleteRequestsForReview(id)
  if (!req) return null
  const { error: updateErr } = await getClient().from('delete_requests').update({
    status, reviewed_by: reviewedBy, review_notes: reviewNotes || null, reviewed_at: new Date().toISOString(),
  }).eq('id', id)
  if (updateErr) handleError('reviewDeleteRequest failed', updateErr)
  try {
    const car = await getCar(req.car_id)
    const carName = car?.name || req.car_id
    const title = status === 'approved' ? `تمت الموافقة على حذف: ${carName}` : `تم رفض حذف: ${carName}`
    await createNotification({
      user_id: req.requested_by,
      type: status === 'approved' ? 'delete_approved' : 'delete_rejected',
      title,
      body: reviewNotes || '',
      car_id: req.car_id,
      created_by: reviewedBy,
    })
  } catch { /* notification failure is non-critical */ }
  if (status === 'approved') {
    const car = await getCar(req.car_id)
    if (car) {
      const { error: delErr } = await getClient().from('cars').update({ deleted: true, updated_by: reviewedBy }).eq('id', req.car_id)
      if (delErr) handleError('reviewDeleteRequest soft-delete failed', delErr)

      if (car.client_id) {
        const fees = await getCarFees(req.car_id)
        const feeKeys = ['deposit', 'deposit_02', 'transport_01', 'parking', 'other_fees', 'transport_02'] as const
        for (const key of feeKeys) {
          const amount = (fees && fees[key]) || 0
          if (amount > 0) {
            const { error: insErr } = await getClient().from('client_settlements').insert({
              client_id: car.client_id,
              car_id: req.car_id,
              amount,
              fee_type: key,
              car_name: car.name,
              car_model: car.model,
              model_year: car.model_year,
              reason: `تسوية حذف: ${car.name} ${car.brand || ''} ${car.model || ''} ${car.model_year} - ${key}`,
              created_by: reviewedBy,
            })
            if (insErr) handleError('reviewDeleteRequest insert settlement failed', insErr)
          }
        }
      }

      const storagePaths: string[] = []
      const attachments = await getAttachments(req.car_id)
      storagePaths.push(...attachments.map(a => a.storage_path))
      const { data: evFiles } = await getClient().storage.from('car_attachments').list(`evidence/${req.car_id}`)
      if (evFiles) storagePaths.push(...evFiles.map(f => `evidence/${req.car_id}/${f.name}`))
      if (storagePaths.length > 0) {
        const { error: storErr } = await getClient().storage.from('car_attachments').remove(storagePaths)
        if (storErr) handleError('reviewDeleteRequest storage cleanup failed', storErr)
      }
    }
    return req.car_id
  }
  return null
}

async function getDeleteRequestsForReview(id: string): Promise<DeleteRequest | null> {
  try {
    const { data, error } = await getClient().from('delete_requests').select('*').eq('id', id).maybeSingle()
    if (error) return null
    return data as DeleteRequest | null
  } catch { return null }
}

// --- Change Log ---
export async function getChangeLogs(limit = 50): Promise<ChangeLog[]> {
  try {
    const { data, error } = await getClient().from('change_log').select('*').order('timestamp', { ascending: false }).limit(limit)
    if (error) return []
    return (data as ChangeLog[]) || []
  } catch { return [] }
}

export async function getChangeLogsWithUsers(limit = 50): Promise<(ChangeLog & { user_name: string })[]> {
  try {
    const { data, error } = await getClient()
      .from('change_log')
      .select('*, user:users!change_log_user_id_fkey(username, full_name)')
      .order('timestamp', { ascending: false })
      .limit(limit)
    if (error) return []
    return ((data as any[]) || []).map(l => {
      const userName = l.user ? (l.user.full_name || l.user.username) : l.user_id?.slice(0, 8)
      const { user, ...rest } = l
      return { ...rest, user_name: userName } as ChangeLog & { user_name: string }
    })
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

// --- Attachments ---
export async function getAttachments(carId: string): Promise<(CarAttachment & { publicUrl: string })[]> {
  try {
    const { data, error } = await getClient().from('car_attachments').select('*').eq('car_id', carId).order('created_at', { ascending: true })
    if (error) return []
    const items = (data as CarAttachment[]) || []
    return items.map(item => {
      const { data: pub } = getClient().storage.from('car_attachments').getPublicUrl(item.storage_path)
      return { ...item, publicUrl: pub.publicUrl }
    })
  } catch { return [] }
}

export async function addAttachment(payload: Partial<CarAttachment>): Promise<CarAttachment> {
  const { data, error } = await getClient().from('car_attachments').insert(payload).select().single()
  if (error) handleError('addAttachment failed', error)
  return data as CarAttachment
}

export async function deleteAttachment(id: string, storagePath?: string): Promise<void> {
  if (storagePath) {
    const { error: delErr } = await getClient().storage.from('car_attachments').remove([storagePath])
    if (delErr) handleError('deleteAttachment storage failed', delErr)
  }
  const { error } = await getClient().from('car_attachments').delete().eq('id', id)
  if (error) handleError('deleteAttachment failed', error)
}

// --- Customer Payments ---
export async function getCustomerPayments(carId: string): Promise<CustomerPayment[]> {
  try {
    const { data, error } = await getClient().from('customer_payments').select('*').eq('car_id', carId).order('payment_date', { ascending: false })
    if (error) return []
    return (data as CustomerPayment[]) || []
  } catch { return [] }
}

export async function getAllCustomerPayments(): Promise<(CustomerPayment & { client_name?: string; car_name?: string })[]> {
  try {
    const { data, error } = await getClient()
      .from('customer_payments')
      .select('*, client:clients!customer_payments_client_id_fkey(name), car:cars!customer_payments_car_id_fkey(name, code)')
      .order('created_at', { ascending: false })
    if (error) return []
    return ((data as any[]) || []).map(p => {
      const { client, car, ...rest } = p
      return { ...rest, client_name: client?.name, car_name: car?.name }
    })
  } catch { return [] }
}

export async function getGeneralPayments(): Promise<CustomerPayment[]> {
  try {
    const { data, error } = await getClient().from('customer_payments').select('*').is('car_id', null).order('created_at', { ascending: false })
    if (error) return []
    return (data as CustomerPayment[]) || []
  } catch { return [] }
}

export async function createCustomerPayment(payload: Partial<CustomerPayment>): Promise<CustomerPayment> {
  const { data, error } = await getClient().from('customer_payments').insert(payload).select().single()
  if (error) handleError('createCustomerPayment failed', error)
  return data as CustomerPayment
}

export async function updateCustomerPayment(id: string, payload: Partial<CustomerPayment>): Promise<CustomerPayment> {
  const { data, error } = await getClient().from('customer_payments').update(payload).eq('id', id).select().single()
  if (error) handleError('updateCustomerPayment failed', error)
  return data as CustomerPayment
}

export async function deleteCustomerPayment(id: string, receiptUrl?: string): Promise<void> {
  if (receiptUrl) {
    await getClient().storage.from('car_attachments').remove([receiptUrl])
  }
  const { error } = await getClient().from('customer_payments').delete().eq('id', id)
  if (error) handleError('deleteCustomerPayment failed', error)
}

export async function notifyCustomerUpdated(carId: string, carName: string, clientName: string): Promise<void> {
  try {
    const users = await getUsers()
    const targets = users.filter(u => u.role === 'admin' || u.role === 'employee')
    for (const u of targets) {
      await createNotification({
        user_id: u.id,
        type: 'customer_updated',
        title: `تم تحديث بيانات المستهلك النهائي للسيارة: ${carName}`,
        body: `بواسطة الزبون: ${clientName}`,
        car_id: carId,
      })
    }
  } catch { /* non-critical */ }
}

export async function getPaymentsByClientId(clientId: string): Promise<CustomerPayment[]> {
  try {
    const { data, error } = await getClient().from('customer_payments').select('*').eq('client_id', clientId).order('payment_date', { ascending: false })
    if (error) return []
    return (data as CustomerPayment[]) || []
  } catch { return [] }
}

export async function getPaymentsForClient(clientId: string, carIds: string[]): Promise<(CustomerPayment & { car_name?: string })[]> {
  try {
    let query = getClient().from('customer_payments').select('*, car:cars!customer_payments_car_id_fkey(name, code)')
    if (carIds.length > 0) {
      query = query.or(`client_id.eq.${clientId},car_id.in.(${carIds.join(',')})`)
    } else {
      query = query.eq('client_id', clientId)
    }
    const { data, error } = await query.order('payment_date', { ascending: false })
    if (error) return []
    return ((data as any[]) || []).map(p => {
      const { car, ...rest } = p
      return { ...rest, car_name: car?.name } as CustomerPayment & { car_name?: string }
    })
  } catch { return [] }
}

export async function getClientSettlementsByClientId(clientId: string): Promise<ClientSettlement[]> {
  try {
    const { data, error } = await getClient().from('client_settlements').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    if (error) return []
    return (data as ClientSettlement[]) || []
  } catch { return [] }
}

export async function deleteSettlement(id: string): Promise<void> {
  try {
    await getClient().from('client_settlements').delete().eq('id', id)
  } catch { /* ignore */ }
}

export async function updateSettlement(id: string, payload: Partial<ClientSettlement>): Promise<ClientSettlement> {
  const { data, error } = await getClient().from('client_settlements').update(payload).eq('id', id).select().single()
  if (error) handleError('updateSettlement failed', error)
  return data as ClientSettlement
}

export async function getAllSettlements(): Promise<ClientSettlement[]> {
  try {
    const { data, error } = await getClient().from('client_settlements').select('*').order('created_at', { ascending: false })
    if (error) return []
    return (data as ClientSettlement[]) || []
  } catch { return [] }
}
