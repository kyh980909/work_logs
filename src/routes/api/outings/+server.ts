import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateWorkMinutes } from '$lib/server/compliance';
import { getDashboardData } from '$lib/server/dashboard';
import {
	createOuting,
	getAttendanceLogByDate,
	getActiveOuting,
	getSettings,
	listOutings,
	listOutingsByDate,
	updateOuting,
	upsertAttendanceLog
} from '$lib/server/repository';
import { diffMinutes } from '$lib/server/time';

export const GET: RequestHandler = async () => {
	return json({ outings: listOutings(100) });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		date: string;
		startTime: string;
		reason?: string;
		destination?: string;
		status?: 'approved' | 'unauthorized';
	};
	const active = getActiveOuting(body.date);
	if (active) {
		return json({ success: false, message: '이미 진행 중인 외출이 있습니다.' }, { status: 400 });
	}
	const outing = createOuting(body);
	return json({ success: true, outing, outings: listOutingsByDate(body.date) });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		id: number;
		date: string;
		endTime?: string | null;
		reason?: string;
		destination?: string;
		status?: 'approved' | 'unauthorized';
	};
	const current = updateOuting(body.id, {
		endTime: body.endTime,
		reason: body.reason,
		destination: body.destination,
		status: body.status,
		durationMinutes: body.endTime
			? diffMinutes(
					(listOutingsByDate(body.date).find((entry) => entry.id === body.id)
						?.startTime as string) ?? '00:00',
					body.endTime,
					body.date
				)
			: undefined
	});
	const attendance = getAttendanceLogByDate(body.date);
	if (attendance) {
		const settings = getSettings();
		const outings = listOutingsByDate(body.date);
		upsertAttendanceLog({
			date: body.date,
			checkIn: attendance.checkIn,
			checkOut: attendance.checkOut,
			note: attendance.note,
			totalWorkMinutes: calculateWorkMinutes(attendance, outings, settings)
		});
	}
	return json({ success: true, outing: current, dashboard: getDashboardData() });
};
