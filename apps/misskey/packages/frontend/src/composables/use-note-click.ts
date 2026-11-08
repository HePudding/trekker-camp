/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';
import { notePage } from '@@/js/note.js';
import { useRouter } from '@/router.js';
import { getNoteClickAction } from '@/utility/note-click.js';

/**
 * ノートカードの空白部分のクリックで詳細ページを開くハンドラを返す（click と auxclick の両方に渡す）
 */
export function useNoteClick(getNote: () => Misskey.entities.Note | null | undefined) {
	const router = useRouter();

	return (ev: MouseEvent) => {
		const note = getNote();
		const root = ev.currentTarget;
		if (note == null || !(root instanceof Element)) return;

		const action = getNoteClickAction(ev, root, window.getSelection()?.toString() ?? '');
		if (action === 'none') return;

		// 外側のノートカードが重ねて遷移しないようにする
		ev.preventDefault();

		if (action === 'openInNewTab') {
			window.open(notePage(note), '_blank', 'noopener');
		} else {
			router.pushByPath(notePage(note));
		}
	};
}
