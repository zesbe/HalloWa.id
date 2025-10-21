-- Add pairing code support to devices table
ALTER TABLE devices 
ADD COLUMN pairing_code TEXT,
ADD COLUMN connection_method TEXT DEFAULT 'qr' CHECK (connection_method IN ('qr', 'pairing')),
ADD COLUMN phone_for_pairing TEXT;