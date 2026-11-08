/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import * as mfm from 'mfm-js';
import { findTableAtCursor, parseMfmTableSource, serializeMfmTable, splitTableNodes, tsvToRows } from '@@/js/mfm-table.js';

describe('mfm-table', () => {
	test('serialize → parse round trip', () => {
		const rows = [['角色', '属性'], ['A', 'B|C']];
		const src = serializeMfmTable(rows);
		expect(src).toBe('$[table 角色|属性\nA|B｜C]');
		const parsed = mfm.parse(src);
		expect(parsed[0].type).toBe('fn');
	});

	test('serialize pads columns', () => {
		expect(serializeMfmTable([['a', 'b'], ['c']])).toBe('$[table a|b\nc|]');
	});

	test('splitTableNodes keeps inline nodes inside cells', () => {
		const [fn] = mfm.parse('$[table A|B\n**c**|d]') as mfm.MfmFn[];
		const rows = splitTableNodes(fn.children);
		expect(rows.length).toBe(2);
		expect(rows[0].length).toBe(2);
		expect(rows[1][0][0].type).toBe('bold');
		expect(mfm.toString(rows[1][1])).toBe('d');
	});

	test('parseMfmTableSource', () => {
		expect(parseMfmTableSource('a | b\nc|d\n')).toEqual([['a', 'b'], ['c', 'd']]);
	});

	test('tsvToRows', () => {
		expect(tsvToRows('a\tb\r\nc\td\n')).toEqual([['a', 'b'], ['c', 'd']]);
		expect(tsvToRows('plain text')).toBeNull();
	});

	test('findTableAtCursor', () => {
		const text = 'hi $[table a|$[fg.color=f00 b]\nc|d] end';
		const found = findTableAtCursor(text, 12);
		expect(found?.start).toBe(3);
		expect(text.slice(found!.start, found!.end).endsWith('d]')).toBe(true);
		expect(found?.rows[0][1]).toBe('$[fg.color=f00 b]');
		expect(findTableAtCursor(text, 1)).toBeNull();
	});
});
