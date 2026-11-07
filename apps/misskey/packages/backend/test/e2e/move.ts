/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeAll, describe, expect, test } from 'vitest';
import { api, host, signup } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('Account migration is disabled', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
	});

	test.each(['@alice', '@alice@remote.example'])('rejects alias %s without changing the account', async alias => {
		const response = await api('i/update', { alsoKnownAs: [alias] }, bob);
		expect(response.status).toBe(403);
		expect(response.body).toMatchObject({ error: { code: 'FEDERATION_DISABLED' } });
		const account = await api('i', {}, bob);
		expect(account.body.alsoKnownAs).toBeNull();
	});

	test('rejects account moves and preserves local follows', async () => {
		expect((await api('following/create', { userId: alice.id }, bob)).status).toBe(200);
		const response = await api('i/move', { moveToAccount: `@alice@${host}` }, bob);
		expect(response.status).toBe(403);
		expect(response.body).toMatchObject({ error: { code: 'FEDERATION_DISABLED' } });
		const account = await api('i', {}, bob);
		expect(account.body.movedTo).toBeNull();
		const following = await api('users/following', { userId: bob.id }, bob);
		expect(following.body.map(item => item.followeeId)).toContain(alice.id);
	});

	test('keeps normal profile updates available', async () => {
		const response = await api('i/update', { name: 'Camp member', description: 'Local profile' }, bob);
		expect(response.status).toBe(200);
		expect(response.body.name).toBe('Camp member');
		expect(response.body.description).toBe('Local profile');
	});
});
