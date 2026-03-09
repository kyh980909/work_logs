import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateWorkMinutes } from '$lib/server/compliance';
import { getDashboardData } from '$lib/server/dashboard';
import {
	getAttendanceLogByDate,
	getSettings,
	listOutingsByDate,
	upsertAttendanceLog
} from '$lib/server/repository';

export const GET: RequestHandler = async () => {
	return json(getDashboardData().attendance);
};

async function handleUpsert(request: Request) {
	const body = (await request.json()) as {
		date: string;
		checkIn?: string | null;
		checkOut?: string | null;
		note?: string;
	};
	const settings = getSettings();
	const existing = getAttendanceLogByDate(body.date);
	const checkIn = body.checkIn === undefined ? (existing?.checkIn ?? null) : body.checkIn;
	const checkOut = body.checkOut === undefined ? (existing?.checkOut ?? null) : body.checkOut;
	const totalWorkMinutes = calculateWorkMinutes(
		{ date: body.date, checkIn, checkOut },
		listOutingsByDate(body.date),
		settings
	);
	const record = upsertAttendanceLog({
		date: body.date,
		checkIn,
		checkOut,
		note: body.note ?? existing?.note ?? '',
		totalWorkMinutes
	});
	return json({ success: true, record, attendance: getDashboardData().attendance });
}

export const POST: RequestHandler = async ({ request }) => handleUpsert(request);
export const PATCH: RequestHandler = async ({ request }) => handleUpsert(request);
