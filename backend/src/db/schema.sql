-- Keka Chatbot Database Schema
-- Handoff requests table for storing contact form submissions

CREATE TABLE IF NOT EXISTS handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Service type
  service_type VARCHAR(50),

  -- Contact information
  contact_name VARCHAR(255),
  contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('email', 'phone')),
  contact_value VARCHAR(255) NOT NULL,

  -- Care details
  care_for VARCHAR(20) CHECK (care_for IN ('self', 'loved_one')),
  care_setting VARCHAR(50) CHECK (care_setting IN ('in_home', 'adult_day_health', 'clinic_visit', 'outpatient', 'residential', 'not_sure')),

  -- Form data (stored as JSONB for flexibility)
  form_data JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  session_id UUID NOT NULL,
  ip_hash VARCHAR(64),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Existing databases: allow the care settings the chatbot actually offers
-- (adult_day_health and clinic_visit were rejected, so those intake requests
-- were never saved). Older values are kept so existing rows stay valid.
ALTER TABLE handoffs DROP CONSTRAINT IF EXISTS handoffs_care_setting_check;
ALTER TABLE handoffs ADD CONSTRAINT handoffs_care_setting_check
  CHECK (care_setting IN ('in_home', 'adult_day_health', 'clinic_visit', 'outpatient', 'residential', 'not_sure'));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_handoffs_service_type ON handoffs(service_type);
CREATE INDEX IF NOT EXISTS idx_handoffs_contact_type ON handoffs(contact_type);
CREATE INDEX IF NOT EXISTS idx_handoffs_created_at ON handoffs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoffs_session_id ON handoffs(session_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop first so this file can be re-applied on every startup
DROP TRIGGER IF EXISTS update_handoffs_updated_at ON handoffs;
CREATE TRIGGER update_handoffs_updated_at BEFORE UPDATE
  ON handoffs FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
