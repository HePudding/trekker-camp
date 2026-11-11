/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import { hasVisualEffects } from '@/utility/has-visual-effects.js';

describe('hasVisualEffects', () => {
	it.each([
		'x2', 'x3', 'x4', 'scale', 'position',
		'tada', 'jelly', 'twitch', 'shake', 'spin', 'jump', 'bounce', 'rainbow', 'sparkle',
	])('detects rendered %s effects', effect => {
		expect(hasVisualEffects(`$[${effect} 文字]`)).toBe(true);
	});

	it('detects nested effects with animation parameters', () => {
		expect(hasVisualEffects('**$[center $[spin.speed=0.2s 文字]]**')).toBe(true);
	});

	it.each([
		'`$[sparkle 文字]`',
		'```\n$[x2 文字]\n```',
		'<plain>$[shake 文字]</plain>',
		'$[x200 文字]',
		'**普通文字**'.repeat(200),
	])('ignores text without rendered effects: %s', text => {
		expect(hasVisualEffects(text)).toBe(false);
	});
});
