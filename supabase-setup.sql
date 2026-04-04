-- Run this SQL in your Supabase SQL Editor to set up the cloud sync table
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Create the app_data table to store all SHG Bank data
CREATE TABLE IF NOT EXISTS app_data (
  id TEXT PRIMARY KEY DEFAULT 'main',
  members JSONB DEFAULT '[]'::jsonb,
  loans JSONB DEFAULT '[]'::jsonb,
  contributions JSONB DEFAULT '[]'::jsonb,
  penalties JSONB DEFAULT '[]'::jsonb,
  notifications JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Allow anyone with the anon key to read data
CREATE POLICY "Allow public read" ON app_data
  FOR SELECT USING (true);

-- Allow anyone with the anon key to insert data
CREATE POLICY "Allow public insert" ON app_data
  FOR INSERT WITH CHECK (true);

-- Allow anyone with the anon key to update data
CREATE POLICY "Allow public update" ON app_data
  FOR UPDATE USING (true);

-- Insert the initial row
INSERT INTO app_data (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;
