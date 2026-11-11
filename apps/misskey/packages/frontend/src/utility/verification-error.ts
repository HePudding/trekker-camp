/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';

export function verificationRetryAfter(error: unknown): number {
	const { code, info } = (error ?? {}) as { code?: string; info?: { retryAfter?: number; resetMs?: number } };
	if (!['RATE_LIMIT_EXCEEDED', 'BRIEF_REQUEST_INTERVAL', 'SMS_DAILY_LIMIT_EXCEEDED'].includes(code ?? '')) return 0;
	if (typeof info?.resetMs === 'number' && Number.isFinite(info.resetMs)) {
		return Math.max(0, Math.ceil((info.resetMs - Date.now()) / 1000));
	}
	return typeof info?.retryAfter === 'number' && Number.isFinite(info.retryAfter) ? Math.max(0, Math.ceil(info.retryAfter)) : 0;
}

export function formatVerificationWait(seconds: number): string {
	if (seconds < 60) return i18n.tsx._phoneAuth.waitSeconds({ seconds });
	if (seconds < 3600) return i18n.tsx._phoneAuth.waitMinutes({ minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
	const minutes = Math.ceil(seconds / 60);
	return i18n.tsx._phoneAuth.waitHours({ hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

export function verificationErrorMessage(error: unknown): string {
	const code = (error as { code?: string } | null)?.code;
	switch (code) {
		case 'CAPTCHA_FAILED': return i18n.ts._phoneAuth.captchaFailed;
		case 'RATE_LIMIT_EXCEEDED': case 'BRIEF_REQUEST_INTERVAL': {
			const seconds = verificationRetryAfter(error);
			return seconds > 0 ? i18n.tsx._phoneAuth.tooFrequentWithWait({ time: formatVerificationWait(seconds) }) : i18n.ts._phoneAuth.tooFrequent;
		}
		case 'VERIFICATION_UNAVAILABLE': return i18n.ts._phoneAuth.unavailable;
		case 'SMS_DAILY_LIMIT_EXCEEDED': return i18n.tsx._phoneAuth.smsDailyLimit({ time: formatVerificationWait(verificationRetryAfter(error)) });
		case 'INVALID_PHONE': return i18n.ts._phoneAuth.phoneHint;
		case 'INVALID_EMAIL': return i18n.ts._emailUnavailable.format;
		case 'PHONE_UNAVAILABLE': return i18n.ts._phoneAuth.phoneUnavailable;
		case 'REGISTRATION_CLOSED': return i18n.ts._phoneAuth.invitationRequired;
		case 'AUTHENTICATION_FAILED': return i18n.ts._phoneAuth.authenticationFailed;
		default: return i18n.ts._phoneAuth.invalidCode;
	}
}

