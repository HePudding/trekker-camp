/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import * as Misskey from 'misskey-js';
import { shouldCollapsed } from '@@/js/collapsed.js';

function note(partial: Partial<Misskey.entities.Note>): Misskey.entities.Note {
	return { cw: null, text: null, files: [], ...partial } as unknown as Misskey.entities.Note;
}

describe('shouldCollapsed', () => {
	test('long note behind a CW still collapses once opened', () => {
		assert.isTrue(shouldCollapsed(note({ cw: '剧透', text: 'あ'.repeat(600) }), []));
	});

	test('short note behind a CW does not collapse', () => {
		assert.isFalse(shouldCollapsed(note({ cw: '剧透', text: 'short' }), []));
	});

	test('inline image collapses', () => {
		assert.isTrue(shouldCollapsed(note({ text: 'look $[img 1]' }), []));
	});

	test('inline table collapses', () => {
		assert.isTrue(shouldCollapsed(note({ text: '$[table a|b\nc|d]' }), []));
	});

	test('short plain note does not collapse', () => {
		assert.isFalse(shouldCollapsed(note({ text: 'hello' }), []));
	});
});
