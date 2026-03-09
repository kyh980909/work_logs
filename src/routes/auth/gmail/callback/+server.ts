import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens } from '$lib/server/mail';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	const storedState = cookies.get('gmail_oauth_state');

	if (!state || !storedState || state !== storedState || !code) {
		throw redirect(302, '/?gmail=error');
	}

	await exchangeCodeForTokens(code, url.origin);
	cookies.delete('gmail_oauth_state', { path: '/' });
	throw redirect(302, '/?gmail=connected');
};
