const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        person TEXT NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        note TEXT DEFAULT '',
        date TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    return res.status(200).json({ message: 'Tables created successfully!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
