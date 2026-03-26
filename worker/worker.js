const { createClient } = require('redis');
const mysql = require('mysql2/promise');
const os = require('os');

// ── Identity ─────────────────────────────────────────────────────
const WORKER_ID = process.env.HOSTNAME || os.hostname() || 'worker-local';

// ── Config ────────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const MYSQL_HOST = process.env.MYSQL_HOST || 'mysql';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306');
const MYSQL_USER = process.env.MYSQL_USER || 'flashuser';
const MYSQL_PASS = process.env.MYSQL_PASS || 'flashpass';
const MYSQL_DB = process.env.MYSQL_DB || 'flashsale';
const QUEUE_NAME = 'orders';
const BLOCK_TIMEOUT_SEC = 2; // BLPOP timeout in seconds

// ── State ─────────────────────────────────────────────────────────
let processed = 0;
let startTime = Date.now();

// ── Redis ─────────────────────────────────────────────────────────
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error(`[WORKER][${WORKER_ID}] Redis error:`, err.message));

// ── MySQL pool ────────────────────────────────────────────────────
let pool;

async function createPool() {
  pool = await mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });
  console.log(`[WORKER][${WORKER_ID}] MySQL pool created → ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`);
}

// ── Ensure table exists ───────────────────────────────────────────
async function ensureTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      product    VARCHAR(255) NOT NULL,
      order_ref  VARCHAR(255),
      timestamp  DATETIME     NOT NULL,
      server     VARCHAR(255) NOT NULL,
      worker     VARCHAR(255) NOT NULL,
      INDEX idx_timestamp (timestamp),
      INDEX idx_server    (server)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log(`[WORKER][${WORKER_ID}] ✅ Table "orders" ready`);
}

// ── Process one order ─────────────────────────────────────────────
async function processOrder(raw) {
  let order;
  try {
    order = JSON.parse(raw);
  } catch (e) {
    console.error(`[WORKER][${WORKER_ID}] ❌ JSON parse error:`, e.message, '| raw:', raw);
    return;
  }

  const { product, orderId, server, timestamp } = order;

  console.log(`[WORKER][${WORKER_ID}] 📦 Processing order #${orderId}`);

  try {
    const [result] = await pool.execute(
      'INSERT INTO orders (product, order_ref, timestamp, server, worker) VALUES (?, ?, ?, ?, ?)',
      [product, String(orderId), new Date(timestamp), server || 'unknown', WORKER_ID]
    );

    // ADD THIS FUNCTION (top or bottom)
    function sleep(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    // 🔥 ADD DELAY HERE
    await sleep(300);   // try 300–500ms for nice visualization

    processed++;
    console.log(`[WORKER][${WORKER_ID}] ✅ Inserted id=${result.insertId}`);

  } catch (err) {
    console.error(`[WORKER][${WORKER_ID}] ❌ MySQL insert error:`, err.message);
    try {
      await redisClient.lPush(QUEUE_NAME, raw);
    } catch { }
  }
}

// ── Main loop ─────────────────────────────────────────────────────
async function runLoop() {
  console.log(`[WORKER][${WORKER_ID}] 🔁 Starting processing loop on queue "${QUEUE_NAME}" ...`);

  while (true) {
    try {
      // BLPOP blocks until an item is available (timeout = BLOCK_TIMEOUT_SEC)
      const result = await redisClient.blPop(QUEUE_NAME, BLOCK_TIMEOUT_SEC);

      if (result) {
        // result = { key: 'orders', element: '<json>' }
        await processOrder(result.element);
      }
      // if null → timeout, loop again
    } catch (err) {
      console.error(`[WORKER][${WORKER_ID}] Loop error:`, err.message);
      // Brief pause before retrying to avoid tight error loops
      await sleep(2000);
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Retry connect helper ──────────────────────────────────────────
async function withRetry(fn, label, maxAttempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      console.error(`[WORKER][${WORKER_ID}] ${label} attempt ${attempt}/${maxAttempts} failed:`, err.message);
      if (attempt < maxAttempts) {
        console.log(`[WORKER][${WORKER_ID}] Retrying in ${delayMs / 1000}s...`);
        await sleep(delayMs);
      } else {
        throw new Error(`${label} failed after ${maxAttempts} attempts`);
      }
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────
async function start() {
  console.log(`[WORKER][${WORKER_ID}] 🚀 Worker starting...`);
  console.log(`[WORKER][${WORKER_ID}] Redis  : ${REDIS_URL}`);
  console.log(`[WORKER][${WORKER_ID}] MySQL  : ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`);

  await withRetry(() => redisClient.connect(), 'Redis connect');
  await withRetry(createPool, 'MySQL pool create');
  await withRetry(ensureTable, 'MySQL table check');

  console.log(`[WORKER][${WORKER_ID}] ✅ All connections ready. Processing queue...`);
  await runLoop();
}

// ── Graceful shutdown ─────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log(`[WORKER][${WORKER_ID}] SIGTERM received, shutting down gracefully...`);
  await redisClient.quit().catch(() => { });
  if (pool) await pool.end().catch(() => { });
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(`[WORKER][${WORKER_ID}] SIGINT received`);
  await redisClient.quit().catch(() => { });
  if (pool) await pool.end().catch(() => { });
  process.exit(0);
});

start().catch(err => {
  console.error(`[WORKER][${WORKER_ID}] Fatal error:`, err.message);
  process.exit(1);
});
