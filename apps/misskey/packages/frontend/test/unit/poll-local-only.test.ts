/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import type { entities } from 'misskey-js';
import MkPoll from '@/components/MkPoll.vue';
import { i18n } from '@/i18n.js';

const { api, confirm, pleaseLogin } = vi.hoisted(() => ({
	api: vi.fn(),
	confirm: vi.fn(),
	pleaseLogin: vi.fn(),
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/os.js', () => ({ confirm }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin }));
vi.mock('@/instance.js', () => ({ instance: { federation: 'none' } }));

const renderPoll = (host: string | null) => render(MkPoll, {
	props: {
		noteId: 'poll-note',
		multiple: false,
		expiresAt: null,
		choices: [{ text: 'First', votes: 2, isVoted: false }, { text: 'Second', votes: 1, isVoted: false }],
		author: { host } as entities.UserLite,
	},
	global: { stubs: { Mfm: { props: ['text'], template: '<span>{{ text }}</span>' } } },
});

beforeEach(() => {
	vi.clearAllMocks();
	pleaseLogin.mockResolvedValue(true);
	confirm.mockResolvedValue({ canceled: false });
	api.mockResolvedValue(undefined);
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
