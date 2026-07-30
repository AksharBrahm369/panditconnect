CREATE SCHEMA IF NOT EXISTS pim_v2;

CREATE TABLE IF NOT EXISTS pim_v2.users (
  id uuid PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('CUSTOMER','PANDIT','ADMIN')),
  name text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS pim_v2.otp_challenges (
  id uuid PRIMARY KEY,
  phone text NOT NULL,
  role text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_phone_created_idx ON pim_v2.otp_challenges(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS pim_v2.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pim_v2.services (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  base_price integer NOT NULL,
  duration_minutes integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pim_v2.pandit_profiles (
  user_id uuid PRIMARY KEY REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  experience_years integer NOT NULL DEFAULT 0,
  languages text[] NOT NULL DEFAULT '{}',
  specialities text[] NOT NULL DEFAULT '{}',
  bio text,
  verification_status text NOT NULL DEFAULT 'INCOMPLETE',
  is_online boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  base_charge integer NOT NULL DEFAULT 0,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  completed_jobs integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pim_v2.pandit_services (
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  service_id text NOT NULL REFERENCES pim_v2.services(id) ON DELETE CASCADE,
  charge integer NOT NULL,
  PRIMARY KEY (pandit_id, service_id)
);

CREATE TABLE IF NOT EXISTS pim_v2.bookings (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES pim_v2.users(id),
  pandit_id uuid REFERENCES pim_v2.users(id),
  service_id text NOT NULL REFERENCES pim_v2.services(id),
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  notes text,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'SEARCHING',
  arrival_otp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS booking_customer_idx ON pim_v2.bookings(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_pandit_idx ON pim_v2.bookings(pandit_id, created_at DESC);

INSERT INTO pim_v2.services (id,name,description,base_price,duration_minutes) VALUES
  ('ganesh-puja','Ganesh Puja','Auspicious worship for new beginnings.',1100,45),
  ('griha-pravesh','Griha Pravesh','Traditional ceremony for entering a new home.',3100,90),
  ('satyanarayan','Satyanarayan Puja','Complete katha and puja for family wellbeing.',2100,75),
  ('lakshmi-puja','Lakshmi Puja','Worship for prosperity and harmony.',1600,60),
  ('havan','Havan / Homam','Sacred fire ritual for purification.',2500,75)
ON CONFLICT (id) DO NOTHING;

