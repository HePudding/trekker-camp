/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { MetaService } from '@/core/MetaService.js';

export const meta = {
	tags: ['account'],
	requireCredential: false,
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			preferEmail: { type: 'boolean', optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: { username: { type: 'string', pattern: '^[a-zA-Z0-9_]{1,20}$' } },
	required: ['username'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository) private users: UsersRepository,
		@Inject(DI.userProfilesRepository) private profiles: UserProfilesRepository,
		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps) => {
			const user = await this.users.findOneBy({ usernameLower: ps.username.toLowerCase(), host: IsNull(), isSuspended: false });
			const profile = user ? await this.profiles.findOneBy({ userId: user.id }) : null;
			const preferEmail = Boolean((await this.metaService.fetch()).enableEmail && profile?.email && profile.emailVerified);
			return { preferEmail };
		});
	}
}
