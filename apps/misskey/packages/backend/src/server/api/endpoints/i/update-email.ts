/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import bcrypt from 'bcryptjs';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { MiMeta, UserProfilesRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { normalizeEmail } from '@/core/VerificationCodeService.js';
import { verificationErrors, handleVerificationError } from '@/server/api/verification-errors.js';
import { EmailService } from '@/core/EmailService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { L_CHARS, secureRndstr } from '@/misc/secure-rndstr.js';
import { UserAuthService } from '@/core/UserAuthService.js';
import { ApiError } from '../../error.js';

export const meta = {
	requireCredential: true,

	secure: true,

	limit: {
		duration: ms('1hour'),
		max: 3,
	},

	errors: {
		invalidEmail: verificationErrors.invalidEmail,
		verificationUnavailable: verificationErrors.unavailable,
		incorrectPassword: {
			message: 'Incorrect password.',
			code: 'INCORRECT_PASSWORD',
			id: 'e54c1d7e-e7d6-4103-86b6-0a95069b4ad3',
		},

		emailUnavailable: {
			message: 'Unavailable email address.',
			code: 'UNAVAILABLE',
			id: 'a2defefb-f220-8849-0af6-17f816099323',
		},

	},

	res: {
		type: 'object',
		ref: 'MeDetailed',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		password: { type: 'string' },
		email: { type: 'string', nullable: true },
		token: { type: 'string', nullable: true },
	},
	required: ['password'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
		private emailService: EmailService,
		private userAuthService: UserAuthService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const token = ps.token;
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });

			if (profile.twoFactorEnabled) {
				if (token == null) {
					throw new Error('authentication failed');
				}

				try {
					await this.userAuthService.twoFactorAuthenticate(profile, token);
				} catch (_) {
					throw new Error('authentication failed');
				}
			}

			const passwordMatched = await bcrypt.compare(ps.password, profile.password!);
			if (!passwordMatched) {
				throw new ApiError(meta.errors.incorrectPassword);
			}

			if (ps.email != null) {
				try {
					ps.email = normalizeEmail(ps.email);
				} catch (err) {
					handleVerificationError(err);
				}
				const res = await this.emailService.validateEmailForAccount(ps.email);
				if (!res.available) {
					throw new ApiError(meta.errors.emailUnavailable);
				}
			}

			const code = ps.email != null ? secureRndstr(16, { chars: L_CHARS }) : null;
			await this.userProfilesRepository.update(me.id, {
				email: ps.email,
				emailVerified: false,
				emailVerifyCode: code,
			});

			const iObj = await this.userEntityService.pack(me.id, me, {
				schema: 'MeDetailed',
				includeSecrets: true,
			});

			// Publish meUpdated event
			this.globalEventService.publishMainStream(me.id, 'meUpdated', iObj);

			if (ps.email != null) {
				const link = `${this.config.url}/verify-email/${code}`;

				await this.emailService.sendEmail(ps.email, '旅人营地邮箱验证',
					`<p>请点击下方链接验证你的邮箱，验证后可用于找回密码和接收通知。</p><p><a href="${link}">验证邮箱</a></p><p>如非本人操作，请忽略此邮件。</p>`,
					`请打开以下链接验证你的邮箱，验证后可用于找回密码和接收通知：${link}\n如非本人操作，请忽略此邮件。`).catch(() => {
					throw new ApiError(verificationErrors.unavailable);
				});
			}

			return iObj;
		});
	}
}
