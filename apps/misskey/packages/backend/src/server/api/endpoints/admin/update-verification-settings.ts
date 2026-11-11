/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { MetaService } from '@/core/MetaService.js';
import { VerificationCodeService } from '@/core/VerificationCodeService.js';
import { verificationSettingsProperties } from '@/server/api/verification-settings.js';

export const meta = { tags: ['admin'], requireCredential: true, requireAdmin: true, secure: true } as const;
export const paramDef = {
	type: 'object',
	properties: {
		...verificationSettingsProperties,
		accessKeySecret: { type: 'string', maxLength: 256 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private codes: VerificationCodeService, private metaService: MetaService) {
		super(meta, paramDef, async (ps) => {
			const values = Object.fromEntries(Object.entries(ps)
				.filter(([key]) => Object.hasOwn(paramDef.properties, key))
				.map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
			await this.metaService.update({ verificationSettings: { ...await this.codes.settings(), ...values } });
		});
	}
}

