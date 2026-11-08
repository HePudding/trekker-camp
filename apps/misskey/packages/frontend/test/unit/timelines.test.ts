/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import { hasWithReplies } from '@/timelines.js';

describe('hasWithReplies', () => {
	test('the home feed (local timeline) supports the replies switch', () => {
		assert.isTrue(hasWithReplies('local'));
	});

	test('the social timeline keeps the switch', () => {
		assert.isTrue(hasWithReplies('social'));
	});

	test('timelines without the switch stay without it', () => {
		assert.isFalse(hasWithReplies('home'));
		assert.isFalse(hasWithReplies('global'));
	});
});
