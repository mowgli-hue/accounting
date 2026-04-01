const { kv } = require('@vercel/kv');

async function getData() {
  const people = (await kv.get('people')) || [];
  const transactions = (await kv.get('transactions')) || [];
  return { people, transactions };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const data = await getData();
  return res.status(200).json(data);
};
