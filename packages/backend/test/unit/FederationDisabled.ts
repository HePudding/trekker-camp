/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { UtilityService } from '@/core/UtilityService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { WebfingerService } from '@/core/WebfingerService.js';
import { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import { ApRequestService } from '@/core/activitypub/ApRequestService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { QueueService } from '@/core/QueueService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { DeliverProcessorService } from '@/queue/processors/DeliverProcessorService.js';
import { InboxProcessorService } from '@/queue/processors/InboxProcessorService.js';
import { RelationshipProcessorService } from '@/queue/processors/RelationshipProcessorService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import type { MiNote } from '@/models/Note.js';
import type { MiInstance } from '@/models/Instance.js';

function service<T extends object>(prototype: T, dependencies: object): T {
	return Object.create(prototype, Object.getOwnPropertyDescriptors(dependencies));
}

function localUtility() {
	return service(UtilityService.prototype, {
		meta: { federation: 'none' },
		config: { host: 'camp.example', url: 'https://camp.example' },
	});
}

describe('Federation disabled', () => {
	test('rejects ActivityPub hosts including the local host', () => {
		const utility = localUtility();
		expect(utility.isFederationAllowedHost('remote.example')).toBe(false);
		expect(utility.isFederationAllowedHost('camp.example')).toBe(false);
	});

	test('resolves local users and rejects remote users before cache lookup or WebFinger', async () => {
		const localUser = { id: 'local', host: null };
		const findOneBy = vi.fn().mockResolvedValue(localUser);
		const webfinger = vi.fn();
		const resolver = service(RemoteUserResolveService.prototype, {
			config: { host: 'camp.example' },
			utilityService: localUtility(),
			usersRepository: { findOneBy },
			webfingerService: { webfinger },
			logger: { info: vi.fn() },
		});

		expect(await resolver.resolveUser('alice', null)).toBe(localUser);
		expect(await resolver.resolveUser('alice', 'camp.example')).toBe(localUser);
		findOneBy.mockClear();
		await expect(resolver.resolveUser('alice', 'remote.example')).rejects.toThrow('Federation is disabled.');
		expect(findOneBy).not.toHaveBeenCalled();
		expect(webfinger).not.toHaveBeenCalled();
	});

	test('rejects outbound WebFinger and signed ActivityPub HTTP requests', async () => {
		const http = { getJson: vi.fn(), send: vi.fn() };
		const dependencies = { httpRequestService: http, utilityService: localUtility() };
		const webfinger = service(WebfingerService.prototype, dependencies);
		const request = service(ApRequestService.prototype, dependencies);

		await expect(webfinger.webfinger('alice@remote.example')).rejects.toThrow('Federation is disabled.');
		await expect(request.signedGet('https://remote.example/users/alice', { id: 'local' })).rejects.toThrow('Federation is disabled.');
		await request.signedPost({ id: 'local' }, 'https://remote.example/inbox', {});
		expect(http.getJson).not.toHaveBeenCalled();
		expect(http.send).not.toHaveBeenCalled();
	});

	test.each([false, true])('does not fetch instance metadata (force=%s)', async force => {
		const http = { getJson: vi.fn(), getHtml: vi.fn(), send: vi.fn() };
		const tryLock = vi.fn();
		const fetcher = service(FetchInstanceMetadataService.prototype, {
			utilityService: localUtility(), httpRequestService: http, tryLock,
		});

		await fetcher.fetchInstanceMetadata({ host: 'remote.example' } as MiInstance, force);
		expect(tryLock).not.toHaveBeenCalled();
		expect(http.getJson).not.toHaveBeenCalled();
		expect(http.getHtml).not.toHaveBeenCalled();
		expect(http.send).not.toHaveBeenCalled();
	});

	test('does not enqueue delivery or inbox jobs', async () => {
		const deliverQueue = { add: vi.fn(), addBulk: vi.fn() };
		const inboxQueue = { add: vi.fn() };
		const queue = service(QueueService.prototype, { meta: { federation: 'none' }, deliverQueue, inboxQueue });
		const activity = { type: 'Create', actor: 'https://camp.example/users/local', object: 'https://camp.example/notes/local' };

		queue.deliver({ id: 'local' }, activity, 'https://remote.example/inbox', false);
		await queue.deliverMany({ id: 'local' }, activity, new Map([['https://remote.example/inbox', false]]));
		queue.inbox(activity, {} as never);
		expect(deliverQueue.add).not.toHaveBeenCalled();
		expect(deliverQueue.addBulk).not.toHaveBeenCalled();
		expect(inboxQueue.add).not.toHaveBeenCalled();
	});

	test('skips leftover jobs before parsing or sending activities', async () => {
		const signedPost = vi.fn();
		const perform = vi.fn();
		const deliver = service(DeliverProcessorService.prototype, {
			meta: { federation: 'none' }, apRequestService: { signedPost },
		});
		const inbox = service(InboxProcessorService.prototype, {
			meta: { federation: 'none' }, apInboxService: { perform },
		});

		expect(await deliver.process({ data: {} } as never)).toBe('skip (federation disabled)');
		expect(await inbox.process({ data: {} } as never)).toBe('skip (federation disabled)');
		expect(signedPost).not.toHaveBeenCalled();
		expect(perform).not.toHaveBeenCalled();
	});

	test('rejects cached remote actors before resolving them', async () => {
		const fetchPerson = vi.fn();
		const person = service(ApPersonService.prototype, { utilityService: localUtility(), fetchPerson });
		await expect(person.resolvePerson('https://remote.example/users/alice')).rejects.toThrow('Federation is disabled.');
		expect(fetchPerson).not.toHaveBeenCalled();
	});

	test.each(['processUnfollow', 'processBlock', 'processUnblock'] as const)('preserves remote relationships in leftover %s jobs', async method => {
		const unfollow = vi.fn();
		const block = vi.fn();
		const unblock = vi.fn();
		const processor = service(RelationshipProcessorService.prototype, {
			logger: { info: vi.fn() },
			usersRepository: { findOneByOrFail: vi.fn().mockResolvedValue({ host: 'remote.example' }) },
			userFollowingService: { unfollow },
			userBlockingService: { block, unblock },
		});
		expect(await processor[method]({ data: { from: { id: 'local' }, to: { id: 'remote' } } } as never)).toBe('skip (federation disabled)');
		expect(unfollow).not.toHaveBeenCalled();
		expect(block).not.toHaveBeenCalled();
		expect(unblock).not.toHaveBeenCalled();
	});

	test('skips remote follows in leftover jobs and imports', async () => {
		const userEntityService = { isRemoteUser: vi.fn() };
		const following = service(UserFollowingService.prototype, {
			usersRepository: { findOneByOrFail: vi.fn().mockResolvedValue({ host: 'remote.example' }) },
			userEntityService,
		});
		await following.follow({ id: 'local' }, { id: 'remote' });
		expect(userEntityService.isRemoteUser).not.toHaveBeenCalled();
	});

	test('excludes cached remote objects from API interactions', async () => {
		const findUser = vi.fn().mockResolvedValue({ id: 'remote', host: 'remote.example' });
		const findNote = vi.fn().mockResolvedValue({ id: 'remote-note', userHost: 'remote.example' });
		const getter = service(GetterService.prototype, {
			usersRepository: { findOneBy: findUser },
			notesRepository: { findOneBy: findNote, findOne: findNote },
		});

		await expect(getter.getUser('remote')).rejects.toThrow('No such user.');
		await expect(getter.getNote('remote-note')).rejects.toThrow('No such note.');
		await expect(getter.getNoteWithRelations('remote-note')).rejects.toThrow('No such note.');
		findUser.mockResolvedValue({ id: 'local', host: null });
		findNote.mockResolvedValue({ id: 'local-note', userHost: null });
		expect((await getter.getUser('local')).id).toBe('local');
		expect((await getter.getNote('local-note')).id).toBe('local-note');
	});

	test('rejects remote replies and renotes in scheduled and direct posting', async () => {
		const creator = service(NoteCreateService.prototype, {});
		const user = { id: 'local', username: 'alice', host: null, isBot: false, isCat: false };
		const remote = { userHost: 'remote.example' } as MiNote;
		await expect(creator.create(user, { reply: remote })).rejects.toThrow('No such reply target');
		await expect(creator.create(user, { renote: remote })).rejects.toThrow('No such renote target');
		await expect(creator.create(user, { visibleUsers: [{ id: 'remote', username: 'bob', host: 'remote.example', uri: 'https://remote.example/users/bob' }] })).rejects.toThrow('Federation is disabled.');
	});
});
