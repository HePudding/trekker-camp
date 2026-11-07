/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeAll, describe, expect, test } from 'vitest';
import { MiNote, MiUser } from '@/models/_.js';
import { api, host, initTestDb, post, relativeFetch, signup } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('Federation HTTP endpoints are disabled', () => {
	let alice: misskey.entities.SignupResponse;
	let note: misskey.entities.Note;
	let remoteUserId: string;
	let remoteNoteId: string;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		note = await post(alice, { text: 'Local community post' });
		const remote = await signup({ username: 'remote' });
		const remoteNote = await post(remote, { text: 'Archived remote post' });
		remoteUserId = remote.id;
		remoteNoteId = remoteNote.id;
		const db = await initTestDb(true);
		try {
			await db.getRepository(MiUser).update(remote.id, { host: 'remote.example', uri: 'https://remote.example/users/remote' });
			await db.getRepository(MiNote).update(remoteNote.id, { userHost: 'remote.example', uri: 'https://remote.example/notes/archived' });
		} finally {
			await db.destroy();
		}
	});

	test('keeps federation disabled when administrators request enabling it', async () => {
		for (const federation of ['all', 'specified'] as const) {
			const response = await api('admin/update-meta', { federation }, alice);
			expect(response.status).toBe(204);
			const publicMeta = (await api('meta', { detail: true })).body;
			const adminMeta = (await api('admin/meta', {}, alice)).body;
			expect(publicMeta).toMatchObject({
				federation: 'none',
				policies: { gtlAvailable: false },
				features: { globalTimeline: false },
			});
			expect(adminMeta.federation).toBe('none');
			expect(adminMeta.policies.gtlAvailable).toBe(false);
		}
		const timeline = await api('notes/global-timeline', {}, alice);
		expect(timeline.status).toBe(400);
		expect(timeline.body).toMatchObject({ error: { code: 'GTL_DISABLED' } });
	});

	test.each([
		'ap/show',
		'ap/get',
		'federation/instances',
		'admin/federation/refresh-remote-instance-metadata',
		'admin/relays/list',
		'admin/relays/add',
	])('rejects the federation API %s', async endpoint => {
		const response = await relativeFetch(`api/${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ i: alice.token, uri: 'https://remote.example/users/remote', host: 'remote.example', inbox: 'https://remote.example/inbox' }),
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ error: { code: 'FEDERATION_DISABLED' } });
	});

	test('forces local-only posts even when a client requests federation', async () => {
		const response = await api('notes/create', { text: 'Stays in camp', localOnly: false }, alice);
		expect(response.status).toBe(200);
		expect(response.body.createdNote.localOnly).toBe(true);
	});

	test('rejects following and reacting to cached remote records', async () => {
		const follow = await api('following/create', { userId: remoteUserId }, alice);
		expect(follow.status).toBe(400);
		expect(follow.body).toMatchObject({ error: { code: 'NO_SUCH_USER' } });
		const reaction = await api('notes/reactions/create', { noteId: remoteNoteId, reaction: '👍' }, alice);
		expect(reaction.status).toBe(400);
		expect(reaction.body).toMatchObject({ error: { code: 'NO_SUCH_NOTE' } });
	});

	test('rejects remote replies, renotes and recipients', async () => {
		for (const target of [{ replyId: remoteNoteId }, { renoteId: remoteNoteId }]) {
			const response = await api('notes/create', { text: 'Reply', ...target }, alice);
			expect(response.status).toBe(400);
		}
		const response = await api('notes/create', { text: 'Message', visibility: 'specified', visibleUserIds: [remoteUserId] }, alice);
		expect(response.status).toBe(403);
		expect(response.body).toMatchObject({ error: { code: 'FEDERATION_DISABLED' } });
	});

	test.each(['2.0', '2.1'])('rejects direct NodeInfo %s requests', async version => {
		const response = await relativeFetch(`nodeinfo/${version}`);
		expect(response.status).toBe(404);
	});

	test.each(['host-meta', 'host-meta.json', 'nodeinfo'])('rejects federation discovery at %s', async path => {
		const response = await relativeFetch(`.well-known/${path}`);
		expect(response.status).toBe(403);
	});

	test('does not publish WebFinger for an existing local account', async () => {
		const response = await relativeFetch(`.well-known/webfinger?resource=${encodeURIComponent(`acct:alice@${host}`)}`);
		expect(response.status).toBe(403);
	});

	test('does not expose local actors, collections or posts as ActivityPub', async () => {
		for (const path of [
			`users/${alice.id}`,
			`users/${alice.id}/followers`,
			`users/${alice.id}/following`,
			`users/${alice.id}/outbox`,
			`notes/${note.id}`,
			`notes/${note.id}/activity`,
		]) {
			const response = await relativeFetch(path, { headers: { Accept: 'application/activity+json' } });
			expect(response.status, path).toBe(403);
		}
	});

	test('rejects shared and per-user inbox deliveries', async () => {
		for (const path of ['inbox', `users/${alice.id}/inbox`]) {
			const response = await relativeFetch(path, {
				method: 'POST',
				headers: { 'Content-Type': 'application/activity+json' },
				body: JSON.stringify({ type: 'Create', actor: 'https://remote.example/users/alice' }),
			});
			expect(response.status, path).toBe(403);
		}
	});

	test('keeps local account and post APIs available', async () => {
		const userResponse = await api('users/show', { userId: alice.id });
		const noteResponse = await api('notes/show', { noteId: note.id });
		expect(userResponse.status).toBe(200);
		expect(userResponse.body.id).toBe(alice.id);
		expect(noteResponse.status).toBe(200);
		expect(noteResponse.body.text).toBe('Local community post');
	});
});
