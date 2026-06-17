export type CarStage = 'request' | 'deposit' | 'purchase' | 'shipping_prep' | 'shipping'
export type UserRole = 'admin' | 'employee'
export type EditRequestStatus = 'pending' | 'approved' | 'rejected'
export type DeleteRequestStatus = 'pending' | 'approved' | 'rejected'
export type NotificationType = 'car_added' | 'car_updated' | 'car_deleted' | 'edit_requested' | 'edit_approved' | 'edit_rejected' | 'stage_changed' | 'car_confirmed'
export type Lang = 'ar' | 'fr' | 'en'

export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'credit_card'

export interface User {
  id: string
  username: string
  role: UserRole
  full_name: string
  is_active: boolean
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  code: string | null
  name: string
  phone: string
  created_at: string
}

export interface Car {
  id: string
  name: string
  model_year: number
  serial_number: string | null
  license_plate: string | null
  seller_phone: string
  initial_price: number
  notes: string
  code: string | null
  client_id: string | null
  customer_id: string | null
  current_stage: CarStage
  confirmed: boolean
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface CarFees {
  id: string
  car_id: string
  deposit: number
  deposit_02: number
  transport_01: number
  parking: number
  other_fees: number
  transport_02: number
  deposit_date: string | null
  deposit_02_date: string | null
  transport_01_date: string | null
  parking_date: string | null
  other_fees_date: string | null
  transport_02_date: string | null
}

export interface CarStageLog {
  id: string
  car_id: string
  stage: CarStage
  evidence_url: string | null
  notes: string
  moved_by: string
  created_at: string
}

export interface Customer {
  id: string
  code: string | null
  full_name_latin: string
  national_id: string
  address_latin: string
  postal_code: string
  phone: string
  email: string
  created_at: string
}

export interface EditRequest {
  id: string
  car_id: string
  requested_by: string
  old_data: any
  new_data: any
  reason: string
  status: EditRequestStatus
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export interface DeleteRequest {
  id: string
  car_id: string
  requested_by: string
  reason: string
  status: DeleteRequestStatus
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export interface ChangeLog {
  id: string
  table_name: string
  record_id: string
  operation: 'insert' | 'update' | 'delete'
  old_data: any
  new_data: any
  user_id: string
  timestamp: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  car_id: string | null
  is_read: boolean
  created_by: string
  created_at: string
}

export interface CarAttachment {
  id: string
  car_id: string
  name: string
  storage_path: string
  created_at: string
}

export const STAGE_LABELS: Record<CarStage, string> = {
  request: 'stages.request',
  deposit: 'stages.deposit',
  purchase: 'stages.purchase',
  shipping_prep: 'stages.shipping_prep',
  shipping: 'stages.shipping',
}

export const STAGE_ORDER: CarStage[] = ['request', 'deposit', 'purchase', 'shipping_prep', 'shipping']

export const MODEL_YEARS = [2026, 2025, 2024, 2023, 2022, 2021]

export const FEE_LABELS: (keyof CarFees)[] = ['deposit', 'deposit_02', 'transport_01', 'parking', 'other_fees', 'transport_02']

export interface CustomerPayment {
  id: string
  car_id: string | null
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  receipt_url: string | null
  notes: string
  created_by: string
  created_at: string
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'payment_method.cash',
  bank_transfer: 'payment_method.bank_transfer',
  check: 'payment_method.check',
  credit_card: 'payment_method.credit_card',
}
