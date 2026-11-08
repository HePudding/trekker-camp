/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { DB_MAX_NOTE_TEXT_LENGTH, MAX_NOTE_TEXT_LENGTH } from '@/const.js';

describe('note text limit', () => {
	test('long posts up to 20000 characters are accepted', () => {
		expect(MAX_NOTE_TEXT_LENGTH).toBe(20000);
	});

	test('DB limit does not truncate an accepted note', () => {
		expect(DB_MAX_NOTE_TEXT_LENGTH).toBeGreaterThanOrEqual(MAX_NOTE_TEXT_LENGTH);
	});
});
