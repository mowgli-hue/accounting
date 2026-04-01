const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  try {
    const peopleResult = await sql`SELECT name FROM people ORDER BY id`;
    const txnResult = await sql`SELECT * FROM transactions ORDER BY date DESC`;

    const people = peopleResult.rows.map(r => r.name);
    const transactions = txnResult.rows.map(r => ({
      id: r.id,
      person: r.person,
      type: r.type,
      amount: parseFloat(r.amount),
      note: r.note,
      date: r.date
    }));

    return res.status(200).json({ people, transactions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
