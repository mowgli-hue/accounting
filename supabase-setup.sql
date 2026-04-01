-- Run this in Supabase SQL Editor (one time setup)
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste this > Run

CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  person TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('given', 'received')),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public access (since this is a personal tool)
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on people" ON people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
