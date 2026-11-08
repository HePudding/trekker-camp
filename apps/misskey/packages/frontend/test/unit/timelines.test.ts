/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import { canShowRepliesToOthers } from '@/timelines.js';

describe('canShowRepliesToOthers', () => {
	test('the home feed (local timeline) never shows replies to others', () => {
		assert.isFalse(canShowRepliesToOthers('local'));
	});

	test('the social timeline keeps the switch', () => {
		assert.isTrue(canShowRepliesToOthers('social'));
	});

	test('timelines without the switch stay without it', () => {
		assert.isFalse(canShowRepliesToOthers('home'));
		assert.isFalse(canShowRepliesToOthers('global'));
	});
});
