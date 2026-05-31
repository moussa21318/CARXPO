-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (order matters for FK constraints)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS change_log CASCADE;
DROP TABLE IF EXISTS edit_requests CASCADE;
DROP TABLE IF EXISTS car_attachments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS request_clients CASCADE;
DROP TABLE IF EXISTS car_stage_logs CASCADE;
DROP TABLE IF EXISTS car_fees CASCADE;
DROP TABLE IF EXISTS cars CASCADE;
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
  transport_02 NUMERIC(12,2) DEFAULT 0
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

-- Request clients (initial order person)
CREATE TABLE request_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID UNIQUE REFERENCES cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT ''
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

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('car_attachments', 'car_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'upload_auth' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "upload_auth" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'car_attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_public' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "select_public" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'car_attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_auth' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "delete_auth" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'car_attachments');
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
