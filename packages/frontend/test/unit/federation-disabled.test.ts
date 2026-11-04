/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { miLocalStorage } from '@/local-storage.js';

const { api, account } = vi.hoisted(() => ({
	api: vi.fn(),
	account: { policies: { ltlAvailable: true, gtlAvailable: true } },
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/i.js', () => ({ $i: account }));

beforeEach(() => {
	vi.resetModules();
	api.mockReset();
	localStorage.clear();
	document.getElementById('misskey_meta')?.remove();
});

describe('federation is disabled in the client', () => {
	test('ignores federation enabled in cached metadata', async () => {
		miLocalStorage.setItem('instance', JSON.stringify({ federation: 'all', name: 'Camp' }));
		miLocalStorage.setItem('instanceCachedAt', Date.now().toString());
		const { instance, fetchInstance } = await import('@/instance.js');

		expect(instance.federation).toBe('none');
		expect((await fetchInstance()).federation).toBe('none');
		expect(instance.name).toBe('Camp');
		expect(api).not.toHaveBeenCalled();
	});

	test('keeps federation disabled after a metadata refresh', async () => {
		api.mockResolvedValue({ federation: 'all', name: 'Updated camp' });
		const { instance, fetchInstance } = await import('@/instance.js');

		await fetchInstance(true);

		expect(instance.federation).toBe('none');
		expect(instance.name).toBe('Updated camp');
		expect(JSON.parse(miLocalStorage.getItem('instance')!).federation).toBe('none');
	});

	test('excludes social and global timelines even with permissive saved policies', async () => {
		const { availableBasicTimelines, isAvailableBasicTimeline } = await import('@/timelines.js');

		expect(availableBasicTimelines()).toEqual(['home', 'local']);
		expect(isAvailableBasicTimeline('social')).toBe(false);
		expect(isAvailableBasicTimeline('global')).toBe(false);
	});
});
