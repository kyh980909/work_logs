import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = join(process.cwd(), '.data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'work-logs.sqlite');
export const db = new DatabaseSync(dbPath);

db.exec(`
	PRAGMA journal_mode = WAL;
	CREATE TABLE IF NOT EXISTS attendance_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL UNIQUE,
		check_in TEXT,
		check_out TEXT,
		total_work_minutes INTEGER NOT NULL DEFAULT 0,
		note TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS outing_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		start_time TEXT NOT NULL,
		end_time TEXT,
		reason TEXT NOT NULL DEFAULT '',
		destination TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'approved',
		duration_minutes INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS leave_settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		name TEXT NOT NULL DEFAULT '홍길동',
		annual_allowance REAL NOT NULL DEFAULT 15,
		work_start_time TEXT NOT NULL DEFAULT '09:00',
		work_end_time TEXT NOT NULL DEFAULT '18:00',
		default_to TEXT NOT NULL DEFAULT '[]',
		default_cc TEXT NOT NULL DEFAULT '[]',
		email_signature TEXT NOT NULL DEFAULT '',
		templates TEXT NOT NULL DEFAULT '{}',
		gmail_email TEXT,
		gmail_access_token TEXT,
		gmail_refresh_token TEXT,
		gmail_token_expiry TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS leave_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		type TEXT NOT NULL,
		unit TEXT NOT NULL,
		amount REAL NOT NULL,
		reason TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'approved',
		note TEXT NOT NULL DEFAULT '',
		requires_document INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS mail_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL,
		recipients TEXT NOT NULL,
		cc TEXT NOT NULL,
		subject TEXT NOT NULL,
		body TEXT NOT NULL,
		sent_at TEXT NOT NULL,
		success INTEGER NOT NULL DEFAULT 0,
		provider TEXT NOT NULL DEFAULT 'gmail',
		error_message TEXT,
		message_id TEXT
	);
`);
