-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (order matters for FK constraints)
DROP TABLE IF EXISTS customer_payments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS change_log CASCADE;
DROP TABLE IF EXISTS edit_requests CASCADE;
DROP TABLE IF EXISTS delete_requests CASCADE;
DROP TABLE IF EXISTS car_attachments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS car_stage_logs CASCADE;
DROP TABLE IF EXISTS car_fees CASCADE;
DROP TABLE IF EXISTS cars CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(3) UNIQUE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_phone_idx ON clients (name, phone);

-- Cars table
CREATE TABLE cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  model_year INTEGER NOT NULL,
  serial_number TEXT,
  license_plate TEXT,
  seller_phone TEXT,
  initial_price NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  code VARCHAR(3) UNIQUE,
  client_id UUID REFERENCES clients(id),
  current_stage TEXT NOT NULL DEFAULT 'request' CHECK (current_stage IN ('request','deposit','purchase','shipping_prep','shipping')),
  confirmed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car fees
CREATE TABLE car_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID UNIQUE REFERENCES cars(id) ON DELETE CASCADE,
  deposit NUMERIC(12,2) DEFAULT 0,
  deposit_02 NUMERIC(12,2) DEFAULT 0,
  transport_01 NUMERIC(12,2) DEFAULT 0,
  parking NUMERIC(12,2) DEFAULT 0,
  other_fees NUMERIC(12,2) DEFAULT 0,
  transport_02 NUMERIC(12,2) DEFAULT 0,
  deposit_date DATE DEFAULT NULL,
  deposit_02_date DATE DEFAULT NULL,
  transport_01_date DATE DEFAULT NULL,
  parking_date DATE DEFAULT NULL,
  other_fees_date DATE DEFAULT NULL,
  transport_02_date DATE DEFAULT NULL
);

-- Stage log
CREATE TABLE car_stage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('request','deposit','purchase','shipping_prep','shipping')),
  evidence_url TEXT,
  notes TEXT DEFAULT '',
  moved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final customers (shipping prep)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID UNIQUE REFERENCES cars(id) ON DELETE CASCADE,
  full_name_latin TEXT NOT NULL,
  national_id TEXT NOT NULL,
  address_latin TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT ''
);

-- Edit requests
CREATE TABLE edit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  old_data JSONB,
  new_data JSONB,
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Change log
CREATE TABLE change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Car attachments
CREATE TABLE car_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delete requests (employee requests admin approval to delete a car)
CREATE TABLE delete_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Customer payments (track payments received from end customer)
CREATE TABLE customer_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID REFERENCES cars(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','bank_transfer','check','credit_card')),
  receipt_url TEXT,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('car_attachments', 'car_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public (anon) users to upload files (app uses custom auth, not supabase auth)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'upload_auth' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "upload_auth" ON storage.objects
      FOR INSERT TO public WITH CHECK (bucket_id = 'car_attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_public' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "select_public" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'car_attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_auth' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "delete_auth" ON storage.objects
      FOR DELETE TO public USING (bucket_id = 'car_attachments');
  END IF;
END $$;

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  car_id UUID REFERENCES cars(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cars_created_at ON cars(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cars_client_id ON cars(client_id);
CREATE INDEX IF NOT EXISTS idx_car_stage_logs_car_id ON car_stage_logs(car_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_customer_payments_car_id ON customer_payments(car_id);

-- Disable RLS on all tables (app uses custom auth, not supabase auth)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE cars DISABLE ROW LEVEL SECURITY;
ALTER TABLE car_fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE car_stage_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE delete_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE change_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE car_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
