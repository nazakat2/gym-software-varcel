-- Migration: Make gym_id nullable in otps table
-- This allows OTPs to be created before a gym exists (for gym registration)

ALTER TABLE otps ALTER COLUMN gym_id DROP NOT NULL;

-- Verify the change
\d otps
