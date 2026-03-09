export type MailTemplateType = 'check_in' | 'check_out' | 'outing' | 'return';
export type LeaveType = 'annual' | 'sick' | 'absence';
export type LeaveUnit = 'day' | 'hour';
export type LeaveStatus = 'approved' | 'unauthorized';
export type OutingStatus = 'approved' | 'unauthorized';

export interface AttendanceLog {
	id: number;
	date: string;
	checkIn: string | null;
	checkOut: string | null;
	totalWorkMinutes: number;
	note: string;
	createdAt: string;
	updatedAt: string;
}

export interface OutingEntry {
	id: number;
	date: string;
	startTime: string;
	endTime: string | null;
	reason: string;
	destination: string;
	status: OutingStatus;
	durationMinutes: number;
	createdAt: string;
	updatedAt: string;
}

export interface LeaveEntry {
	id: number;
	date: string;
	type: LeaveType;
	unit: LeaveUnit;
	amount: number;
	reason: string;
	status: LeaveStatus;
	note: string;
	requiresDocument: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface WeeklyWorkDaySummary {
	date: string;
	label: string;
	totalMinutes: number;
	deficitMinutes: number;
}

export interface WeeklyWorkSummary {
	weekStart: string;
	weekEnd: string;
	requiredMinutes: number;
	totalMinutes: number;
	deficitMinutes: number;
	compliant: boolean;
	days: WeeklyWorkDaySummary[];
}

export interface LeaveBalance {
	annualAllowance: number;
	usedLeaveDays: number;
	usedLeaveHours: number;
	remainingLeave: number;
	outingConvertedLeaveDays: number;
	sickDaysUsed: number;
	sickDaysOverLimit: number;
	absenceDays: number;
	unauthorizedAbsenceDays: number;
	expectedExtensionDays: number;
}

export interface ComplianceAlert {
	id: string;
	severity: 'info' | 'warning' | 'critical';
	title: string;
	description: string;
}

export interface TodayStatus {
	date: string;
	state: 'not_started' | 'working' | 'outing' | 'completed';
	lastActionLabel: string;
	lastActionTime: string | null;
	checkIn: string | null;
	checkOut: string | null;
	activeOuting: OutingEntry | null;
}

export interface MailTemplateMap {
	check_in_subject: string;
	check_in_body: string;
	check_out_subject: string;
	check_out_body: string;
	outing_subject: string;
	outing_body: string;
	return_subject: string;
	return_body: string;
}

export interface AppSettings {
	name: string;
	annualAllowance: number;
	workStartTime: string;
	workEndTime: string;
	defaultTo: string[];
	defaultCc: string[];
	emailSignature: string;
	gmailConnected: boolean;
	gmailEmail: string | null;
	templates: MailTemplateMap;
}

export interface MailPreview {
	type: MailTemplateType;
	subject: string;
	body: string;
	to: string[];
	cc: string[];
}

export interface MailHistoryEntry {
	id: number;
	type: MailTemplateType;
	recipients: string[];
	cc: string[];
	subject: string;
	body: string;
	sentAt: string;
	success: boolean;
	provider: string;
	errorMessage: string | null;
	messageId: string | null;
}

export interface MailSendRequest {
	type: MailTemplateType;
	to?: string[];
	cc?: string[];
	subject?: string;
	body?: string;
	date?: string;
	time?: string;
	reason?: string;
	destination?: string;
	returnTime?: string;
}

export interface MailSendResult {
	success: boolean;
	messageId: string | null;
	sentAt: string;
	provider: string;
	errorMessage: string | null;
}

export interface AttendanceApiResponse {
	todayStatus: TodayStatus;
	weeklySummary: WeeklyWorkSummary;
	recentLogs: AttendanceLog[];
	complianceAlerts: ComplianceAlert[];
}

export interface LeaveApiResponse extends LeaveBalance {
	entries: LeaveEntry[];
}

export interface DashboardData {
	attendance: AttendanceApiResponse;
	leave: LeaveApiResponse;
	settings: AppSettings;
	outings: OutingEntry[];
	mailHistory: MailHistoryEntry[];
	mailPreview: Record<MailTemplateType, MailPreview>;
}
