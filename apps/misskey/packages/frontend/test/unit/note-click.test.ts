/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert, beforeEach } from 'vitest';
import { getNoteClickAction } from '@/utility/note-click.js';

function setup(html: string) {
	document.body.innerHTML = `<div id="root">${html}</div>`;
	return document.getElementById('root')!;
}

function click(target: Element, init: Partial<{ button: number; ctrlKey: boolean; metaKey: boolean; defaultPrevented: boolean }> = {}) {
	return { button: 0, ctrlKey: false, metaKey: false, defaultPrevented: false, target, ...init };
}

describe('getNoteClickAction', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	test('a click on plain text opens the note', () => {
		const root = setup('<p id="t">正文</p>');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('t')!), root, ''), 'open');
	});

	test('a click inside a link or button does nothing', () => {
		const root = setup('<a href="/x"><span id="a">链接</span></a><button><i id="b"></i></button>');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('a')!), root, ''), 'none');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('b')!), root, ''), 'none');
	});

	test('an element marked data-no-note-click does nothing', () => {
		const root = setup('<div data-no-note-click><span id="t">投票</span></div>');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('t')!), root, ''), 'none');
	});

	test('an interactive ancestor outside the note root does not block the click', () => {
		document.body.innerHTML = '<button><div id="root"><p id="t">正文</p></div></button>';
		const root = document.getElementById('root')!;
		assert.strictEqual(getNoteClickAction(click(document.getElementById('t')!), root, ''), 'open');
	});

	test('a click that ends a text selection does nothing', () => {
		const root = setup('<p id="t">正文</p>');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('t')!), root, '正'), 'none');
	});

	test('a click already handled by an inner note does nothing', () => {
		const root = setup('<p id="t">正文</p>');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('t')!, { defaultPrevented: true }), root, ''), 'none');
	});

	test('middle click or ctrl/cmd click opens in a new tab', () => {
		const root = setup('<p id="t">正文</p>');
		const t = document.getElementById('t')!;
		assert.strictEqual(getNoteClickAction(click(t, { button: 1 }), root, ''), 'openInNewTab');
		assert.strictEqual(getNoteClickAction(click(t, { ctrlKey: true }), root, ''), 'openInNewTab');
		assert.strictEqual(getNoteClickAction(click(t, { metaKey: true }), root, ''), 'openInNewTab');
	});

	test('right click does nothing', () => {
		const root = setup('<p id="t">正文</p>');
		assert.strictEqual(getNoteClickAction(click(document.getElementById('t')!, { button: 2 }), root, ''), 'none');
	});
});
