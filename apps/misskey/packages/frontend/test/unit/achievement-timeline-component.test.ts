/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import type { entities } from 'misskey-js';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import { i18n } from '@/i18n.js';

const { listeners, misskeyApi, claimAchievement } = vi.hoisted(() => ({
	listeners: new Map<string, (note: entities.Note) => void>(),
	misskeyApi: vi.fn(),
	claimAchievement: vi.fn(),
}));

vi.mock('@/stream.js', () => ({
	useStream: () => ({
		useChannel: (name: string) => ({
			on: (_event: string, callback: (note: entities.Note) => void) => listeners.set(name, callback),
			dispose: () => listeners.delete(name),
		}),
	}),
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement, claimedAchievements: [] }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@/instance.js', () => ({ instance: { notesPerOneAd: 0 } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: true } } }));
vi.mock('@/components/MkNote.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button />' } }));
vi.mock('@/components/MkPullToRefresh.vue', () => ({ default: { template: '<div><slot /></div>' } }));
vi.mock('@/utility/sound.js', () => ({}));

const global = {
	stubs: { MkLoading: true, MkError: true, MkResult: true, MkAd: true },
	directives: { appear: {} },
};
const makeNote = (id: number) => ({ id: String(id), createdAt: new Date().toISOString(), userId: 'other' } as entities.Note);
const sendNotes = (start: number, count: number, channel = 'localTimeline') => {
	for (let i = start; i < start + count; i++) listeners.get(channel)!(makeNote(i));
};

beforeEach(() => {
	vi.clearAllMocks();
	listeners.clear();
	misskeyApi.mockResolvedValue([]);
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('timeline achievement stream entry', () => {
	test.each(['local', 'home'] as const)('counts live notes on %s, excluding history, pagination and repeated notes', async src => {
		misskeyApi.mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => makeNote(i)));
		const view = render(MkStreamingNotesTimeline, { props: { src }, global });
		await nextTick();
		await nextTick();
		expect(claimAchievement).not.toHaveBeenCalled();
		await fireEvent.click(await view.findByRole('button', { name: i18n.ts.loadMore }));
		expect(misskeyApi).toHaveBeenCalledTimes(2);
		expect(claimAchievement).not.toHaveBeenCalled();

		const channel = src === 'local' ? 'localTimeline' : 'homeTimeline';
		sendNotes(0, 20, channel);
		sendNotes(20, 19, channel);
		sendNotes(20, 19, channel);
		expect(claimAchievement).not.toHaveBeenCalled();
		sendNotes(39, 1, channel);
		expect(claimAchievement).toHaveBeenCalledExactlyOnceWith('htl20npm');
	});

	test('does not count another timeline source', async () => {
		render(MkStreamingNotesTimeline, { props: { src: 'channel', channel: 'test' }, global });
		await nextTick();
		sendNotes(0, 20, 'channel');
		expect(claimAchievement).not.toHaveBeenCalled();
	});

	test('resets when the document is hidden and ignores notes received while hidden', async () => {
		render(MkStreamingNotesTimeline, { props: { src: 'local' }, global });
		await nextTick();
		sendNotes(0, 19);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		await nextTick();
		sendNotes(19, 20);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		await nextTick();
		sendNotes(39, 19);
		expect(claimAchievement).not.toHaveBeenCalled();
		sendNotes(58, 1);
		expect(claimAchievement).toHaveBeenCalledExactlyOnceWith('htl20npm');
	});

	test('resets while a cached page is inactive and resumes after activation', async () => {
		const show = ref(true);
		const host = defineComponent({
			setup: () => () => h(KeepAlive, null, { default: () => show.value ? h(MkStreamingNotesTimeline, { src: 'local' }) : null }),
		});
		render(host, { global });
		await nextTick();
		sendNotes(0, 19);
		show.value = false;
		await nextTick();
		sendNotes(19, 20);
		show.value = true;
		await nextTick();
		sendNotes(39, 19);
		expect(claimAchievement).not.toHaveBeenCalled();
		sendNotes(58, 1);
		expect(claimAchievement).toHaveBeenCalledExactlyOnceWith('htl20npm');
	});
});
