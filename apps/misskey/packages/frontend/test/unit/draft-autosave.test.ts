/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { createDraftAutosaver } from '@/utility/draft-autosave.js';

describe('createDraftAutosaver', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	test('debounces and creates once, then updates the same draft', async () => {
		const serverDraftId = ref<string | null>(null);
		const save = vi.fn(async (id: string | null) => ({ id: id ?? 'd1' }));
		const a = createDraftAutosaver({ save, enabled: () => true, serverDraftId, delay: 3000 });
		a.notify(); a.notify(); a.notify();
		expect(a.status.value).toBe('pending');
		await vi.advanceTimersByTimeAsync(3000);
		expect(save).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenLastCalledWith(null);
		expect(a.status.value).toBe('saved');
		a.notify();
		await vi.advanceTimersByTimeAsync(3000);
		expect(save).toHaveBeenLastCalledWith('d1');
	});

	test('does nothing when disabled', async () => {
		const save = vi.fn(async () => ({ id: 'x' }));
		const a = createDraftAutosaver({ save, enabled: () => false, serverDraftId: ref(null) });
		a.notify();
		await vi.advanceTimersByTimeAsync(10000);
		expect(save).not.toHaveBeenCalled();
		expect(a.status.value).toBe('idle');
	});

	test('TOO_MANY_DRAFTS stops syncing', async () => {
		const save = vi.fn(async () => { throw Object.assign(new Error('too many'), { code: 'TOO_MANY_DRAFTS' }); });
		const a = createDraftAutosaver({ save, enabled: () => true, serverDraftId: ref(null), delay: 10 });
		a.notify();
		await vi.advanceTimersByTimeAsync(10);
		expect(a.status.value).toBe('full');
		a.notify();
		await vi.advanceTimersByTimeAsync(100);
		expect(save).toHaveBeenCalledTimes(1);
	});

	test('actually scheduled drafts are not synced', async () => {
		const save = vi.fn(async () => ({ id: 'x' }));
		const a = createDraftAutosaver({ save, enabled: () => true, isActuallyScheduled: () => true, serverDraftId: ref(null), delay: 10 });
		a.notify();
		await vi.advanceTimersByTimeAsync(100);
		expect(save).not.toHaveBeenCalled();
		expect(a.status.value).toBe('scheduled');
	});
});
