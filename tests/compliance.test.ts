import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLeaveBalance, calculateWeeklySummary } from '../src/lib/server/compliance.ts';
import type { AppSettings, AttendanceLog, LeaveEntry, OutingEntry } from '../src/lib/types.ts';

const settings: AppSettings = {
	name: '테스터',
	annualAllowance: 15,
	workStartTime: '09:00',
	workEndTime: '18:00',
	defaultTo: [],
	defaultCc: [],
	emailSignature: '감사합니다.',
	gmailConnected: false,
	gmailEmail: null,
	templates: {
		check_in_subject: '',
		check_in_body: '',
		check_out_subject: '',
		check_out_body: '',
		outing_subject: '',
		outing_body: '',
		return_subject: '',
		return_body: ''
	}
};

test('주간 복무시간 40시간 충족 여부를 계산한다', () => {
	const samples: Array<[string, number]> = [
		['2026-03-02', 480],
		['2026-03-03', 480],
		['2026-03-04', 480],
		['2026-03-05', 480],
		['2026-03-06', 480]
	];
	const logs: AttendanceLog[] = samples.map(([date, totalWorkMinutes], index) => ({
		id: index + 1,
		date,
		checkIn: '09:00',
		checkOut: '18:00',
		totalWorkMinutes,
		note: '',
		createdAt: '',
		updatedAt: ''
	}));

	const summary = calculateWeeklySummary(logs, settings, new Date('2026-03-06T10:00:00'));

	assert.equal(summary.totalMinutes, 2400);
	assert.equal(summary.deficitMinutes, 0);
	assert.equal(summary.compliant, true);
});

test('연가 초과, 병가 초과, 무단외출 누계를 합산한다', () => {
	const attendanceLogs: AttendanceLog[] = [
		{
			id: 1,
			date: '2026-03-02',
			checkIn: '10:00',
			checkOut: '17:00',
			totalWorkMinutes: 360,
			note: '',
			createdAt: '',
			updatedAt: ''
		}
	];
	const leaveEntries: LeaveEntry[] = [
		{
			id: 1,
			date: '2026-03-02',
			type: 'annual',
			unit: 'day',
			amount: 14,
			reason: '',
			status: 'approved',
			note: '',
			requiresDocument: false,
			createdAt: '',
			updatedAt: ''
		},
		{
			id: 2,
			date: '2026-03-03',
			type: 'annual',
			unit: 'hour',
			amount: 8,
			reason: '',
			status: 'approved',
			note: '',
			requiresDocument: false,
			createdAt: '',
			updatedAt: ''
		},
		{
			id: 3,
			date: '2026-03-04',
			type: 'sick',
			unit: 'day',
			amount: 31,
			reason: '',
			status: 'approved',
			note: '',
			requiresDocument: false,
			createdAt: '',
			updatedAt: ''
		}
	];
	const outings: OutingEntry[] = [
		{
			id: 1,
			date: '2026-03-02',
			startTime: '13:00',
			endTime: '15:00',
			reason: '',
			destination: '',
			status: 'unauthorized',
			durationMinutes: 120,
			createdAt: '',
			updatedAt: ''
		}
	];

	const balance = calculateLeaveBalance(settings, leaveEntries, attendanceLogs, outings);

	assert.equal(balance.outingConvertedLeaveDays, 0);
	assert.equal(balance.usedLeaveDays, 14);
	assert.equal(balance.usedLeaveHours, 12);
	assert.equal(balance.remainingLeave, -0.5);
	assert.equal(balance.sickDaysOverLimit, 1);
	assert.equal(balance.unauthorizedAbsenceDays, 0.25);
	assert.equal(balance.expectedExtensionDays, 2.75);
});
