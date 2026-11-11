/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { PasswordResetRequestsRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { IdService } from '@/core/IdService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { EmailService } from '@/core/EmailService.js';
import { L_CHARS, secureRndstr } from '@/misc/secure-rndstr.js';
import { VerificationError } from '@/core/VerificationCodeService.js';
import { verificationErrors, handleVerificationError } from '@/server/api/verification-errors.js';

export const meta = {
	tags: ['reset password'],

	requireCredential: false,

	description: 'Request a users password to be reset.',

	limit: {
		duration: ms('1hour'),
		max: 3,
	},

	errors: { verificationUnavailable: verificationErrors.unavailable },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		username: { type: 'string' },
		email: { type: 'string' },
	},
	required: ['username', 'email'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.passwordResetRequestsRepository)
		private passwordResetRequestsRepository: PasswordResetRequestsRepository,

		private idService: IdService,
		private emailService: EmailService,
	) {
		super(meta, paramDef, async (ps) => {
			ps.email = ps.email.trim().toLowerCase();
			const user = await this.usersRepository.findOneBy({
				usernameLower: ps.username.toLowerCase(),
				host: IsNull(),
				isSuspended: false,
			});

			// 合致するユーザーが登録されていなかったら無視
			if (user == null) {
				return;
			}

			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });

			// 合致するメアドが登録されていなかったら無視
			if (profile.email?.toLowerCase() !== ps.email) {
				return;
			}

			// メアドが認証されていなかったら無視
			if (!profile.emailVerified) {
				return;
			}

			const token = secureRndstr(64, { chars: L_CHARS });

			await this.passwordResetRequestsRepository.insert({
				id: this.idService.gen(),
				userId: profile.userId,
				token,
			});

			const link = `${this.config.url}/reset-password/${token}`;

			await this.emailService.sendEmail(ps.email, '旅人营地重置密码',
				`<p>你正在重置旅人营地的登录密码，请在 30 分钟内点击下方链接设置新密码：</p><p><a href="${link}">重置密码</a></p><p>如非本人操作，请忽略此邮件。</p>`,
				`你正在重置旅人营地的登录密码，请在 30 分钟内打开以下链接设置新密码：${link}\n如非本人操作，请忽略此邮件。`).catch(() => {
					handleVerificationError(new VerificationError('VERIFICATION_UNAVAILABLE'));
				});
		});
	}
}
