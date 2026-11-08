/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setImmediate } from 'node:timers/promises';
import { expect, test, vi } from 'vitest';
import { NotificationService } from '@/core/NotificationService.js';
import { allSettled } from '@/misc/promise-tracker.js';

vi.mock('node:timers/promises', async (importOriginal) => ({
	...await importOriginal<typeof import('node:timers/promises')>(),
	setTimeout: vi.fn().mockResolvedValue(undefined),
}));

test('shutdown waits for a delayed notification user query', async () => {
	const queryStarted = Promise.withResolvers<void>();
	const query = Promise.withResolvers<never>();
	const service = new NotificationService(
		{ perUserNotificationsMaxCount: 100 } as never,
		{ xadd: vi.fn().mockResolvedValue('1-0'), get: vi.fn().mockResolvedValue(null) } as never,
		{ findOneByOrFail: vi.fn(() => {
			queryStarted.resolve();
			return query.promise;
		}) } as never,
		{ pack: vi.fn().mockResolvedValue({}) } as never,
		{ gen: () => 'notification', parseFull: () => ({ date: 1, additional: 0n }) } as never,
		{ publishMainStream: vi.fn() } as never,
		{ pushNotification: vi.fn() } as never,
		{
			userProfileCache: { fetch: vi.fn().mockResolvedValue({}) },
			userMutingsCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
		} as never,
		{} as never,
	);

	service.createNotification('recipient', 'follow', {}, 'follower');
	await queryStarted.promise;
	let drained = false;
	const shutdown = allSettled().then(() => { drained = true; });
	try {
		await setImmediate();
		expect(drained).toBe(false);
	} finally {
		query.resolve({} as never);
		await shutdown;
		service.dispose();
	}
	expect(drained).toBe(true);
});
