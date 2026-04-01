const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, id, person, type, amount, note } = req.body;

    if (action === 'delete') {
      await sql`DELETE FROM transactions WHERE id = ${id}`;
    } else {
      if (!person || !type || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid transaction data' });
      }
      await sql`
        INSERT INTO transactions (person, type, amount, note)
        VALUES (${person}, ${type}, ${parseFloat(amount)}, ${note || ''})
      `;
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
