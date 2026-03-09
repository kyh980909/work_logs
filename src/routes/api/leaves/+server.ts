import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDashboardData } from '$lib/server/dashboard';
import {
	createLeaveEntry,
	deleteLeaveEntry,
	listLeaveEntries,
	updateLeaveEntry
} from '$lib/server/repository';

export const GET: RequestHandler = async () => {
	return json(getDashboardData().leave);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const entry = createLeaveEntry(body);
	return json({ success: true, entry, leave: getDashboardData().leave });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		id: number;
		date?: string;
		type?: 'annual' | 'sick' | 'absence';
		unit?: 'day' | 'hour';
		amount?: number;
		reason?: string;
		status?: 'approved' | 'unauthorized';
		note?: string;
		requiresDocument?: boolean;
	};
	const entry = updateLeaveEntry(body.id, body);
	return json({ success: true, entry, leave: getDashboardData().leave });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { searchParams } = new URL(request.url);
	const id = Number(searchParams.get('id'));
	if (!id) {
		return json({ success: false, message: 'id가 필요합니다.' }, { status: 400 });
	}
	deleteLeaveEntry(id);
	return json({ success: true, leave: getDashboardData().leave, entries: listLeaveEntries(100) });
};
