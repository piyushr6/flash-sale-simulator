const express = require('express');
const { createClient } = require('redis');
const cors = require('cors');
const os = require('os');
const http = require('http');       // built-in — for Docker socket, no new dep

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: "http://localhost:8080",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// ── Config ──────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const MYSQL_HOST = process.env.MYSQL_HOST || 'mysql';
const MYSQL_USER = process.env.MYSQL_USER || 'flashuser';
const MYSQL_PASS = process.env.MYSQL_PASS || 'flashpass';
const MYSQL_DB = process.env.MYSQL_DB || 'flashsale';
const POD_NAME = process.env.HOSTNAME || os.hostname() || 'local';

// ── Redis client ────────────────────────────────────────────────
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('[REDIS] Error:', err.message));
redisClient.on('ready', () => console.log(`[API][${POD_NAME}] Redis ready`));

// ── Lazy MySQL pool — only used for stats (read-only) ──────────
let _pool = null;
async function getPool() {
  if (_pool) return _pool;
  try {
    const mysql2 = require('mysql2/promise');
    _pool = await mysql2.createPool({
      host: MYSQL_HOST, user: MYSQL_USER,
      password: MYSQL_PASS, database: MYSQL_DB,
      connectionLimit: 2, connectTimeout: 3000
    });
    return _pool;
  } catch (e) {
    return null;
  }
}

// ── In-memory rolling log (last 200 entries) ───────────────────
const rollingLog = [];
function addLog(level, msg) {
  rollingLog.push({ ts: new Date().toISOString(), level, pod: POD_NAME, msg });
  if (rollingLog.length > 200) rollingLog.shift();
  const tag = level === 'error' ? console.error : console.log;
  tag(`[API][${POD_NAME}] ${msg}`);
}

// ── Docker socket helper ─────────────────────────────────────────
// Reads from /var/run/docker.sock (mounted via docker-compose volume)
function dockerGet(path) {
  return new Promise(resolve => {
    const req = http.request(
      { socketPath: '/var/run/docker.sock', path, method: 'GET', headers: { Host: 'localhost' } },
      res => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', pod: POD_NAME, time: new Date().toISOString() });
});

// POST /order — core: receive order → push to Redis queue
app.post('/order', async (req, res) => {
  const { product = 'Unknown Product', orderId } = req.body;
  const order = {
    product, orderId,
    server: POD_NAME,
    timestamp: new Date().toISOString()
  };
  try {
    await redisClient.rPush('orders', JSON.stringify(order));
    addLog('info', `Order #${orderId} → "${product}" → Redis`);
    res.status(200).json({
      message: 'Order placed', handledBy: POD_NAME,
      orderId, product, queued: true
    });
  } catch (err) {
    addLog('error', `Redis push failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to queue order', detail: err.message });
  }
});

// GET /stats — all live metrics in one call (powers the dashboard)
app.get('/stats', async (req, res) => {
  const out = {
    redisQueueDepth: 0,
    dbRowCount: 0,
    dbByPod: [],
    containers: [],
    pod: POD_NAME,
    time: new Date().toISOString()
  };

  // 1. Redis queue depth
  try { out.redisQueueDepth = await redisClient.lLen('orders'); } catch { }

  // 2. MySQL counts (via lazy pool — non-blocking, best-effort)
  try {
    const p = await getPool();
    if (p) {
      const [[row]] = await p.execute('SELECT COUNT(*) AS cnt FROM orders');
      out.dbRowCount = Number(row.cnt);
      const [rows] = await p.execute(
        'SELECT server AS pod, COUNT(*) AS cnt FROM orders GROUP BY server ORDER BY cnt DESC'
      );
      out.dbByPod = rows.map(r => ({ pod: r.pod, cnt: Number(r.cnt) }));
    }
  } catch { }

  // 3. Docker containers (requires /var/run/docker.sock mounted)
  try {
    const list = await dockerGet('/containers/json?all=false');
    if (Array.isArray(list)) {
      out.containers = list
        .filter(c => (c.Names || []).some(n => /flash/.test(n)))
        .map(c => ({
          name: (c.Names[0] || '').replace(/^\//, ''),
          image: c.Image,
          status: c.Status,
          state: c.State,
          id: (c.Id || '').slice(0, 12)
        }));
    }
  } catch { }

  res.json(out);
});

// GET /logs — last N rolling log lines from this pod
app.get('/logs', (req, res) => {
  const n = Math.min(parseInt(req.query.n || '100'), 200);
  res.json(rollingLog.slice(-n));
});

// GET /queue-depth — backward compat
app.get('/queue-depth', async (req, res) => {
  try {
    const depth = await redisClient.lLen('orders');
    res.json({ queue: 'orders', depth, pod: POD_NAME });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────
async function start() {
  addLog('info', `Starting. Redis=${REDIS_URL}`);
  await redisClient.connect();
  app.listen(PORT, () => addLog('info', `✅ Listening on :${PORT}`));
}

start().catch(err => {
  console.error('[API] Fatal startup error:', err.message);
  process.exit(1);
});