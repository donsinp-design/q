const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./lib/db');
const { generateInvoicePDF } = require('./lib/pdfgen');
const { sendTestEmail } = require('./lib/mailer');
const { calculateNextRun, processSchedule, startScheduler } = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

if (PROD) app.use(express.static(path.join(__dirname, 'dist')));

// ── Settings ────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};
  res.json(s);
});

app.post('/api/settings', (req, res) => {
  const { your_name, your_company, your_email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, send_time } = req.body;
  db.prepare(`
    UPDATE settings SET your_name=?, your_company=?, your_email=?, smtp_host=?, smtp_port=?,
    smtp_user=?, smtp_pass=?, smtp_secure=?, send_time=? WHERE id=1
  `).run(your_name||'', your_company||'', your_email||'', smtp_host||'', smtp_port||587,
         smtp_user||'', smtp_pass||'', smtp_secure ? 1 : 0, send_time||'09:00');
  res.json({ success: true });
});

app.post('/api/settings/test-email', async (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    await sendTestEmail(s);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Schedules ────────────────────────────────────────────────
app.get('/api/schedules', (req, res) => {
  const rows = db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, active: !!r.active })));
});

app.post('/api/schedules', (req, res) => {
  const { client_name, client_email, description, amount_type, amount, hours, rate,
          frequency, frequency_config, start_date, send_time } = req.body;

  const settings = db.prepare('SELECT send_time FROM settings WHERE id = 1').get();
  const st = send_time || settings?.send_time || '09:00';
  const calcAmount = amount_type === 'hours' ? (hours * rate) : amount;
  const nextRun = calculateNextRun({ frequency, frequency_config, start_date, send_time: st });

  const r = db.prepare(`
    INSERT INTO schedules (client_name, client_email, description, amount_type, amount, hours, rate,
      frequency, frequency_config, start_date, send_time, next_run, active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
  `).run(client_name, client_email, description||'', amount_type, calcAmount,
         hours||null, rate||null, frequency, JSON.stringify(frequency_config||{}),
         start_date, st, nextRun?.toISOString()??null);

  res.json({ id: r.lastInsertRowid, success: true });
});

app.put('/api/schedules/:id', (req, res) => {
  const { client_name, client_email, description, amount_type, amount, hours, rate,
          frequency, frequency_config, start_date, send_time } = req.body;
  const calcAmount = amount_type === 'hours' ? (hours * rate) : amount;
  const nextRun = calculateNextRun({ frequency, frequency_config, start_date, send_time });

  db.prepare(`
    UPDATE schedules SET client_name=?, client_email=?, description=?, amount_type=?, amount=?,
    hours=?, rate=?, frequency=?, frequency_config=?, start_date=?, send_time=?, next_run=?
    WHERE id=?
  `).run(client_name, client_email, description||'', amount_type, calcAmount,
         hours||null, rate||null, frequency, JSON.stringify(frequency_config||{}),
         start_date, send_time, nextRun?.toISOString()??null, req.params.id);

  res.json({ success: true });
});

app.delete('/api/schedules/:id', (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/schedules/:id/toggle', (req, res) => {
  const s = db.prepare('SELECT active FROM schedules WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE schedules SET active=? WHERE id=?').run(s.active ? 0 : 1, req.params.id);
  res.json({ success: true, active: !s.active });
});

app.post('/api/schedules/:id/send-now', async (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM schedules WHERE id=?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    await processSchedule(s, settings);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Invoices ─────────────────────────────────────────────────
app.get('/api/invoices', (req, res) => {
  res.json(db.prepare('SELECT * FROM invoices ORDER BY sent_at DESC LIMIT 200').all());
});

app.get('/api/invoices/:id/pdf', async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const settings = db.prepare('SELECT * FROM settings WHERE id=1').get() || {};
  const pdf = await generateInvoicePDF(inv, settings);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${inv.invoice_number}.pdf"`);
  res.send(pdf);
});

// SPA fallback
if (PROD) app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Invoice Scheduler running on http://localhost:${PORT}`);
  startScheduler();
});
