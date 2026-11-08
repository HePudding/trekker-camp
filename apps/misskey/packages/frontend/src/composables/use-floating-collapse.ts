/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { getScrollContainer } from '@@/js/scroll.js';
import { prefer } from '@/preferences.js';
import { computeCollapseScrollDelta, shouldShowFloatingCollapse } from '@/utility/note-collapse.js';

const COLLAPSE_DURATION = 200;

function readPxVar(el: HTMLElement, name: string): number {
	const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
	return Number.isFinite(v) ? v : 0;
}

/**
 * 展開した長文ノート用の浮動「折りたたむ」ボタンの表示判定と、折りたたみアニメーション。
 */
export function useFloatingCollapse(opts: {
	rootEl: Ref<HTMLElement | null>;
	contentEl: Ref<HTMLElement | null>;
	collapsed: Ref<boolean>;
	isLong: boolean;
}) {
	const floatingVisible = ref(false);
	let container: HTMLElement | null = null;
	let target: HTMLElement | Window | null = null;
	let raf = 0;

	function viewport() {
		const root = opts.rootEl.value!;
		const rect = container ? container.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
		return {
			top: rect.top + readPxVar(root, '--MI-stickyTop'),
			bottom: rect.bottom - readPxVar(root, '--MI-stickyBottom'),
		};
	}

	function update() {
		raf = 0;
		const root = opts.rootEl.value;
		if (root == null || opts.collapsed.value) {
			floatingVisible.value = false;
			return;
		}
		floatingVisible.value = shouldShowFloatingCollapse(root.getBoundingClientRect(), viewport().bottom);
	}

	function schedule() {
		if (raf === 0) raf = window.requestAnimationFrame(update);
	}

	function attach() {
		detach();
		const root = opts.rootEl.value;
		if (root == null) return;
		container = getScrollContainer(root);
		target = container ?? window;
		target.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule, { passive: true });
		update();
	}

	function detach() {
		target?.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', schedule);
		target = null;
		if (raf !== 0) window.cancelAnimationFrame(raf);
		raf = 0;
	}

	if (opts.isLong) {
		watch(opts.collapsed, (c) => {
			if (c) {
				detach();
				floatingVisible.value = false;
			} else {
				nextTick(attach);
			}
		});
		onBeforeUnmount(detach);
	}

	async function collapse() {
		const root = opts.rootEl.value;
		const content = opts.contentEl.value;
		if (root == null || content == null) {
			opts.collapsed.value = true;
			return;
		}
		const vp = viewport();
		const delta = computeCollapseScrollDelta(root.getBoundingClientRect().top, vp.top);
		const fromHeight = content.getBoundingClientRect().height;

		opts.collapsed.value = true;
		await nextTick();

		if (delta !== 0) {
			if (container) container.scrollBy({ top: delta, behavior: 'instant' });
			else window.scrollBy({ top: delta, behavior: 'instant' });
		}

		if (!prefer.s.animation) return;
		const toHeight = content.getBoundingClientRect().height;
		// 2 万字の高さからそのまま縮めると速すぎるので、画面 1 枚分に制限する
		const start = Math.min(fromHeight, toHeight + (vp.bottom - vp.top));
		if (start <= toHeight) return;
		content.animate(
			[{ height: `${start}px` }, { height: `${toHeight}px` }],
			{ duration: COLLAPSE_DURATION, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
		);
	}

	return { floatingVisible, collapse };
}
