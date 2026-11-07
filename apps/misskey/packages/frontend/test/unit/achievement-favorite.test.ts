/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import type { entities } from 'misskey-js';
import type { MenuButton } from '@/types/menu.js';
import { getNoteMenu } from '@/utility/get-note-menu.js';
import { i18n } from '@/i18n.js';

const { apiWithDialog, misskeyApi, claimAchievement } = vi.hoisted(() => ({
	apiWithDialog: vi.fn(),
	misskeyApi: vi.fn(),
	claimAchievement: vi.fn(),
}));

vi.mock('@/os.js', () => ({ apiWithDialog }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement }));
vi.mock('@/i.js', () => ({ $i: { id: 'me', policies: {} } }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/store.js', () => ({ store: {} }));
vi.mock('@/utility/get-user-menu.js', () => ({ getUserMenu: vi.fn() }));
vi.mock('@/cache.js', () => ({ clipsCache: {}, favoritedChannelsCache: {} }));
vi.mock('@/components/MkRippleEffect.vue', () => ({ default: {} }));
vi.mock('@/utility/get-embed-code.js', () => ({ genEmbedCode: vi.fn() }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));

async function favoriteAction(isFavorited = false) {
	misskeyApi.mockResolvedValue({ isFavorited, isMutedThread: false });
	const { menu } = getNoteMenu({
		note: { id: 'note', userId: 'me', text: 'Hello', visibility: 'public' } as entities.Note,
		translation: ref(null),
		translating: ref(false),
	});
	const items = await Promise.all(menu);
	const item = items.find(item => item && 'text' in item && item.text === (isFavorited ? i18n.ts.unfavorite : i18n.ts.favorite)) as MenuButton;
	return () => item.action(new PointerEvent('click'));
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('favorite achievement', () => {
	test('claims only after the server accepts the favorite', async () => {
		const request = Promise.withResolvers<void>();
		apiWithDialog.mockReturnValue(request.promise);
		const action = await favoriteAction();
		const completion = action();
		expect(apiWithDialog).toHaveBeenCalledWith('notes/favorites/create', { noteId: 'note' });
		expect(claimAchievement).not.toHaveBeenCalled();
		request.resolve();
		await completion;
		expect(claimAchievement).toHaveBeenCalledExactlyOnceWith('noteFavorited1');
	});

	test('does not claim when the request fails', async () => {
		apiWithDialog.mockRejectedValue(new Error('Request failed'));
		const action = await favoriteAction();
		await action();
		expect(claimAchievement).not.toHaveBeenCalled();
	});

	test('does not claim when removing a favorite', async () => {
		apiWithDialog.mockResolvedValue(undefined);
		const action = await favoriteAction(true);
		await action();
		expect(apiWithDialog).toHaveBeenCalledWith('notes/favorites/delete', { noteId: 'note' });
		expect(claimAchievement).not.toHaveBeenCalled();
	});
});
