const { put, list } = require('@vercel/blob');

const DATA_KEY = 'accounting-data.json';
const DEFAULT_DATA = { people: [], transactions: [] };

async function loadData() {
  try {
    const { blobs } = await list({ prefix: DATA_KEY });
    if (blobs.length === 0) return DEFAULT_DATA;
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return DEFAULT_DATA;
  }
}

async function saveData(data) {
  await put(DATA_KEY, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
  });
}

module.exports = { loadData, saveData };
