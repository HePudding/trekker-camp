/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { VerificationCodeService, VerificationError } from '@/core/VerificationCodeService.js';
import { UserAuthService } from '@/core/UserAuthService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { verificationErrors, handleVerificationError } from '@/server/api/verification-errors.js';

export const meta = {
	tags: ['account'], requireCredential: true, secure: true,
	limit: { duration: 3600000, max: 10 },
	errors: verificationErrors,
	res: { type: 'object', ref: 'MeDetailed' },
} as const;
export const paramDef = {
	type: 'object',
	properties: {
		password: { type: 'string' }, token: { type: 'string', nullable: true },
		oldChallengeId: { type: 'string', pattern: '^[0-9a-f-]{36}$' }, oldCode: { type: 'string', pattern: '^\\d{6}$' },
		newChallengeId: { type: 'string', pattern: '^[0-9a-f-]{36}$' }, newCode: { type: 'string', pattern: '^\\d{6}$' },
	},
	required: ['password', 'newChallengeId', 'newCode'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository) private profiles: UserProfilesRepository,
		private codes: VerificationCodeService,
		private userAuthService: UserAuthService,
		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.codes.ensureSmsEnabled();
				const profile = await this.profiles.findOneByOrFail({ userId: me.id });
				if (!profile.password || !await bcrypt.compare(ps.password, profile.password)) throw new VerificationError('AUTHENTICATION_FAILED');
				if (profile.twoFactorEnabled) {
					try {
						if (!ps.token) throw new Error();
						await this.userAuthService.twoFactorAuthenticate(profile, ps.token);
					} catch {
						throw new VerificationError('AUTHENTICATION_FAILED');
					}
				}
				const ids = [ps.newChallengeId];
				const next = await this.codes.verify(ps.newChallengeId, ps.newCode, 'phone-new', me.id);
				if (next.channel !== 'sms') throw new VerificationError('INVALID_CODE');
				if (profile.phoneNumber) {
					if (!ps.oldChallengeId || !ps.oldCode) throw new VerificationError('INVALID_CODE');
					const old = await this.codes.verify(ps.oldChallengeId, ps.oldCode, 'phone-old', me.id);
					if (old.address !== profile.phoneNumber || old.channel !== 'sms') throw new VerificationError('INVALID_CODE');
					ids.push(ps.oldChallengeId);
				}
				if (await this.profiles.existsBy({ phoneNumber: next.address })) throw new VerificationError('PHONE_UNAVAILABLE');
				await this.codes.consume(ids);
				try {
					const updated = await this.profiles.update({ userId: me.id, phoneNumber: profile.phoneNumber ?? IsNull() }, { phoneNumber: next.address });
					if (updated.affected !== 1) throw new VerificationError('AUTHENTICATION_FAILED');
				} catch (err) {
					if ((err as { code?: string }).code === '23505') throw new VerificationError('PHONE_UNAVAILABLE');
					throw err;
				}
				const result = await this.userEntityService.pack(me.id, me, { schema: 'MeDetailed', includeSecrets: true });
				this.globalEventService.publishMainStream(me.id, 'meUpdated', result);
				return result;
			} catch (err) {
				handleVerificationError(err);
			}
		});
	}
}

