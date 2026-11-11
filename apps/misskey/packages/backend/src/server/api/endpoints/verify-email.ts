/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { DataSource, Not, Raw } from 'typeorm';
import { MiUserProfile } from '@/models/UserProfile.js';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApiError } from '../error.js';

export const meta = {
	requireCredential: false,

	tags: ['account'],

	errors: {
		emailUnavailable: { message: 'Email address is already verified by another account.', code: 'EMAIL_UNAVAILABLE', id: 'a1dc1a53-f9cb-4379-8205-c31ca5e46df7' },
		noSuchCode: {
			message: 'No such code.',
			code: 'NO_SUCH_CODE',
			id: '97c1f576-e4b8-4b8a-a6dc-9cb65e7f6f85',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		code: { type: 'string' },
	},
	required: ['code'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.db) private db: DataSource,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps) => {
			const profile = await this.db.transaction(async manager => {
				const profiles = manager.getRepository(MiUserProfile);
				const found = await profiles.findOne({ where: { emailVerifyCode: ps.code }, lock: { mode: 'pessimistic_write' } });
				if (!found?.email) throw new ApiError(meta.errors.noSuchCode);
				const email = found.email.toLowerCase();
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`verify-email:${email}`]);
				if (await profiles.existsBy({ userId: Not(found.userId), emailVerified: true, email: Raw(alias => `LOWER(${alias}) = :email`, { email }) })) {
					throw new ApiError(meta.errors.emailUnavailable);
				}
				await profiles.update(found.userId, { email, emailVerified: true, emailVerifyCode: null });
				return found;
			});

			this.globalEventService.publishMainStream(profile.userId, 'meUpdated', await this.userEntityService.pack(profile.userId, { id: profile.userId }, {
				schema: 'MeDetailed',
				includeSecrets: true,
			}));
		});
	}
}

