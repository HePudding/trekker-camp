/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { buildIndexMap, filterUnreferencedFiles, getInlineImageIndices, remapInlineImageIndices } from '@@/js/mfm-inline-image.js';

describe('mfm-inline-image', () => {
	test('getInlineImageIndices', () => {
		expect(getInlineImageIndices('a $[img 2] b $[img 1] $[img 2]')).toEqual([2, 1]);
		expect(getInlineImageIndices(null)).toEqual([]);
	});

	test('remove and reorder', () => {
		const map = buildIndexMap(['a', 'b', 'c'], ['c', 'a']);
		expect(remapInlineImageIndices('$[img 1]/$[img 2]/$[img 3]', map)).toBe('$[img 2]//$[img 1]');
	});

	test('filterUnreferencedFiles', () => {
		expect(filterUnreferencedFiles(['a', 'b', 'c'], 'x $[img 2]')).toEqual(['a', 'c']);
		expect(filterUnreferencedFiles(['a'], 'none')).toEqual(['a']);
	});
});
