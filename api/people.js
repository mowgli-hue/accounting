const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, name } = req.body;

    if (action === 'delete') {
      await sql`DELETE FROM transactions WHERE person = ${name}`;
      await sql`DELETE FROM people WHERE name = ${name}`;
    } else {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const existing = await sql`SELECT name FROM people WHERE name = ${name.trim()}`;
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Person already exists' });
      }
      await sql`INSERT INTO people (name) VALUES (${name.trim()})`;
    }

    // Return updated data
    const peopleResult = await sql`SELECT name FROM people ORDER BY id`;
    const txnResult = await sql`SELECT * FROM transactions ORDER BY date DESC`;
    const people = peopleResult.rows.map(r => r.name);
    const transactions = txnResult.rows.map(r => ({
      id: r.id, person: r.person, type: r.type,
      amount: parseFloat(r.amount), note: r.note, date: r.date
    }));

    return res.status(200).json({ people, transactions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
