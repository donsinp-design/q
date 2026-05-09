const cron = require('node-cron');
const { db } = require('./db');
const { generateInvoicePDF } = require('./pdfgen');
const { sendInvoiceEmail } = require('./mailer');

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// Returns the next Date on or after `afterDate` when the schedule fires.
function getNextOccurrence(frequency, config, hour, minute, afterDate) {
  const after = new Date(afterDate);

  if (frequency === 'daily') {
    const today = new Date(after);
    today.setHours(hour, minute, 0, 0);
    if (today >= after) return today;
    const tomorrow = new Date(after);
    tomorrow.setDate(after.getDate() + 1);
    tomorrow.setHours(hour, minute, 0, 0);
    return tomorrow;
  }

  if (frequency === 'weekly') {
    const days = config.days && config.days.length ? config.days : [1];
    for (let i = 0; i <= 7; i++) {
      const c = new Date(after);
      c.setDate(after.getDate() + i);
      c.setHours(hour, minute, 0, 0);
      if (days.includes(c.getDay()) && c >= after) return c;
    }
  }

  if (frequency === 'monthly') {
    const day = Math.min(config.day || 1, 28);
    const thisMonth = new Date(after.getFullYear(), after.getMonth(), day, hour, minute);
    if (thisMonth >= after) return thisMonth;
    let m = after.getMonth() + 1, y = after.getFullYear();
    if (m > 11) { m = 0; y++; }
    return new Date(y, m, day, hour, minute);
  }

  if (frequency === 'yearly') {
    const month = config.month ?? 0;
    const day = config.day || 1;
    const thisYear = new Date(after.getFullYear(), month, day, hour, minute);
    if (thisYear >= after) return thisYear;
    return new Date(after.getFullYear() + 1, month, day, hour, minute);
  }

  return null;
}

function calculateNextRun(schedule) {
  const { frequency, frequency_config, start_date, send_time = '09:00' } = schedule;
  const config = parseConfig(frequency_config);
  const [hour, minute] = send_time.split(':').map(Number);
  const startMidnight = new Date(start_date + 'T00:00:00');
  startMidnight.setHours(0, 0, 0, 0);
  return getNextOccurrence(frequency, config, hour, minute, startMidnight);
}

function getNextInvoiceNumber() {
  const row = db.prepare('SELECT invoice_counter FROM settings WHERE id = 1').get();
  const n = (row?.invoice_counter || 0) + 1;
  db.prepare('UPDATE settings SET invoice_counter = ? WHERE id = 1').run(n);
  return 'INV' + String(n).padStart(5, '0');
}

async function processSchedule(schedule, settings) {
  const amount = schedule.amount_type === 'hours'
    ? (schedule.hours || 0) * (schedule.rate || 0)
    : schedule.amount || 0;

  const invoiceNumber = getNextInvoiceNumber();
  const invoiceData = {
    invoice_number: invoiceNumber,
    schedule_id: schedule.id,
    client_name: schedule.client_name,
    client_email: schedule.client_email,
    description: schedule.description,
    amount,
    hours: schedule.amount_type === 'hours' ? schedule.hours : null,
    rate: schedule.amount_type === 'hours' ? schedule.rate : null,
  };

  try {
    const pdf = await generateInvoicePDF(invoiceData, settings || {});
    await sendInvoiceEmail(invoiceData, pdf, settings);

    db.prepare(`
      INSERT INTO invoices (invoice_number, schedule_id, client_name, client_email, description, amount, hours, rate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent')
    `).run(invoiceNumber, schedule.id, schedule.client_name, schedule.client_email,
           schedule.description, amount, invoiceData.hours, invoiceData.rate);

    const config = parseConfig(schedule.frequency_config);
    const [h, m] = (schedule.send_time || '09:00').split(':').map(Number);
    const nextRun = getNextOccurrence(schedule.frequency, config, h, m, new Date(Date.now() + 1000));
    db.prepare('UPDATE schedules SET next_run = ?, last_run = ? WHERE id = ?')
      .run(nextRun?.toISOString() ?? null, new Date().toISOString(), schedule.id);

  } catch (err) {
    db.prepare(`
      INSERT INTO invoices (invoice_number, schedule_id, client_name, client_email, description, amount, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)
    `).run(invoiceNumber, schedule.id, schedule.client_name, schedule.client_email,
           schedule.description, amount, err.message);
    throw err;
  }
}

function startScheduler() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const due = db.prepare(`
      SELECT * FROM schedules WHERE active = 1 AND next_run IS NOT NULL AND next_run <= ?
    `).all(now.toISOString());

    for (const schedule of due) {
      try {
        await processSchedule(schedule, settings);
        console.log(`[scheduler] Sent ${schedule.client_name} — invoice dispatched`);
      } catch (err) {
        console.error(`[scheduler] Failed schedule ${schedule.id}:`, err.message);
      }
    }
  });
  console.log('[scheduler] Started — checking every minute');
}

module.exports = { calculateNextRun, processSchedule, startScheduler };
