/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { VerificationCodeService } from '@/core/VerificationCodeService.js';
import { verificationSettingsProperties } from '@/server/api/verification-settings.js';

export const meta = {
	tags: ['admin'], requireCredential: true, requireAdmin: true, secure: true,
	res: {
		type: 'object',
		properties: {
			...Object.fromEntries(Object.entries(verificationSettingsProperties).map(([key, value]) => [key, { ...value, optional: false, nullable: false }])) as { [K in keyof typeof verificationSettingsProperties]: typeof verificationSettingsProperties[K] & { optional: false; nullable: false } },
			hasAccessKeySecret: { type: 'boolean', optional: false, nullable: false },
		},
	},
} as const;
export const paramDef = { type: 'object', properties: {}, required: [] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private codes: VerificationCodeService) {
		super(meta, paramDef, async () => {
			const { accessKeySecret, ...settings } = await this.codes.settings();
			return { ...settings, hasAccessKeySecret: accessKeySecret.length > 0 };
		});
	}
}

