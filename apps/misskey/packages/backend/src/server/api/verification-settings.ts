/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const verificationSettingsProperties = {
		accessKeyId: { type: 'string', maxLength: 128 },
		signName: { type: 'string', maxLength: 128 },
		templateCode: { type: 'string', maxLength: 128 },
		changePhoneTemplateCode: { type: 'string', minLength: 1, maxLength: 128 },
		resetPasswordTemplateCode: { type: 'string', minLength: 1, maxLength: 128 },
		bindPhoneTemplateCode: { type: 'string', minLength: 1, maxLength: 128 },
		verifyPhoneTemplateCode: { type: 'string', minLength: 1, maxLength: 128 },
		schemeName: { type: 'string', minLength: 1, maxLength: 12, pattern: '^[a-zA-Z0-9_-]+$' },
		interval: { type: 'integer', minimum: 30, maximum: 3600 },
		validTime: { type: 'integer', minimum: 60, maximum: 1800, multipleOf: 60 },
		perAddressHourly: { type: 'integer', minimum: 1, maximum: 100 },
		perAddressDaily: { type: 'integer', minimum: 1, maximum: 1000 },
		ipHourly: { type: 'integer', minimum: 1, maximum: 10000 },
		ipDaily: { type: 'integer', minimum: 1, maximum: 100000 },
		accountHourly: { type: 'integer', minimum: 1, maximum: 100 },
		accountDaily: { type: 'integer', minimum: 1, maximum: 1000 },
		globalDaily: { type: 'integer', minimum: 1, maximum: 100000 },
		attempts: { type: 'integer', minimum: 1, maximum: 10 },
} as const;

