/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as mfm from 'mfm-js';

/*
 * 表の記法: $[table 見出し1|見出し2
 * セル1|セル2]
 * 行は改行、セルは | で区切る。1 行目は見出し行。
 */

const TABLE_OPEN = '$[table ';

/** セル内で記法を壊す文字を全角に置き換える */
function sanitizeCell(cell: string): string {
	return cell.replace(/[\r\n\t]+/g, ' ').replace(/\|/g, '｜').replace(/\]/g, '］').replace(/\[/g, '［');
}

/** fn ノードの子を行・セルごとのノード列に分割する（描画用） */
export function splitTableNodes(children: mfm.MfmNode[]): mfm.MfmNode[][][] {
	const rows: mfm.MfmNode[][][] = [];
	let row: mfm.MfmNode[][] = [];
	let cell: mfm.MfmNode[] = [];

	const pushText = (text: string) => {
		if (text !== '') cell.push({ type: 'text', props: { text } });
	};
	const endCell = () => { row.push(cell); cell = []; };
	const endRow = () => { endCell(); rows.push(row); row = []; };

	for (const node of children) {
		if (node.type !== 'text') {
			cell.push(node);
			continue;
		}
		let buf = '';
		for (const ch of node.props.text) {
			if (ch === '|') {
				pushText(buf); buf = '';
				endCell();
			} else if (ch === '\n') {
				pushText(buf); buf = '';
				endRow();
			} else {
				buf += ch;
			}
		}
		pushText(buf);
	}
	endRow();

	// 末尾の空行を除く
	return rows.filter(r => !(r.length === 1 && r[0].length === 0));
}

/** 表の中身（$[table と ] の間）を文字列の 2 次元配列にする（編集用） */
export function parseMfmTableSource(source: string): string[][] {
	return source.split('\n')
		.filter(line => line.trim() !== '')
		.map(line => line.split('|').map(c => c.trim()));
}

/** 2 次元配列を表の記法に変換する。列数は最大の行に揃える */
export function serializeMfmTable(rows: string[][]): string {
	const cols = Math.max(1, ...rows.map(r => r.length));
	const lines = rows.map(r => {
		const cells = Array.from({ length: cols }, (_, i) => sanitizeCell(r[i] ?? '').trim());
		return cells.join('|');
	});
	return TABLE_OPEN + lines.join('\n') + ']';
}

/** スプレッドシートからの貼り付け（TSV）を行列に変換する。表らしくなければ null */
export function tsvToRows(text: string): string[][] | null {
	const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
	if (!lines.some(l => l.includes('\t'))) return null;
	const rows = lines.map(l => l.split('\t'));
	if (rows.length < 2 && rows[0].length < 2) return null;
	return rows;
}

/** カーソル位置を含む $[table ...] を探す */
export function findTableAtCursor(text: string, cursor: number): { start: number; end: number; rows: string[][] } | null {
	let from = 0;
	for (;;) {
		const start = text.indexOf(TABLE_OPEN, from);
		if (start === -1 || start > cursor) return null;
		// 対応する ] を探す（ネストした $[...] を考慮）
		let depth = 0;
		let end = -1;
		for (let i = start + 2; i < text.length; i++) {
			const c = text[i];
			if (c === '[') depth++;
			else if (c === ']') {
				if (depth === 0) { end = i + 1; break; }
				depth--;
			}
		}
		if (end === -1) return null;
		if (cursor >= start && cursor <= end) {
			return { start, end, rows: parseMfmTableSource(text.slice(start + TABLE_OPEN.length, end - 1)) };
		}
		from = end;
	}
}
