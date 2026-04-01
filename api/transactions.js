const { loadData, saveData } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await loadData();
    const { action, id, person, type, amount, note } = req.body;

    if (action === 'delete') {
      data.transactions = data.transactions.filter(t => t.id !== id);
    } else {
      if (!person || !type || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid transaction data' });
      }
      data.transactions.push({
        id: Date.now(),
        person,
        type,
        amount: parseFloat(amount),
        note: note || '',
        date: new Date().toISOString()
      });
    }

    await saveData(data);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
