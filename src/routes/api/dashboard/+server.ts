import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDashboardData } from '$lib/server/dashboard';

export const GET: RequestHandler = async () => {
	return json(getDashboardData());
};
