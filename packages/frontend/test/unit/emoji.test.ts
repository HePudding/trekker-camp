/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, type RenderResult } from '@testing-library/vue';
import { preferState } from '../setup.unit.js';
import { emojilist, emojiCharByCategory, getEmojiName, getUnicodeEmojiOrNull, isSupportedEmoji, unicodeEmojiCategories } from '@@/js/emojilist.js';
import { components } from '@/components/index.js';
import { directives } from '@/directives/index.js';
import MkEmoji from '@/components/global/MkEmoji.vue';

describe('Emoji', () => {
	const renderEmoji = (emoji: string): RenderResult => {
		return render(MkEmoji, {
			props: { emoji },
			global: { directives, components },
		});
	};

	afterEach(() => {
		cleanup();
		preferState.emojiStyle = '';
	});

	describe('MkEmoji', () => {
		test('Should render selector-less heart with color in native mode', async () => {
			preferState.emojiStyle = 'native';
			const mkEmoji = await renderEmoji('\u2764'); // monochrome heart
			assert.ok(mkEmoji.queryByText('\u2764\uFE0F')); // colored heart
			assert.ok(!mkEmoji.queryByText('\u2764'));
		});
	});

	describe('Emoji list', () => {
		test('Should omit flags from selection and search while retaining existing emoji rendering', () => {
			assert.ok(!unicodeEmojiCategories.some(category => String(category) === 'flags'));
			assert.ok(!emojiCharByCategory.has('flags'));
			assert.ok(!emojilist.some(emoji => emoji.category === 'flags'));
			assert.ok(emojilist.some(emoji => emoji.char === '😀' && emoji.category === 'face'));
			assert.ok(isSupportedEmoji('🇨🇳'));
			assert.strictEqual(getUnicodeEmojiOrNull('🇨🇳')?.category, 'flags');
			assert.notStrictEqual(getEmojiName('🇨🇳'), '🇨🇳');
		});

		test('Should get the name of the heart', () => {
			assert.strictEqual(getEmojiName('\u2764'), 'heart');
		});
	});
});
