const { loadData, saveData } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await loadData();
    const { action, name } = req.body;

    if (action === 'delete') {
      data.people = data.people.filter(p => p !== name);
      data.transactions = data.transactions.filter(t => t.person !== name);
    } else {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (data.people.includes(name.trim())) {
        return res.status(409).json({ error: 'Person already exists' });
      }
      data.people.push(name.trim());
    }

    await saveData(data);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
