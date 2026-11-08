/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 展開中の長文ノートで浮動「折りたたむ」ボタンを出すべきか。
 * ノートカードが表示領域の下端をまたいでいる（＝次の投稿がまだ下端に現れていない）間だけ表示する。
 */
export function shouldShowFloatingCollapse(card: { top: number; bottom: number }, viewportBottom: number): boolean {
	return card.top < viewportBottom && card.bottom > viewportBottom;
}

/**
 * 折りたたみ時のスクロール補正量。カード上端が表示領域上端より上にある場合、
 * カード上端が表示領域上端に来るよう負方向にスクロールする量を返す（不要なら 0）。
 */
export function computeCollapseScrollDelta(cardTop: number, viewportTop: number): number {
	return cardTop < viewportTop ? cardTop - viewportTop : 0;
}
