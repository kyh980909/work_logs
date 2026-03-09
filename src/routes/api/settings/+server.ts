import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearGmailTokens, getSettings, updateSettings } from '$lib/server/repository';
import type { AppSettings } from '$lib/types';

export const GET: RequestHandler = async () => {
	return json(getSettings());
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Partial<AppSettings> & { disconnectGmail?: boolean };
	if (body.disconnectGmail) {
		clearGmailTokens();
	}
	const settingsInput = { ...body };
	delete settingsInput.disconnectGmail;
	const settings = updateSettings(settingsInput);
	return json(settings);
};
