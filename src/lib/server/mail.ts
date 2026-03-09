import { env } from '$env/dynamic/private';
import type { MailSendRequest, MailSendResult } from '$lib/types';
import { buildTemplateVariables, calculateWeeklySummary, renderTemplate } from './compliance.ts';
import { getDashboardData } from './dashboard.ts';
import {
	createMailHistoryEntry,
	getSettings,
	getStoredTokens,
	storeGmailTokens
} from './repository.ts';
import { formatDate, formatTime, getNow } from './time.ts';

const GMAIL_SCOPE =
	'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

function encodeBase64Url(input: string) {
	return Buffer.from(input)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function encodeMimeHeader(value: string) {
	const hasNonAscii = [...value].some((char) => char.charCodeAt(0) > 127);
	if (!hasNonAscii) return value;
	return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function getOAuthConfig(origin?: string) {
	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	const redirectUri =
		env.GOOGLE_REDIRECT_URI ?? (origin ? `${origin}/auth/gmail/callback` : undefined);
	if (!clientId || !clientSecret || !redirectUri) {
		throw new Error(
			'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI 설정이 필요합니다.'
		);
	}
	return { clientId, clientSecret, redirectUri };
}

export function buildGmailAuthUrl(origin: string, state: string) {
	const { clientId, redirectUri } = getOAuthConfig(origin);
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: GMAIL_SCOPE,
		access_type: 'offline',
		prompt: 'consent',
		state
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, origin: string) {
	const { clientId, clientSecret, redirectUri } = getOAuthConfig(origin);
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`토큰 교환 실패: ${body}`);
	}
	const tokens = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
	};
	const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});
	const user = userInfo.ok ? ((await userInfo.json()) as { email?: string }) : {};
	const expiry = tokens.expires_in
		? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
		: null;
	storeGmailTokens({
		email: user.email ?? null,
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token ?? null,
		expiry
	});
}

async function refreshAccessTokenIfNeeded(origin?: string) {
	const tokens = getStoredTokens();
	if (!tokens.gmail_refresh_token) return tokens.gmail_access_token;
	const expiryMs = tokens.gmail_token_expiry ? Date.parse(tokens.gmail_token_expiry) : 0;
	if (tokens.gmail_access_token && expiryMs > Date.now() + 60000) return tokens.gmail_access_token;

	const { clientId, clientSecret } = getOAuthConfig(origin);
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: tokens.gmail_refresh_token,
			grant_type: 'refresh_token'
		})
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Gmail 토큰 갱신 실패: ${body}`);
	}
	const refreshed = (await response.json()) as { access_token: string; expires_in?: number };
	const expiry = refreshed.expires_in
		? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
		: null;
	storeGmailTokens({
		email: tokens.gmail_email,
		accessToken: refreshed.access_token,
		refreshToken: null,
		expiry
	});
	return refreshed.access_token;
}

export function buildMailPreview(request: MailSendRequest) {
	const settings = getSettings();
	const dashboard = getDashboardData();
	const weeklySummary = calculateWeeklySummary(dashboard.attendance.recentLogs, settings);
	const variables = buildTemplateVariables({
		settings,
		type: request.type,
		date: request.date ?? formatDate(getNow()),
		time: request.time ?? formatTime(getNow()),
		reason: request.reason,
		destination: request.destination,
		returnTime: request.returnTime,
		weeklySummary
	});
	const subjectKey = `${request.type}_subject` as keyof typeof settings.templates;
	const bodyKey = `${request.type}_body` as keyof typeof settings.templates;

	return {
		type: request.type,
		to: request.to && request.to.length > 0 ? request.to : settings.defaultTo,
		cc: request.cc && request.cc.length > 0 ? request.cc : settings.defaultCc,
		subject: request.subject ?? renderTemplate(settings.templates[subjectKey], variables),
		body: request.body ?? renderTemplate(settings.templates[bodyKey], variables)
	};
}

export async function sendMail(request: MailSendRequest, origin?: string): Promise<MailSendResult> {
	const preview = buildMailPreview(request);
	const sentAt = new Date().toISOString();

	try {
		const accessToken = await refreshAccessTokenIfNeeded(origin);
		if (!accessToken) throw new Error('Gmail 연동이 필요합니다.');
		const settings = getSettings();
		const from = settings.gmailEmail ?? 'me';
		const rawMessage = [
			`From: ${from}`,
			preview.to.length > 0 ? `To: ${preview.to.join(', ')}` : '',
			preview.cc.length > 0 ? `Cc: ${preview.cc.join(', ')}` : '',
			'Content-Type: text/plain; charset="UTF-8"',
			'Content-Transfer-Encoding: 8bit',
			'MIME-Version: 1.0',
			`Subject: ${encodeMimeHeader(preview.subject)}`,
			'',
			preview.body
		]
			.filter(Boolean)
			.join('\r\n');

		const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ raw: encodeBase64Url(rawMessage) })
		});
		if (!response.ok) {
			const body = await response.text();
			throw new Error(body);
		}
		const payload = (await response.json()) as { id?: string };
		const result: MailSendResult = {
			success: true,
			messageId: payload.id ?? null,
			sentAt,
			provider: 'gmail',
			errorMessage: null
		};
		createMailHistoryEntry({
			type: request.type,
			recipients: preview.to,
			cc: preview.cc,
			subject: preview.subject,
			body: preview.body,
			sentAt,
			success: true,
			provider: 'gmail',
			errorMessage: null,
			messageId: payload.id ?? null
		});
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : '메일 전송 실패';
		createMailHistoryEntry({
			type: request.type,
			recipients: preview.to,
			cc: preview.cc,
			subject: preview.subject,
			body: preview.body,
			sentAt,
			success: false,
			provider: 'gmail',
			errorMessage: message,
			messageId: null
		});
		return {
			success: false,
			messageId: null,
			sentAt,
			provider: 'gmail',
			errorMessage: message
		};
	}
}
