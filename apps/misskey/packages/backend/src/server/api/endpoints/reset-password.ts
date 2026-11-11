/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { UserProfilesRepository, PasswordResetRequestsRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { VerificationCodeService, VerificationError } from '@/core/VerificationCodeService.js';
import { verificationErrors, handleVerificationError } from '@/server/api/verification-errors.js';

export const meta = {
	tags: ['reset password'],

	requireCredential: false,

	description: 'Reset a password using a verified email or phone code, or an email reset link.',

	limit: { duration: 60000, max: 10 },
	errors: verificationErrors,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		token: { type: 'string' },
		password: { type: 'string', minLength: 1, maxLength: 128 },
		challengeId: { type: 'string', pattern: '^[0-9a-f-]{36}$' },
		code: { type: 'string', pattern: '^\\d{6}$' },
	},
	required: ['password'],
	oneOf: [{ required: ['token'] }, { required: ['challengeId', 'code'] }],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.passwordResetRequestsRepository)
		private passwordResetRequestsRepository: PasswordResetRequestsRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		private codes: VerificationCodeService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me, accessToken) => {
			if (ps.challengeId && ps.code) {
				try {
					if (accessToken !== null) throw new VerificationError('AUTHENTICATION_FAILED');
					const proof = await this.codes.verify(ps.challengeId, ps.code, 'password-reset');
					if (!proof.userId) throw new VerificationError('INVALID_CODE');
					const user = await this.usersRepository.findOneBy({ id: proof.userId, host: IsNull(), isSuspended: false });
					const profile = await this.userProfilesRepository.findOneBy({ userId: proof.userId });
					if (!user || !profile) throw new VerificationError('INVALID_CODE');
					const bound = proof.channel === 'sms' ? profile.phoneNumber === proof.address
						: profile.emailVerified && profile.email?.toLowerCase() === proof.address;
					if (!bound) throw new VerificationError('INVALID_CODE');
					const hash = await bcrypt.hash(ps.password, 8);
					await this.codes.consume([ps.challengeId]);
					const updated = await this.userProfilesRepository.update({
						userId: proof.userId, password: profile.password ?? IsNull(),
						...(proof.channel === 'sms' ? { phoneNumber: proof.address } : { email: profile.email!, emailVerified: true }),
					}, { password: hash });
					if (updated.affected !== 1) throw new VerificationError('INVALID_CODE');
					return;
				} catch (err) {
					handleVerificationError(err);
				}
			}
			const req = await this.passwordResetRequestsRepository.findOneByOrFail({
				token: ps.token!,
			});

			// 発行してから30分以上経過していたら無効
			if (Date.now() - this.idService.parse(req.id).date.getTime() > 1000 * 60 * 30) {
				throw new Error(); // TODO
			}

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			const hash = await bcrypt.hash(ps.password, salt);

			await this.userProfilesRepository.update(req.userId, {
				password: hash,
			});

			this.passwordResetRequestsRepository.delete(req.id);
		});
	}
}
