/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ApiError } from './error.js';
import { VerificationError } from '@/core/VerificationCodeService.js';

export const verificationErrors = {
	invalidCode: { message: 'Invalid or expired verification code.', code: 'INVALID_CODE', id: '561427ae-93ef-4a99-b24f-04b24fcd5398' },
	captchaFailed: { message: 'CAPTCHA verification failed.', code: 'CAPTCHA_FAILED', id: 'bf739934-c960-4c0a-b3b5-e06c7e450535' },
	rateLimit: { message: 'Verification rate limit exceeded.', code: 'RATE_LIMIT_EXCEEDED', httpStatusCode: 429, id: '3b78a75e-ad0f-439d-a3db-82571764930f' },
	smsDailyLimit: { message: 'Daily SMS limit exceeded.', code: 'SMS_DAILY_LIMIT_EXCEEDED', httpStatusCode: 429, id: '381f41e7-f270-4472-96f8-0b6a17e3a720' },
	unavailable: { message: 'Verification service is unavailable.', code: 'VERIFICATION_UNAVAILABLE', httpStatusCode: 503, id: 'c7c7a335-6c86-47a4-9f39-8b96fb140872' },
	invalidPhone: { message: 'Invalid mainland China phone number.', code: 'INVALID_PHONE', id: '026d2a72-2653-49d7-94f5-9ad73f99be1e' },
	invalidEmail: { message: 'Invalid email address.', code: 'INVALID_EMAIL', id: '6504b22d-bbc1-48b7-9467-760b87658ee6' },
	phoneUnavailable: { message: 'Phone number is already in use.', code: 'PHONE_UNAVAILABLE', id: 'c2a92d9b-5a09-40bc-81ce-2faf920b9634' },
	emailUnavailable: { message: 'Email address is already in use.', code: 'EMAIL_UNAVAILABLE', id: 'd4fb2f64-bfee-4a4b-b17b-1d9228cba5df' },
	emailDomainNotAllowed: { message: 'Please register with a QQ or Gmail address.', code: 'EMAIL_DOMAIN_NOT_ALLOWED', id: '59da55e8-17e4-4f1c-a648-59ddc54971c9' },
	qqEmailMustBeNumeric: { message: 'Please use a numeric QQ email address.', code: 'QQ_EMAIL_MUST_BE_NUMERIC', id: '0de09af8-216d-40a2-947a-8642450f351f' },
	authenticationFailed: { message: 'Authentication failed.', code: 'AUTHENTICATION_FAILED', id: 'f75cc773-51ef-4e70-8294-325b2b90d8f8' },
	registrationClosed: { message: 'A valid invitation code is required.', code: 'REGISTRATION_CLOSED', id: 'cc2bb1d2-809c-4d34-88e1-b3ca8746d9b7' },
} as const;

export function handleVerificationError(error: unknown): never {
	if (error instanceof VerificationError) {
		const definition = Object.values(verificationErrors).find(value => value.code === error.code)!;
		throw new ApiError(definition, error.retryAfter === undefined ? undefined : {
			retryAfter: error.retryAfter,
			resetMs: Date.now() + error.retryAfter * 1000,
		});
	}
	throw error;
}

