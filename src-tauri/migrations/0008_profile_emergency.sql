-- Emergency / ICE fields on a profile, for the medical card.
ALTER TABLE profiles ADD COLUMN emergency_contact   TEXT;
ALTER TABLE profiles ADD COLUMN emergency_phone     TEXT;
ALTER TABLE profiles ADD COLUMN emergency_email     TEXT;
ALTER TABLE profiles ADD COLUMN organ_donor         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN advance_directive   TEXT;
