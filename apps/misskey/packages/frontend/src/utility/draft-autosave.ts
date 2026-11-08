/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import type { Ref } from 'vue';

/** この文字数以上になったら（または長文モード中は）サーバー下書きへ自動保存する */
export const AUTOSAVE_MIN_CHARS = 500;
export const AUTOSAVE_DELAY = 3000;

export type DraftAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'full' | 'scheduled' | 'error';

export function createDraftAutosaver(opts: {
	/** draftId が null なら新規作成し、作成/更新された下書きの id を返す */
	save: (draftId: string | null) => Promise<{ id: string }>;
	/** 自動保存の対象か（文字数・長文モード） */
	enabled: () => boolean;
	/** 実際に予約投稿として登録済みか（この場合は自動保存しない） */
	isActuallyScheduled?: () => boolean;
	serverDraftId: Ref<string | null>;
	delay?: number;
}) {
	const status = ref<DraftAutosaveStatus>('idle');
	const delay = opts.delay ?? AUTOSAVE_DELAY;
	let timer: number | null = null;
	let saving: Promise<void> | null = null;
	let dirty = false;

	function clear() {
		if (timer != null) window.clearTimeout(timer);
		timer = null;
	}

	async function run() {
		clear();
		if (status.value === 'full') return;
		if (saving) {
			dirty = true;
			await saving;
			return;
		}
		dirty = false;
		status.value = 'saving';
		saving = (async () => {
			try {
				const res = await opts.save(opts.serverDraftId.value);
				opts.serverDraftId.value = res.id;
				status.value = 'saved';
			} catch (err) {
				const code = (err as { code?: string } | null)?.code;
				status.value = code === 'TOO_MANY_DRAFTS' ? 'full' : 'error';
			}
		})();
		await saving;
		saving = null;
		if (dirty && (status.value as DraftAutosaveStatus) !== 'full') await run();
	}

	function notify() {
		if (status.value === 'full') return;
		if (opts.isActuallyScheduled?.()) {
			clear();
			status.value = 'scheduled';
			return;
		}
		if (!opts.enabled()) {
			clear();
			if (status.value === 'pending' || status.value === 'scheduled') status.value = 'idle';
			return;
		}
		status.value = saving ? 'saving' : 'pending';
		clear();
		timer = window.setTimeout(() => { run(); }, delay);
	}

	/** 保留中の保存を即座に実行する */
	async function flush() {
		if (timer == null) {
			if (saving) await saving;
			return;
		}
		await run();
	}

	/** 別の下書きを読み込んだときなどに状態を初期化する */
	function reset() {
		clear();
		status.value = 'idle';
	}

	function dispose() {
		clear();
	}

	return { status, notify, flush, reset, dispose };
}
