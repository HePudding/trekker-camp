/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { defineComponent, h, nextTick } from 'vue';
import type { entities } from 'misskey-js';
import type { NoteUpdatedEvent } from 'misskey-js/streaming.types.js';
import MkPoll from '@/components/MkPoll.vue';
import MkSubNoteContent from '@/components/MkSubNoteContent.vue';
import { i18n } from '@/i18n.js';
import { useNoteCapture } from '@/composables/use-note-capture.js';

const { api, confirm, pleaseLogin, streamListeners, streamSend } = vi.hoisted(() => ({
	api: vi.fn(),
	confirm: vi.fn(),
	pleaseLogin: vi.fn(),
	streamListeners: new Map<string, (event: NoteUpdatedEvent) => void>(),
	streamSend: vi.fn(),
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/os.js', () => ({ confirm }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin }));
vi.mock('@/instance.js', () => ({ instance: { federation: 'none' } }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: true } } }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/stream.js', () => ({
	useStream: () => ({
		send: streamSend,
		on: (event: string, callback: (data: NoteUpdatedEvent) => void) => streamListeners.set(event, callback),
		off: (event: string) => streamListeners.delete(event),
	}),
}));

const global = { stubs: { Mfm: { props: ['text'], template: '<span>{{ text }}</span>' }, MkA: true } };

const renderPoll = (host: string | null) => render(MkPoll, {
	props: {
		noteId: 'poll-note',
		multiple: false,
		expiresAt: null,
		choices: [{ text: 'First', votes: 2, isVoted: false }, { text: 'Second', votes: 1, isVoted: false }],
		author: { host } as entities.UserLite,
	},
	global,
});

beforeEach(() => {
	vi.clearAllMocks();
	streamListeners.clear();
	pleaseLogin.mockResolvedValue(true);
	confirm.mockResolvedValue({ canceled: false });
	api.mockResolvedValue(undefined);
});

const renderCapturedPoll = (options: { recent?: boolean; multiple?: boolean; voted?: boolean; summary?: boolean; } = {}) => {
	const note = {
		id: 'poll-note',
		createdAt: new Date(Date.now() - (options.recent ? 0 : 10 * 60 * 1000)).toISOString(),
		reactions: {},
		reactionCount: 0,
		reactionEmojis: {},
		user: { host: null },
		poll: {
			multiple: options.multiple ?? false,
			expiresAt: null,
			choices: [
				{ text: 'First', votes: options.voted ? 1 : 0, isVoted: options.voted ?? false },
				{ text: 'Second', votes: 0, isVoted: false },
			],
		},
	} as entities.Note;

	if (options.summary) return render(MkSubNoteContent, { props: { note }, global });

	return render(defineComponent({
		setup() {
			const { $note } = useNoteCapture({ note, parentNote: null });
			return () => h(MkPoll, {
				noteId: note.id,
				multiple: note.poll!.multiple,
				expiresAt: null,
				choices: $note.pollChoices,
				author: { host: null } as entities.UserLite,
			});
		},
	}), { global });
};

const streamVote = async (userId: string, choice: number) => {
	streamListeners.get('noteUpdated')!({ type: 'pollVoted', id: 'poll-note', body: { userId, choice } });
	await nextTick();
};

describe('poll vote updates', () => {
	test.each([false, true])('updates an old poll after the vote succeeds without a stream subscription (summary: %s)', async summary => {
		const pending = Promise.withResolvers<void>();
		api.mockReturnValueOnce(pending.promise);
		const view = renderCapturedPoll({ summary });
		if (summary) await fireEvent.click(view.getByText(i18n.ts.poll));

		await fireEvent.click(view.getAllByRole('listitem')[0]);
		expect(api).toHaveBeenCalledExactlyOnceWith('notes/polls/vote', { noteId: 'poll-note', choice: 0 });
		expect(streamSend).not.toHaveBeenCalled();
		expect(view.getByText(i18n.tsx._poll.totalVotes({ n: 0 }))).toBeTruthy();
		expect(view.queryByText(i18n.ts._poll.voted)).toBeNull();

		pending.resolve();
		expect(await view.findByText(i18n.ts._poll.voted)).toBeTruthy();
		expect(view.getByText(i18n.tsx._poll.totalVotes({ n: 1 }))).toBeTruthy();
		expect(view.getByText(`(${i18n.tsx._poll.votesCount({ n: 1 })})`)).toBeTruthy();
		expect(view.getAllByRole('listitem')[0].querySelector('.ti-check')).not.toBeNull();
		await fireEvent.click(view.getAllByRole('listitem')[1]);
		expect(api).toHaveBeenCalledTimes(1);
	});

	test.each(['before', 'after'] as const)('counts a vote once when the stream arrives %s the API response, with an intervening vote', async order => {
		const pending = Promise.withResolvers<void>();
		api.mockReturnValueOnce(pending.promise);
		const view = renderCapturedPoll({ recent: true });

		await fireEvent.click(view.getAllByRole('listitem')[0]);
		expect(streamSend).toHaveBeenCalledWith('sr', { id: 'poll-note' });
		if (order === 'before') {
			await streamVote('me', 0);
			await streamVote('other', 1);
			pending.resolve();
		} else {
			pending.resolve();
			await view.findByText(i18n.ts._poll.voted);
			await streamVote('other', 1);
			await streamVote('me', 0);
		}

		expect(await view.findByText(i18n.ts._poll.voted)).toBeTruthy();
		await streamVote('other', 1);
		await streamVote('me', 0);
		expect(view.getByText(i18n.tsx._poll.totalVotes({ n: 2 }))).toBeTruthy();
		expect(view.getAllByText(`(${i18n.tsx._poll.votesCount({ n: 1 })})`)).toHaveLength(2);
	});

	test('retains separate votes for each option in a multiple-choice poll', async () => {
		const view = renderCapturedPoll({ recent: true, multiple: true });

		await fireEvent.click(view.getAllByRole('listitem')[0]);
		await fireEvent.click(view.getAllByRole('listitem')[1]);
		await streamVote('me', 0);
		await streamVote('me', 1);

		expect(api).toHaveBeenCalledTimes(2);
		expect(view.getByText(i18n.tsx._poll.totalVotes({ n: 2 }))).toBeTruthy();
		expect(view.container.querySelectorAll('.ti-check')).toHaveLength(2);
	});

	test('ignores an own vote already included in the initial poll data', async () => {
		const view = renderCapturedPoll({ recent: true, voted: true });

		await streamVote('other', 1);
		await streamVote('me', 0);

		expect(view.getByText(i18n.tsx._poll.totalVotes({ n: 2 }))).toBeTruthy();
		expect(view.getAllByText(`(${i18n.tsx._poll.votesCount({ n: 1 })})`)).toHaveLength(2);
	});
});

afterEach(cleanup);

describe('polls with federation disabled', () => {
	test('shows cached remote poll results without offering or submitting a vote', async () => {
		const view = renderPoll('remote.example');

		expect(view.getByText(`(${i18n.tsx._poll.votesCount({ n: 2 })})`)).toBeTruthy();
		expect(view.queryByText(i18n.ts._poll.vote)).toBeNull();
		expect(view.queryByText(i18n.ts._poll.showResult)).toBeNull();
		await fireEvent.click(view.getAllByRole('listitem')[0]);

		expect(pleaseLogin).not.toHaveBeenCalled();
		expect(confirm).not.toHaveBeenCalled();
		expect(api).not.toHaveBeenCalled();
	});

	test('continues to submit votes on local polls', async () => {
		const view = renderPoll(null);

		expect(view.getByText(i18n.ts._poll.showResult)).toBeTruthy();
		await fireEvent.click(view.getAllByRole('listitem')[0]);

		expect(api).toHaveBeenCalledExactlyOnceWith('notes/polls/vote', { noteId: 'poll-note', choice: 0 });
	});
});
