const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.db'));

db.exec(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    your_name TEXT DEFAULT '',
    your_company TEXT DEFAULT '',
    your_email TEXT DEFAULT '',
    smtp_host TEXT DEFAULT '',
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    smtp_secure INTEGER DEFAULT 0,
    send_time TEXT DEFAULT '09:00',
    invoice_counter INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO settings (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    description TEXT DEFAULT '',
    amount_type TEXT NOT NULL DEFAULT 'fixed',
    amount REAL DEFAULT 0,
    hours REAL,
    rate REAL,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    frequency_config TEXT DEFAULT '{}',
    start_date TEXT NOT NULL,
    send_time TEXT DEFAULT '09:00',
    next_run TEXT,
    last_run TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL,
    schedule_id INTEGER,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    description TEXT DEFAULT '',
    amount REAL NOT NULL,
    hours REAL,
    rate REAL,
    sent_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'sent',
    error_message TEXT
  );
`);

module.exports = { db };
