import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendMail } from '$lib/server/mail';

export const POST: RequestHandler = async ({ request, url }) => {
	const body = await request.json();
	const result = await sendMail(body, url.origin);
	return json(result, { status: result.success ? 200 : 400 });
};
