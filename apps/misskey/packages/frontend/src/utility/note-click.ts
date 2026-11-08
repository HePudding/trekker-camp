/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type NoteClickAction = 'none' | 'open' | 'openInNewTab';

// 独自のクリック動作を持つ要素。ここに含まれるクリックでは詳細ページへ遷移しない
const INTERACTIVE_SELECTOR = [
	'a',
	'button',
	'input',
	'textarea',
	'select',
	'label',
	'summary',
	'video',
	'audio',
	'img',
	'[role="button"]',
	'[role="link"]',
	'[contenteditable]',
	'[data-no-note-click]',
].join(',');

type ClickLike = {
	button: number;
	ctrlKey: boolean;
	metaKey: boolean;
	defaultPrevented: boolean;
	target: EventTarget | null;
};

/**
 * ノートカードの空白部分をクリックしたときに詳細ページを開くかどうかを決める
 */
export function getNoteClickAction(ev: ClickLike, root: Element, selectedText: string): NoteClickAction {
	if (ev.defaultPrevented) return 'none';
	if (ev.button !== 0 && ev.button !== 1) return 'none';
	if (!(ev.target instanceof Element)) return 'none';

	const interactive = ev.target.closest(INTERACTIVE_SELECTOR);
	if (interactive != null && root.contains(interactive)) return 'none';

	// テキストを選択し終えたときのクリックは遷移扱いにしない
	if (selectedText.length > 0) return 'none';

	if (ev.button === 1 || ev.ctrlKey || ev.metaKey) return 'openInNewTab';
	return 'open';
}
