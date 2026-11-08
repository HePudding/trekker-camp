/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { computeCollapseScrollDelta, shouldShowFloatingCollapse } from '@/utility/note-collapse.js';

describe('shouldShowFloatingCollapse', () => {
	test('card spans viewport bottom → show', () => {
		expect(shouldShowFloatingCollapse({ top: -500, bottom: 1500 }, 800)).toBe(true);
	});
	test('card bottom above viewport bottom (next note visible) → hide', () => {
		expect(shouldShowFloatingCollapse({ top: -500, bottom: 700 }, 800)).toBe(false);
	});
	test('card entirely below viewport → hide', () => {
		expect(shouldShowFloatingCollapse({ top: 900, bottom: 3000 }, 800)).toBe(false);
	});
});

describe('computeCollapseScrollDelta', () => {
	test('top above viewport → negative delta', () => {
		expect(computeCollapseScrollDelta(-1200, 60)).toBe(-1260);
	});
	test('top visible → 0', () => {
		expect(computeCollapseScrollDelta(100, 60)).toBe(0);
	});
});
