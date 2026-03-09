import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildGmailAuthUrl } from '$lib/server/mail';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = crypto.randomUUID();
	cookies.set('gmail_oauth_state', state, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: url.protocol === 'https:'
	});
	throw redirect(302, buildGmailAuthUrl(url.origin, state));
};
