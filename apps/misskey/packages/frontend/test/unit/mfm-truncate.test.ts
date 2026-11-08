/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import * as mfm from 'mfm-js';
import { truncateMfmNodes } from '@@/js/mfm-truncate.js';

const plainLength = (nodes: mfm.MfmNode[]) => mfm.toString(nodes).length;

describe('truncateMfmNodes', () => {
	test('short text is returned unchanged', () => {
		const nodes = mfm.parse('hello **world**');
		const r = truncateMfmNodes(nodes, 100);
		assert.isFalse(r.truncated);
		assert.strictEqual(mfm.toString(r.nodes), 'hello **world**');
	});

	test('long plain text is cut to the budget', () => {
		const r = truncateMfmNodes(mfm.parse('あ'.repeat(5000)), 1000);
		assert.isTrue(r.truncated);
		assert.strictEqual(plainLength(r.nodes), 1000);
	});

	test('cut inside a fn keeps the fn whole as a node, with truncated children', () => {
		const src = 'intro $[x2 ' + 'い'.repeat(3000) + '] tail';
		const r = truncateMfmNodes(mfm.parse(src), 100);
		assert.isTrue(r.truncated);
		const out = mfm.toString(r.nodes);
		assert.isTrue(out.startsWith('intro $[x2 '));
		assert.isTrue(out.endsWith(']'));
		assert.notInclude(out, 'tail');
		// round-trips through the parser as a complete fn
		assert.strictEqual(mfm.parse(out)[1].type, 'fn');
	});
});
