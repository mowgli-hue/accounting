const { loadData } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    const data = await loadData();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
