/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfm-js';

/** 折りたたみ時に描画する最大文字数（9em + フェード部分を埋めるのに十分な量） */
export const COLLAPSED_RENDER_CHARS = 1000;

/**
 * 折りたたみ表示用に MFM ノード列を先頭から maxChars 文字ぶんだけ残す。
 * ノードの途中で切れる場合は、テキストは切り詰め、子を持つノードは子を再帰的に切り詰めて
 * ノード自体は閉じた形で残す（半端な記法を作らない）。
 */
export function truncateMfmNodes(nodes: mfm.MfmNode[], maxChars: number): { nodes: mfm.MfmNode[]; truncated: boolean } {
	let budget = maxChars;
	let truncated = false;

	function walk(list: mfm.MfmNode[]): mfm.MfmNode[] {
		const out: mfm.MfmNode[] = [];
		for (const node of list) {
			if (budget <= 0) {
				truncated = true;
				break;
			}
			const len = mfm.toString(node).length;
			if (len <= budget) {
				out.push(node);
				budget -= len;
				continue;
			}
			if (node.type === 'text') {
				out.push({ ...node, props: { ...node.props, text: node.props.text.slice(0, budget) } });
				budget = 0;
				truncated = true;
				continue;
			}
			if ('children' in node && Array.isArray(node.children)) {
				const children = walk(node.children);
				out.push({ ...node, children } as mfm.MfmNode);
				budget = 0;
				truncated = true;
				continue;
			}
			// 分割できない原子ノード（コードブロック等）はそこで打ち切る
			budget = 0;
			truncated = true;
		}
		return out;
	}

	const result = walk(nodes);
	return { nodes: result, truncated };
}
