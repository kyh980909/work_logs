import type {
	AppSettings,
	AttendanceApiResponse,
	AttendanceLog,
	ComplianceAlert,
	LeaveApiResponse,
	LeaveBalance,
	LeaveEntry,
	MailPreview,
	MailTemplateType,
	OutingEntry,
	TodayStatus,
	WeeklyWorkDaySummary,
	WeeklyWorkSummary
} from '$lib/types';
import {
	addDays,
	diffMinutes,
	formatDate,
	formatTime,
	getNow,
	getWeekRange,
	roundToTwo
} from './time.ts';

const REQUIRED_WEEKLY_MINUTES = 40 * 60;
const REQUIRED_DAILY_MINUTES = 8 * 60;

function getExpectedBreakMinutes(settings: AppSettings) {
	const today = formatDate(getNow());
	const scheduleMinutes = diffMinutes(settings.workStartTime, settings.workEndTime, today);
	return Math.max(0, scheduleMinutes - REQUIRED_DAILY_MINUTES);
}

export function calculateWorkMinutes(
	log: Pick<AttendanceLog, 'date' | 'checkIn' | 'checkOut'>,
	outings: OutingEntry[],
	settings: AppSettings
) {
	if (!log.checkIn || !log.checkOut) return 0;
	const totalSpan = diffMinutes(log.checkIn, log.checkOut, log.date);
	const outingMinutes = outings.reduce((sum, outing) => sum + outing.durationMinutes, 0);
	return Math.max(0, totalSpan - outingMinutes - getExpectedBreakMinutes(settings));
}

export function calculateWeeklySummary(
	logs: AttendanceLog[],
	settings: AppSettings,
	now = getNow()
): WeeklyWorkSummary {
	const { weekStart, weekEnd } = getWeekRange(now);
	const byDate = new Map(logs.map((log) => [log.date, log]));
	const days: WeeklyWorkDaySummary[] = [];
	let totalMinutes = 0;

	for (let offset = 0; offset < 5; offset += 1) {
		const current = addDays(weekStart, offset);
		const date = formatDate(current);
		const log = byDate.get(date);
		const total = log?.totalWorkMinutes ?? 0;
		totalMinutes += total;
		days.push({
			date,
			label: current.toLocaleDateString('ko-KR', { weekday: 'short' }),
			totalMinutes: total,
			deficitMinutes: Math.max(0, REQUIRED_DAILY_MINUTES - total)
		});
	}

	return {
		weekStart: formatDate(weekStart),
		weekEnd: formatDate(weekEnd),
		requiredMinutes: REQUIRED_WEEKLY_MINUTES,
		totalMinutes,
		deficitMinutes: Math.max(0, REQUIRED_WEEKLY_MINUTES - totalMinutes),
		compliant: totalMinutes >= REQUIRED_WEEKLY_MINUTES,
		days
	};
}

export function calculateTodayStatus(
	today: string,
	todayLog: AttendanceLog | null,
	todayOutings: OutingEntry[]
): TodayStatus {
	const activeOuting = todayOutings.find((outing) => outing.endTime === null) ?? null;

	if (!todayLog?.checkIn) {
		return {
			date: today,
			state: 'not_started',
			lastActionLabel: '미출근',
			lastActionTime: null,
			checkIn: null,
			checkOut: null,
			activeOuting
		};
	}

	if (activeOuting) {
		return {
			date: today,
			state: 'outing',
			lastActionLabel: '외출 중',
			lastActionTime: activeOuting.startTime,
			checkIn: todayLog.checkIn,
			checkOut: todayLog.checkOut,
			activeOuting
		};
	}

	if (todayLog.checkOut) {
		return {
			date: today,
			state: 'completed',
			lastActionLabel: '퇴근 완료',
			lastActionTime: todayLog.checkOut,
			checkIn: todayLog.checkIn,
			checkOut: todayLog.checkOut,
			activeOuting
		};
	}

	return {
		date: today,
		state: 'working',
		lastActionLabel: '근무 중',
		lastActionTime: todayLog.checkIn,
		checkIn: todayLog.checkIn,
		checkOut: todayLog.checkOut,
		activeOuting
	};
}

export function calculateLeaveBalance(
	settings: AppSettings,
	leaveEntries: LeaveEntry[],
	attendanceLogs: AttendanceLog[],
	outings: OutingEntry[]
): LeaveBalance {
	let usedLeaveDays = 0;
	let usedLeaveHours = 0;
	let sickDaysUsed = 0;
	let absenceDays = 0;
	let unauthorizedAbsenceDays = 0;

	for (const entry of leaveEntries) {
		const amountInDays = entry.unit === 'day' ? entry.amount : entry.amount / 8;
		if (entry.type === 'annual') {
			if (entry.unit === 'day') usedLeaveDays += entry.amount;
			else usedLeaveHours += entry.amount;
		}
		if (entry.type === 'sick') sickDaysUsed += amountInDays;
		if (entry.type === 'absence') {
			absenceDays += amountInDays;
			if (entry.status === 'unauthorized') unauthorizedAbsenceDays += amountInDays;
		}
	}

	let timingMinutes = 0;
	for (const log of attendanceLogs) {
		if (log.checkIn) {
			timingMinutes += Math.max(0, diffMinutes(settings.workStartTime, log.checkIn, log.date));
		}
		if (log.checkOut) {
			timingMinutes += Math.max(0, diffMinutes(log.checkOut, settings.workEndTime, log.date));
		}
	}
	for (const outing of outings) {
		timingMinutes += outing.durationMinutes;
		if (outing.status === 'unauthorized')
			unauthorizedAbsenceDays += outing.durationMinutes / (8 * 60);
	}

	const outingConvertedLeaveDays = Math.floor(timingMinutes / (8 * 60));
	usedLeaveHours += roundToTwo((timingMinutes % (8 * 60)) / 60);

	const remainingLeave = roundToTwo(
		settings.annualAllowance - usedLeaveDays - outingConvertedLeaveDays - usedLeaveHours / 8
	);
	const sickDaysOverLimit = roundToTwo(Math.max(0, sickDaysUsed - 30));
	const annualOveruse = Math.max(0, -remainingLeave);
	const expectedExtensionDays = roundToTwo(
		annualOveruse + sickDaysOverLimit + absenceDays + unauthorizedAbsenceDays * 5
	);

	return {
		annualAllowance: settings.annualAllowance,
		usedLeaveDays: roundToTwo(usedLeaveDays),
		usedLeaveHours: roundToTwo(usedLeaveHours),
		remainingLeave,
		outingConvertedLeaveDays,
		sickDaysUsed: roundToTwo(sickDaysUsed),
		sickDaysOverLimit,
		absenceDays: roundToTwo(absenceDays),
		unauthorizedAbsenceDays: roundToTwo(unauthorizedAbsenceDays),
		expectedExtensionDays
	};
}

export function buildComplianceAlerts(
	weeklySummary: WeeklyWorkSummary,
	leaveBalance: LeaveBalance
): ComplianceAlert[] {
	const alerts: ComplianceAlert[] = [];

	if (!weeklySummary.compliant) {
		alerts.push({
			id: 'weekly-deficit',
			severity: 'warning',
			title: '주간 40시간 미달',
			description: `이번 주 복무시간이 ${roundToTwo(
				weeklySummary.deficitMinutes / 60
			)}시간 부족합니다.`
		});
	}

	if (leaveBalance.remainingLeave < 0) {
		alerts.push({
			id: 'annual-overuse',
			severity: 'warning',
			title: '연가 초과 사용',
			description: `연가를 ${roundToTwo(Math.abs(leaveBalance.remainingLeave))}일 초과 사용했습니다. 초과분은 연장복무 대상입니다.`
		});
	}

	if (leaveBalance.sickDaysOverLimit > 0) {
		alerts.push({
			id: 'sick-over-limit',
			severity: 'warning',
			title: '병가 30일 초과',
			description: `병가 초과 ${leaveBalance.sickDaysOverLimit}일은 의무복무기간 연장 대상입니다.`
		});
	}

	if (leaveBalance.unauthorizedAbsenceDays >= 8) {
		alerts.push({
			id: 'unauthorized-critical',
			severity: 'critical',
			title: '무단결근 누적 8일 이상 위험',
			description: '무단결근 또는 무단 외출 누계가 8일 이상이면 편입취소 대상이 될 수 있습니다.'
		});
	} else if (leaveBalance.unauthorizedAbsenceDays > 0) {
		alerts.push({
			id: 'unauthorized-warning',
			severity: 'warning',
			title: '무단결근/무단외출 누적',
			description: `현재 ${leaveBalance.unauthorizedAbsenceDays.toFixed(
				2
			)}일 누적입니다. 누계 1일당 5배 가산 연장복무 위험이 있습니다.`
		});
	}

	if (alerts.length === 0) {
		alerts.push({
			id: 'all-good',
			severity: 'info',
			title: '복무 경고 없음',
			description: '현재 기준으로 주요 복무 경고 항목이 없습니다.'
		});
	}

	return alerts;
}

export function buildAttendanceResponse(params: {
	today: string;
	logs: AttendanceLog[];
	todayLog: AttendanceLog | null;
	todayOutings: OutingEntry[];
	settings: AppSettings;
	leaveBalance: LeaveBalance;
}): AttendanceApiResponse {
	const weeklySummary = calculateWeeklySummary(params.logs, params.settings);
	return {
		todayStatus: calculateTodayStatus(params.today, params.todayLog, params.todayOutings),
		weeklySummary,
		recentLogs: params.logs.slice(0, 14),
		complianceAlerts: buildComplianceAlerts(weeklySummary, params.leaveBalance)
	};
}

export function buildLeaveResponse(
	settings: AppSettings,
	leaveEntries: LeaveEntry[],
	attendanceLogs: AttendanceLog[],
	outings: OutingEntry[]
): LeaveApiResponse {
	return {
		...calculateLeaveBalance(settings, leaveEntries, attendanceLogs, outings),
		entries: leaveEntries
	};
}

export function renderTemplate(template: string, variables: Record<string, string>) {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

function formatPrettyDate(value: string) {
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day) return value;
	return `${month}월 ${day}일`;
}

export function buildMailPreviewMap(params: {
	settings: AppSettings;
	today: string;
	todayLog: AttendanceLog | null;
	todayOutings: OutingEntry[];
	weeklySummary: WeeklyWorkSummary;
}): Record<MailTemplateType, MailPreview> {
	const now = getNow();
	const activeOuting =
		params.todayOutings.find((outing) => outing.endTime === null) ?? params.todayOutings.at(-1);
	const baseVariables = {
		name: params.settings.name,
		date: params.today,
		pretty_date: formatPrettyDate(params.today),
		time: params.todayLog?.checkOut ?? params.todayLog?.checkIn ?? formatTime(now),
		reason: activeOuting?.reason ?? '업무 관련 외출',
		destination: activeOuting?.destination ?? '외부 미팅',
		return_time: activeOuting?.endTime ?? '',
		weekly_total_hours: (params.weeklySummary.totalMinutes / 60).toFixed(2),
		signature: params.settings.emailSignature
	};

	const buildPreview = (
		type: MailTemplateType,
		subjectKey: keyof AppSettings['templates'],
		bodyKey: keyof AppSettings['templates']
	) => ({
		type,
		to: params.settings.defaultTo,
		cc: params.settings.defaultCc,
		subject: renderTemplate(params.settings.templates[subjectKey], baseVariables),
		body: renderTemplate(params.settings.templates[bodyKey], baseVariables)
	});

	return {
		check_in: buildPreview('check_in', 'check_in_subject', 'check_in_body'),
		check_out: buildPreview('check_out', 'check_out_subject', 'check_out_body'),
		outing: buildPreview('outing', 'outing_subject', 'outing_body'),
		return: buildPreview('return', 'return_subject', 'return_body')
	};
}

export function buildTemplateVariables(params: {
	settings: AppSettings;
	type: MailTemplateType;
	date?: string;
	time?: string;
	reason?: string;
	destination?: string;
	returnTime?: string;
	weeklySummary?: WeeklyWorkSummary;
}) {
	return {
		name: params.settings.name,
		date: params.date ?? formatDate(getNow()),
		pretty_date: formatPrettyDate(params.date ?? formatDate(getNow())),
		time: params.time ?? formatTime(getNow()),
		reason: params.reason ?? '업무 관련 외출',
		destination: params.destination ?? '외부 일정',
		return_time: params.returnTime ?? '',
		weekly_total_hours: ((params.weeklySummary?.totalMinutes ?? 0) / 60).toFixed(2),
		signature: params.settings.emailSignature
	};
}
