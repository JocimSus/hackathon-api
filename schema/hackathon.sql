-- 1. Users + roles
CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                		 			-- 'farmer','collector','processor','exporter','admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Batches (unit tracked; each batch has unique QR)
CREATE TABLE batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code TEXT UNIQUE NOT NULL,
  farmer_id UUID NOT NULL REFERENCES app_user(id),
  catch_time TIMESTAMP WITH TIME ZONE, 					-- waktu penangkapan (dd/mm/yyyy hh:mm)
  metadata JSONB DEFAULT '{}',         					-- extensible (e.g. species, pond_id)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Batch receipts/actions (history + current role action)
CREATE TABLE batch_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batch(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES app_user(id),
  actor_role TEXT NOT NULL,           					-- role saat melakukan action
  action TEXT NOT NULL,               					-- 'created','scanned','received','updated_status','lab_result' dll
  payload JSONB DEFAULT '{}',         					-- {weight:..., photo_url:..., notes:...}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Attachments (photo, pdf, lab reports)
CREATE TABLE attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batch(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES app_user(id),
  kind TEXT,                          					-- 'photo','certificate','lab_pdf','other'
  url TEXT NOT NULL,                  					-- link to object storage or local path
  mime_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);