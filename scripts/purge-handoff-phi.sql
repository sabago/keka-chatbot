-- One-off cleanup: remove health information (PHI) from existing handoff records.
--
-- Older versions of the chatbot's patient intake collected date of birth,
-- address, emergency contact, diagnosis, allergies, physician, mobility,
-- referral and insurance details and stored them in handoffs.form_data.
-- The chatbot no longer collects these. This script strips them from rows
-- already in the database, keeping name, contact details, care_for and
-- care_setting so staff can still follow up.
--
-- Usage (take a Railway database backup first):
--   psql "$DATABASE_URL" -f scripts/purge-handoff-phi.sql
--
-- Safe to run more than once. Runs in a single transaction.

BEGIN;

-- Rows that still hold any PHI field, before cleanup
SELECT COUNT(*) AS rows_with_phi_before
FROM handoffs
WHERE form_data ?| ARRAY[
  'date_of_birth', 'gender',
  'address_street', 'address_city', 'address_state', 'address_zip',
  'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
  'primary_diagnosis', 'secondary_conditions', 'allergies',
  'physician_name', 'physician_contact', 'assistive_devices',
  'services_requested',
  'can_walk_independently', 'assistance_level', 'fall_history',
  'referral_source', 'referral_agency', 'referral_contact',
  'primary_insurance', 'insurance_member_id', 'secondary_insurance', 'responsible_party',
  'chat_transcript'
];

UPDATE handoffs
SET form_data = form_data - ARRAY[
  'date_of_birth', 'gender',
  'address_street', 'address_city', 'address_state', 'address_zip',
  'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
  'primary_diagnosis', 'secondary_conditions', 'allergies',
  'physician_name', 'physician_contact', 'assistive_devices',
  'services_requested',
  'can_walk_independently', 'assistance_level', 'fall_history',
  'referral_source', 'referral_agency', 'referral_contact',
  'primary_insurance', 'insurance_member_id', 'secondary_insurance', 'responsible_party',
  'chat_transcript'
]
WHERE form_data ?| ARRAY[
  'date_of_birth', 'gender',
  'address_street', 'address_city', 'address_state', 'address_zip',
  'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
  'primary_diagnosis', 'secondary_conditions', 'allergies',
  'physician_name', 'physician_contact', 'assistive_devices',
  'services_requested',
  'can_walk_independently', 'assistance_level', 'fall_history',
  'referral_source', 'referral_agency', 'referral_contact',
  'primary_insurance', 'insurance_member_id', 'secondary_insurance', 'responsible_party',
  'chat_transcript'
];

-- Should be 0
SELECT COUNT(*) AS rows_with_phi_after
FROM handoffs
WHERE form_data ?| ARRAY[
  'date_of_birth', 'gender',
  'address_street', 'address_city', 'address_state', 'address_zip',
  'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
  'primary_diagnosis', 'secondary_conditions', 'allergies',
  'physician_name', 'physician_contact', 'assistive_devices',
  'services_requested',
  'can_walk_independently', 'assistance_level', 'fall_history',
  'referral_source', 'referral_agency', 'referral_contact',
  'primary_insurance', 'insurance_member_id', 'secondary_insurance', 'responsible_party',
  'chat_transcript'
];

COMMIT;

-- Afterwards, reclaim the space held by the old row versions so the removed
-- values are not left in the table's storage:
--   VACUUM FULL handoffs;
