require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');

const app      = express();
const PORT     = process.env.PORT || 3001;
const fs       = require('fs');
const dashHTML = path.join(__dirname, '..', 'dashboard', 'index.html');

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  family: 4,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected idle client error:', err.message);
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

app.use(express.json());

// ── Serve dashboard — inject API_KEY from env at request time ────────────────
app.get('/dashboard', (req, res) => {
  const html = fs.readFileSync(dashHTML, 'utf8').replace(
    'window.__API_KEY__ || \'\'',
    `'${process.env.API_KEY}'`
  );
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'Server not configured: API_KEY missing' });
  }
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — no auth required (for uptime monitors)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// GET /api/stats?month=YYYY-MM
// Aggregated stats for a month, with trend vs previous month
app.get('/api/stats', requireApiKey, async (req, res) => {
  try {
    let year, month;

    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      [year, month] = req.query.month.split('-').map(Number);
    } else {
      const now = new Date();
      year  = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const currentStart = new Date(year, month - 1, 1);
    const currentEnd   = new Date(year, month, 1);
    const prevStart    = new Date(year, month - 2, 1);
    const prevEnd      = currentStart;

    const statsQuery = `
      SELECT
        COALESCE(SUM(service_price), 0)::NUMERIC(10,2)             AS total_revenue,
        COUNT(*)::INT                                               AS total_appointments,
        COALESCE(SUM(time_saved_minutes), 0)::INT                   AS total_minutes_saved,
        COUNT(*) FILTER (WHERE event_type = 'appointment_booked')::INT      AS booked,
        COUNT(*) FILTER (WHERE event_type = 'appointment_rescheduled')::INT AS rescheduled,
        COUNT(*) FILTER (WHERE event_type = 'appointment_cancelled')::INT   AS cancelled,
        COUNT(*) FILTER (WHERE event_type = 'inquiry_answered')::INT        AS inquiries
      FROM julieta_events
      WHERE created_at >= $1 AND created_at < $2
    `;

    const [cur, prev] = await Promise.all([
      pool.query(statsQuery, [currentStart, currentEnd]),
      pool.query(statsQuery, [prevStart, prevEnd]),
    ]);

    const c = cur.rows[0];
    const p = prev.rows[0];

    function trend(a, b) {
      const ca = parseFloat(a) || 0;
      const cb = parseFloat(b) || 0;
      if (cb === 0) return null;
      return Math.round(((ca - cb) / cb) * 100);
    }

    res.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      current: {
        total_revenue:       parseFloat(c.total_revenue),
        total_appointments:  c.total_appointments,
        total_hours_saved:   Math.round((c.total_minutes_saved / 60) * 10) / 10,
        total_minutes_saved: c.total_minutes_saved,
        booked:              c.booked,
        rescheduled:         c.rescheduled,
        cancelled:           c.cancelled,
        inquiries:           c.inquiries,
      },
      previous: {
        total_revenue:      parseFloat(p.total_revenue),
        total_appointments: p.total_appointments,
        total_hours_saved:  Math.round((p.total_minutes_saved / 60) * 10) / 10,
      },
      trends: {
        revenue:      trend(c.total_revenue,      p.total_revenue),
        appointments: trend(c.total_appointments, p.total_appointments),
        hours_saved:  trend(c.total_minutes_saved, p.total_minutes_saved),
      },
    });

  } catch (err) {
    console.error('/api/stats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events?limit=20
// Latest events for activity feed
app.get('/api/events', requireApiKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const result = await pool.query(`
      SELECT id, created_at, event_type, client_name, service_name,
             service_price, appointment_date, conversation_id,
             time_saved_minutes, notes
      FROM julieta_events
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ events: result.rows, count: result.rows.length });

  } catch (err) {
    console.error('/api/events error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/services?month=YYYY-MM
// Top services breakdown for the month
app.get('/api/services', requireApiKey, async (req, res) => {
  try {
    let year, month;
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      [year, month] = req.query.month.split('-').map(Number);
    } else {
      const now = new Date();
      year  = now.getFullYear();
      month = now.getMonth() + 1;
    }
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const result = await pool.query(`
      SELECT
        COALESCE(service_name, 'Sin especificar') AS service_name,
        COUNT(*)::INT                              AS count,
        COALESCE(SUM(service_price), 0)::NUMERIC  AS revenue
      FROM julieta_events
      WHERE created_at >= $1 AND created_at < $2
        AND event_type = 'appointment_booked'
      GROUP BY service_name
      ORDER BY count DESC
      LIMIT 8
    `, [start, end]);

    res.json({ services: result.rows });
  } catch (err) {
    console.error('/api/services error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Julieta Dashboard API → http://localhost:${PORT}`);
  console.log(`Dashboard            → http://localhost:${PORT}/dashboard`);
  console.log(`Health check         → http://localhost:${PORT}/health`);
});
