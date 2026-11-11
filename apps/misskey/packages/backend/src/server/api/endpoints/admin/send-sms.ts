/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { VerificationCodeService, normalizePhone } from '@/core/VerificationCodeService.js';
import { verificationErrors, handleVerificationError } from '@/server/api/verification-errors.js';

export const meta = {
	tags: ['admin'], requireCredential: true, requireAdmin: true, secure: true,
	limit: { duration: 3600000, max: 10 },
	errors: verificationErrors,
} as const;

export const paramDef = {
	type: 'object',
	properties: { to: { type: 'string', minLength: 11, maxLength: 32 } },
	required: ['to'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private codes: VerificationCodeService) {
		super(meta, paramDef, async (ps, me, _token, _file, _cleanup, ip) => {
			try {
				await this.codes.ensureSmsEnabled();
				const phone = normalizePhone(ps.to);
				await this.codes.limit(phone, ip ?? 'unknown', me.id);
				await this.codes.send('sms', 'test', phone, me.id);
			} catch (err) {
				handleVerificationError(err);
			}
		});
	}
}
