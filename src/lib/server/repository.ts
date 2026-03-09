import { db } from './db.ts';
import type {
	AppSettings,
	AttendanceLog,
	LeaveEntry,
	LeaveStatus,
	LeaveType,
	LeaveUnit,
	MailHistoryEntry,
	MailTemplateMap,
	OutingEntry,
	OutingStatus
} from '$lib/types';

const defaultTemplates: MailTemplateMap = {
	check_in_subject: '[출근] {{name}} {{date}} {{time}}',
	check_in_body:
		'{{name}} 전문연구요원입니다.\n{{date}} {{time}} 출근하였습니다.\n금일 연구업무를 시작합니다.\n\n{{signature}}',
	check_out_subject: '[퇴근] {{name}} {{date}} {{time}}',
	check_out_body:
		'{{name}} 전문연구요원입니다.\n{{date}} {{time}} 퇴근합니다.\n금일 누적 주간 복무시간은 {{weekly_total_hours}}입니다.\n\n{{signature}}',
	outing_subject: '[외출] {{name}} {{date}} {{time}}',
	outing_body:
		'{{name}} 전문연구요원입니다.\n{{date}} {{time}} 외출합니다.\n사유: {{reason}}\n행선지: {{destination}}\n예정 복귀시각: {{return_time}}\n\n{{signature}}',
	return_subject: '[복귀] {{name}} {{date}} {{time}}',
	return_body:
		'{{name}} 전문연구요원입니다.\n{{date}} {{time}} 외출 복귀하였습니다.\n사유: {{reason}}\n\n{{signature}}'
};

type SettingsRow = {
	name: string;
	annual_allowance: number;
	work_start_time: string;
	work_end_time: string;
	default_to: string;
	default_cc: string;
	email_signature: string;
	templates: string;
	gmail_email: string | null;
	gmail_access_token: string | null;
	gmail_refresh_token: string | null;
	gmail_token_expiry: string | null;
};

function nowIso() {
	return new Date().toISOString();
}

function parseJsonArray(value: string) {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
	} catch {
		return [];
	}
}

function parseTemplates(value: string) {
	try {
		return { ...defaultTemplates, ...JSON.parse(value) } as MailTemplateMap;
	} catch {
		return defaultTemplates;
	}
}

function ensureSettingsRow() {
	const existing = db.prepare('SELECT id FROM leave_settings WHERE id = 1').get() as
		| { id: number }
		| undefined;
	if (!existing) {
		const now = nowIso();
		db.prepare(
			`INSERT INTO leave_settings (
				id, name, annual_allowance, work_start_time, work_end_time, default_to, default_cc,
				email_signature, templates, created_at, updated_at
			) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			'홍길동',
			15,
			'09:00',
			'18:00',
			JSON.stringify([]),
			JSON.stringify([]),
			'감사합니다.',
			JSON.stringify(defaultTemplates),
			now,
			now
		);
	}
}

ensureSettingsRow();

export function getStoredTokens() {
	const row = db
		.prepare(
			'SELECT gmail_email, gmail_access_token, gmail_refresh_token, gmail_token_expiry FROM leave_settings WHERE id = 1'
		)
		.get() as
		| {
				gmail_email: string | null;
				gmail_access_token: string | null;
				gmail_refresh_token: string | null;
				gmail_token_expiry: string | null;
		  }
		| undefined;
	return (
		row ?? {
			gmail_email: null,
			gmail_access_token: null,
			gmail_refresh_token: null,
			gmail_token_expiry: null
		}
	);
}

export function storeGmailTokens(params: {
	email: string | null;
	accessToken: string;
	refreshToken: string | null;
	expiry: string | null;
}) {
	const now = nowIso();
	db.prepare(
		`UPDATE leave_settings
		 SET gmail_email = ?,
		     gmail_access_token = ?,
		     gmail_refresh_token = COALESCE(?, gmail_refresh_token),
		     gmail_token_expiry = ?,
		     updated_at = ?
		 WHERE id = 1`
	).run(params.email, params.accessToken, params.refreshToken, params.expiry, now);
}

export function clearGmailTokens() {
	const now = nowIso();
	db.prepare(
		`UPDATE leave_settings
		 SET gmail_email = NULL,
		     gmail_access_token = NULL,
		     gmail_refresh_token = NULL,
		     gmail_token_expiry = NULL,
		     updated_at = ?
		 WHERE id = 1`
	).run(now);
}

export function getSettings(): AppSettings {
	const row = db.prepare('SELECT * FROM leave_settings WHERE id = 1').get() as SettingsRow;
	return {
		name: row.name,
		annualAllowance: row.annual_allowance,
		workStartTime: row.work_start_time,
		workEndTime: row.work_end_time,
		defaultTo: parseJsonArray(row.default_to),
		defaultCc: parseJsonArray(row.default_cc),
		emailSignature: row.email_signature,
		gmailConnected: Boolean(row.gmail_refresh_token || row.gmail_access_token),
		gmailEmail: row.gmail_email,
		templates: parseTemplates(row.templates)
	};
}

export function updateSettings(input: Partial<AppSettings>) {
	const current = getSettings();
	const next: AppSettings = {
		...current,
		...input,
		templates: {
			...current.templates,
			...(input.templates ?? {})
		}
	};
	const now = nowIso();
	db.prepare(
		`UPDATE leave_settings
		 SET name = ?,
		     annual_allowance = ?,
		     work_start_time = ?,
		     work_end_time = ?,
		     default_to = ?,
		     default_cc = ?,
		     email_signature = ?,
		     templates = ?,
		     updated_at = ?
		 WHERE id = 1`
	).run(
		next.name,
		next.annualAllowance,
		next.workStartTime,
		next.workEndTime,
		JSON.stringify(next.defaultTo),
		JSON.stringify(next.defaultCc),
		next.emailSignature,
		JSON.stringify(next.templates),
		now
	);
	return getSettings();
}

export function listAttendanceLogs(limit = 30): AttendanceLog[] {
	return db
		.prepare(
			`SELECT id, date, check_in AS checkIn, check_out AS checkOut, total_work_minutes AS totalWorkMinutes,
			        note, created_at AS createdAt, updated_at AS updatedAt
			 FROM attendance_logs
			 ORDER BY date DESC
			 LIMIT ?`
		)
		.all(limit) as unknown as AttendanceLog[];
}

export function getAttendanceLogByDate(date: string): AttendanceLog | null {
	return (
		(db
			.prepare(
				`SELECT id, date, check_in AS checkIn, check_out AS checkOut, total_work_minutes AS totalWorkMinutes,
			        note, created_at AS createdAt, updated_at AS updatedAt
			 FROM attendance_logs
			 WHERE date = ?`
			)
			.get(date) as AttendanceLog | undefined) ?? null
	);
}

export function upsertAttendanceLog(input: {
	date: string;
	checkIn?: string | null;
	checkOut?: string | null;
	totalWorkMinutes: number;
	note?: string;
}) {
	const existing = getAttendanceLogByDate(input.date);
	const now = nowIso();
	if (existing) {
		db.prepare(
			`UPDATE attendance_logs
			 SET check_in = ?,
			     check_out = ?,
			     total_work_minutes = ?,
			     note = ?,
			     updated_at = ?
			 WHERE date = ?`
		).run(
			input.checkIn ?? existing.checkIn,
			input.checkOut ?? existing.checkOut,
			input.totalWorkMinutes,
			input.note ?? existing.note,
			now,
			input.date
		);
	} else {
		db.prepare(
			`INSERT INTO attendance_logs (
				date, check_in, check_out, total_work_minutes, note, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`
		).run(
			input.date,
			input.checkIn ?? null,
			input.checkOut ?? null,
			input.totalWorkMinutes,
			input.note ?? '',
			now,
			now
		);
	}
	return getAttendanceLogByDate(input.date);
}

export function listOutings(limit = 50): OutingEntry[] {
	return db
		.prepare(
			`SELECT id, date, start_time AS startTime, end_time AS endTime, reason, destination,
			        status, duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
			 FROM outing_entries
			 ORDER BY date DESC, start_time DESC
			 LIMIT ?`
		)
		.all(limit) as unknown as OutingEntry[];
}

export function listOutingsByDate(date: string): OutingEntry[] {
	return db
		.prepare(
			`SELECT id, date, start_time AS startTime, end_time AS endTime, reason, destination,
			        status, duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
			 FROM outing_entries
			 WHERE date = ?
			 ORDER BY start_time ASC`
		)
		.all(date) as unknown as OutingEntry[];
}

export function getActiveOuting(date: string) {
	return (
		(db
			.prepare(
				`SELECT id, date, start_time AS startTime, end_time AS endTime, reason, destination,
			        status, duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
			 FROM outing_entries
			 WHERE date = ? AND end_time IS NULL
			 ORDER BY start_time DESC
			 LIMIT 1`
			)
			.get(date) as OutingEntry | undefined) ?? null
	);
}

export function createOuting(input: {
	date: string;
	startTime: string;
	reason?: string;
	destination?: string;
	status?: OutingStatus;
}) {
	const now = nowIso();
	db.prepare(
		`INSERT INTO outing_entries (
			date, start_time, reason, destination, status, duration_minutes, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
	).run(
		input.date,
		input.startTime,
		input.reason ?? '',
		input.destination ?? '',
		input.status ?? 'approved',
		now,
		now
	);
	return getActiveOuting(input.date);
}

export function updateOuting(
	id: number,
	input: Partial<{
		endTime: string | null;
		reason: string;
		destination: string;
		status: OutingStatus;
		durationMinutes: number;
	}>
) {
	const current = db
		.prepare(
			`SELECT id, date, start_time AS startTime, end_time AS endTime, reason, destination,
			        status, duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
			 FROM outing_entries WHERE id = ?`
		)
		.get(id) as OutingEntry | undefined;
	if (!current) return null;
	const now = nowIso();
	db.prepare(
		`UPDATE outing_entries
		 SET end_time = ?,
		     reason = ?,
		     destination = ?,
		     status = ?,
		     duration_minutes = ?,
		     updated_at = ?
		 WHERE id = ?`
	).run(
		input.endTime === undefined ? current.endTime : input.endTime,
		input.reason ?? current.reason,
		input.destination ?? current.destination,
		input.status ?? current.status,
		input.durationMinutes ?? current.durationMinutes,
		now,
		id
	);
	return db
		.prepare(
			`SELECT id, date, start_time AS startTime, end_time AS endTime, reason, destination,
			        status, duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
			 FROM outing_entries WHERE id = ?`
		)
		.get(id) as unknown as OutingEntry;
}

export function listLeaveEntries(limit = 100): LeaveEntry[] {
	return db
		.prepare(
			`SELECT id, date, type, unit, amount, reason, status, note,
			        requires_document AS requiresDocument, created_at AS createdAt, updated_at AS updatedAt
			 FROM leave_entries
			 ORDER BY date DESC, id DESC
			 LIMIT ?`
		)
		.all(limit) as unknown as LeaveEntry[];
}

export function createLeaveEntry(input: {
	date: string;
	type: LeaveType;
	unit: LeaveUnit;
	amount: number;
	reason?: string;
	status?: LeaveStatus;
	note?: string;
	requiresDocument?: boolean;
}) {
	const now = nowIso();
	db.prepare(
		`INSERT INTO leave_entries (
			date, type, unit, amount, reason, status, note, requires_document, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		input.date,
		input.type,
		input.unit,
		input.amount,
		input.reason ?? '',
		input.status ?? 'approved',
		input.note ?? '',
		input.requiresDocument ? 1 : 0,
		now,
		now
	);
	return listLeaveEntries(1)[0] ?? null;
}

export function updateLeaveEntry(
	id: number,
	input: Partial<{
		date: string;
		type: LeaveType;
		unit: LeaveUnit;
		amount: number;
		reason: string;
		status: LeaveStatus;
		note: string;
		requiresDocument: boolean;
	}>
) {
	const current = db
		.prepare(
			`SELECT id, date, type, unit, amount, reason, status, note,
			        requires_document AS requiresDocument, created_at AS createdAt, updated_at AS updatedAt
			 FROM leave_entries WHERE id = ?`
		)
		.get(id) as LeaveEntry | undefined;
	if (!current) return null;
	const now = nowIso();
	db.prepare(
		`UPDATE leave_entries
		 SET date = ?,
		     type = ?,
		     unit = ?,
		     amount = ?,
		     reason = ?,
		     status = ?,
		     note = ?,
		     requires_document = ?,
		     updated_at = ?
		 WHERE id = ?`
	).run(
		input.date ?? current.date,
		input.type ?? current.type,
		input.unit ?? current.unit,
		input.amount ?? current.amount,
		input.reason ?? current.reason,
		input.status ?? current.status,
		input.note ?? current.note,
		input.requiresDocument === undefined
			? Number(current.requiresDocument)
			: Number(input.requiresDocument),
		now,
		id
	);
	return db
		.prepare(
			`SELECT id, date, type, unit, amount, reason, status, note,
			        requires_document AS requiresDocument, created_at AS createdAt, updated_at AS updatedAt
			 FROM leave_entries WHERE id = ?`
		)
		.get(id) as unknown as LeaveEntry;
}

export function deleteLeaveEntry(id: number) {
	db.prepare('DELETE FROM leave_entries WHERE id = ?').run(id);
}

export function createMailHistoryEntry(input: Omit<MailHistoryEntry, 'id'>) {
	db.prepare(
		`INSERT INTO mail_history (
			type, recipients, cc, subject, body, sent_at, success, provider, error_message, message_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		input.type,
		JSON.stringify(input.recipients),
		JSON.stringify(input.cc),
		input.subject,
		input.body,
		input.sentAt,
		input.success ? 1 : 0,
		input.provider,
		input.errorMessage,
		input.messageId
	);
}

export function listMailHistory(limit = 20): MailHistoryEntry[] {
	const rows = db
		.prepare(
			`SELECT id, type, recipients, cc, subject, body, sent_at AS sentAt,
			        success, provider, error_message AS errorMessage, message_id AS messageId
			 FROM mail_history
			 ORDER BY sent_at DESC
			 LIMIT ?`
		)
		.all(limit) as Array<{
		id: number;
		type: MailHistoryEntry['type'];
		recipients: string;
		cc: string;
		subject: string;
		body: string;
		sentAt: string;
		success: number;
		provider: string;
		errorMessage: string | null;
		messageId: string | null;
	}>;

	return rows.map((entry) => ({
		...entry,
		recipients: parseJsonArray(entry.recipients),
		cc: parseJsonArray(entry.cc),
		success: Boolean(entry.success)
	}));
}
