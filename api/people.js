const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const people = (await kv.get('people')) || [];
    if (people.includes(name.trim())) {
      return res.status(409).json({ error: 'Person already exists' });
    }
    people.push(name.trim());
    await kv.set('people', people);
    const transactions = (await kv.get('transactions')) || [];
    return res.status(200).json({ people, transactions });
  }

  if (req.method === 'DELETE') {
    const { name } = req.body;
    let people = (await kv.get('people')) || [];
    let transactions = (await kv.get('transactions')) || [];
    people = people.filter(p => p !== name);
    transactions = transactions.filter(t => t.person !== name);
    await kv.set('people', people);
    await kv.set('transactions', transactions);
    return res.status(200).json({ people, transactions });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
