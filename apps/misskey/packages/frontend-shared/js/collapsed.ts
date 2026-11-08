/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';

export function shouldCollapsed(note: Misskey.entities.Note, urls: string[]): boolean {
	if (note.text != null) {
		// 正文插图の記法は文字量に数えない（折りたたみは文字の長さだけで判断する）
		const text = note.text.replace(/\n?\$\[img \d+\]/g, '');
		if (
			note.text.includes('$[x2') ||
			note.text.includes('$[x3') ||
			note.text.includes('$[x4') ||
			note.text.includes('$[scale') ||
			text.split('\n').length > 9 ||
			text.length > 500
		) {
			return true;
		}
	}

	if (urls.length >= 4) {
		return true;
	}

	return false;
}
