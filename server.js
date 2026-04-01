const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ people: [], transactions: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  // Serve the frontend
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // API: Get all data
  if (req.method === 'GET' && req.url === '/api/data') {
    const data = loadData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API: Add person
  if (req.method === 'POST' && req.url === '/api/people') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { name } = JSON.parse(body);
      const data = loadData();
      if (!name || !name.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Name is required' }));
        return;
      }
      if (data.people.includes(name.trim())) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Person already exists' }));
        return;
      }
      data.people.push(name.trim());
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  // API: Delete person
  if (req.method === 'DELETE' && req.url.startsWith('/api/people/')) {
    const name = decodeURIComponent(req.url.split('/api/people/')[1]);
    const data = loadData();
    data.people = data.people.filter(p => p !== name);
    data.transactions = data.transactions.filter(t => t.person !== name);
    saveData(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API: Add transaction
  if (req.method === 'POST' && req.url === '/api/transactions') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { person, type, amount, note } = JSON.parse(body);
      const data = loadData();
      if (!person || !type || !amount || amount <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid transaction data' }));
        return;
      }
      data.transactions.push({
        id: Date.now(),
        person,
        type,
        amount: parseFloat(amount),
        note: note || '',
        date: new Date().toISOString()
      });
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  // API: Delete transaction
  if (req.method === 'DELETE' && req.url.startsWith('/api/transactions/')) {
    const id = parseInt(req.url.split('/api/transactions/')[1]);
    const data = loadData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    saveData(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Accounting Tracker running at http://localhost:${PORT}`);
});
