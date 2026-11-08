/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 本文中の添付画像の記法: $[img N]（N は添付ファイルの 1 始まりの番号）
 */

const INLINE_IMAGE_RE = /\$\[img (\d+)\]/g;

export function inlineImageToken(n: number): string {
	return `$[img ${n}]`;
}

/** 本文で参照されている添付番号（1 始まり、重複なし、出現順） */
export function getInlineImageIndices(text: string | null | undefined): number[] {
	if (!text) return [];
	const out: number[] = [];
	for (const m of text.matchAll(INLINE_IMAGE_RE)) {
		const n = parseInt(m[1], 10);
		if (!out.includes(n)) out.push(n);
	}
	return out;
}

/**
 * 添付の並べ替え・削除に合わせて本文中の番号を付け替える。
 * map(旧番号) が null を返した参照は本文から取り除く。
 */
export function remapInlineImageIndices(text: string, map: (n: number) => number | null): string {
	return text.replace(INLINE_IMAGE_RE, (_, d: string) => {
		const next = map(parseInt(d, 10));
		return next == null ? '' : inlineImageToken(next);
	});
}

/** 添付 ID 列の変化から番号の対応を作る */
export function buildIndexMap(prevIds: string[], nextIds: string[]): (n: number) => number | null {
	return (n) => {
		const id = prevIds[n - 1];
		if (id == null) return n;
		const i = nextIds.indexOf(id);
		return i === -1 ? null : i + 1;
	};
}

/** 本文中で参照されていない添付だけを返す（末尾のメディア一覧用） */
export function filterUnreferencedFiles<T>(files: T[], text: string | null | undefined): T[] {
	const used = getInlineImageIndices(text);
	if (used.length === 0) return files;
	return files.filter((_, i) => !used.includes(i + 1));
}
