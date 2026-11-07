/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { DI } from '@/di-symbols.js';
import { QUEUE_TYPES, QueueService } from '@/core/QueueService.js';

function createQueue() {
	return {
		upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
		getJobSchedulers: vi.fn().mockResolvedValue([{ key: 'obsolete' }, { key: 'tickCharts' }]),
		removeJobScheduler: vi.fn().mockResolvedValue(true),
	};
}

function createModule(systemQueue: ReturnType<typeof createQueue>) {
	return Test.createTestingModule({
		providers: [
			QueueService,
			{ provide: DI.meta, useValue: { federation: 'none' } },
			{ provide: DI.config, useValue: {} },
			...QUEUE_TYPES.map(type => ({
				provide: `queue:${type}`,
				useValue: type === 'system' ? systemQueue : {},
			})),
		],
	}).compile();
}

describe('QueueService initialization', () => {
	test('does not start scheduler work when a compiled module is closed without initialization', async () => {
		const queue = createQueue();
		const app = await createModule(queue);

		await app.close();

		expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
		expect(queue.getJobSchedulers).not.toHaveBeenCalled();
		expect(queue.removeJobScheduler).not.toHaveBeenCalled();
	});

	test('waits for scheduler registration and obsolete scheduler removal before initialization completes', async () => {
		const queue = createQueue();
		const registration = Promise.withResolvers<void>();
		const removal = Promise.withResolvers<boolean>();
		queue.upsertJobScheduler.mockReturnValue(registration.promise);
		queue.removeJobScheduler.mockReturnValue(removal.promise);
		const app = await createModule(queue);
		const initialized = vi.fn();
		const initialization = app.init().then(initialized);

		try {
			await vi.waitFor(() => expect(queue.upsertJobScheduler).toHaveBeenCalled());
			expect(queue.getJobSchedulers).not.toHaveBeenCalled();
			expect(initialized).not.toHaveBeenCalled();

			registration.resolve();
			await vi.waitFor(() => expect(queue.removeJobScheduler).toHaveBeenCalledExactlyOnceWith('obsolete'));
			expect(initialized).not.toHaveBeenCalled();

			removal.resolve(true);
			await initialization;
			expect(queue.upsertJobScheduler.mock.calls.map(([name]) => name)).toContain('tickCharts');
			expect(initialized).toHaveBeenCalledOnce();
		} finally {
			registration.resolve();
			removal.resolve(true);
			await initialization;
			await app.close();
		}
	});

	test.each(['upsertJobScheduler', 'getJobSchedulers', 'removeJobScheduler'] as const)('propagates %s failures from initialization', async method => {
		const queue = createQueue();
		const failure = new Error('Redis unavailable');
		queue[method].mockRejectedValue(failure);
		const app = await createModule(queue);

		try {
			await expect(app.get(QueueService).onModuleInit()).rejects.toBe(failure);
		} finally {
			await app.close();
		}
	});
});
