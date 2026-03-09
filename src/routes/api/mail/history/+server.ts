import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMailHistory } from '$lib/server/repository';

export const GET: RequestHandler = async () => {
	return json({ entries: listMailHistory(20) });
};
