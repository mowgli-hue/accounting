const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    const { person, type, amount, note } = req.body;
    if (!person || !type || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid transaction data' });
    }
    const people = (await kv.get('people')) || [];
    const transactions = (await kv.get('transactions')) || [];
    transactions.push({
      id: Date.now(),
      person,
      type,
      amount: parseFloat(amount),
      note: note || '',
      date: new Date().toISOString()
    });
    await kv.set('transactions', transactions);
    return res.status(200).json({ people, transactions });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const people = (await kv.get('people')) || [];
    let transactions = (await kv.get('transactions')) || [];
    transactions = transactions.filter(t => t.id !== id);
    await kv.set('transactions', transactions);
    return res.status(200).json({ people, transactions });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
