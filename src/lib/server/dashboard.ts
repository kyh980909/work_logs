import type { DashboardData } from '$lib/types';
import {
	buildAttendanceResponse,
	buildLeaveResponse,
	buildMailPreviewMap,
	calculateWeeklySummary
} from './compliance.ts';
import {
	getAttendanceLogByDate,
	getSettings,
	listAttendanceLogs,
	listLeaveEntries,
	listMailHistory,
	listOutings,
	listOutingsByDate
} from './repository.ts';
import { formatDate, getNow } from './time.ts';

export function getDashboardData(): DashboardData {
	const settings = getSettings();
	const logs = listAttendanceLogs(60);
	const outings = listOutings(100);
	const leaveEntries = listLeaveEntries(100);
	const today = formatDate(getNow());
	const todayLog = getAttendanceLogByDate(today);
	const todayOutings = listOutingsByDate(today);
	const leave = buildLeaveResponse(settings, leaveEntries, logs, outings);
	const attendance = buildAttendanceResponse({
		today,
		logs,
		todayLog,
		todayOutings,
		settings,
		leaveBalance: leave
	});
	const weeklySummary = calculateWeeklySummary(logs, settings);

	return {
		attendance,
		leave,
		settings,
		outings: outings.slice(0, 20),
		mailHistory: listMailHistory(20),
		mailPreview: buildMailPreviewMap({
			settings,
			today,
			todayLog,
			todayOutings,
			weeklySummary
		})
	};
}
