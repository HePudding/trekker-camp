/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, describe, test, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { GlobalModule } from '@/GlobalModule.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';
import { CoreModule } from '@/core/CoreModule.js';
import { MiMeta } from '@/models/Meta.js';
import type { Redis } from 'ioredis';
import type { TestingModule } from '@nestjs/testing';
import type { DataSource } from 'typeorm';

describe('MetaService', () => {
	let app: TestingModule;
	let metaService: MetaService;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [
				GlobalModule,
				CoreModule,
			],
		}).compile();

		app.enableShutdownHooks();

		metaService = app.get<MetaService>(MetaService, { strict: false });

		// Make it cached
		await metaService.fetch();
	});

	afterAll(async () => {
		await app.close();
	});

	test('fetch (cache)', async () => {
		const db = app.get<DataSource>(DI.db);
		const spy = vi.spyOn(db, 'transaction');

		const result = await metaService.fetch();

		expect(result.id).toBe('x');
		expect(spy).toHaveBeenCalledTimes(0);
	});

	test('fetch (force)', async () => {
		const db = app.get<DataSource>(DI.db);
		const spy = vi.spyOn(db, 'transaction');

		const result = await metaService.fetch(true);

		expect(result.id).toBe('x');
		expect(spy).toHaveBeenCalledTimes(1);
	});

	test('keeps legacy database settings and updates in local mode', async () => {
		const db = app.get<DataSource>(DI.db);
		await db.getRepository(MiMeta).update('x', { federation: 'all' });

		expect((await metaService.fetch(true)).federation).toBe('none');
		expect(app.get<MiMeta>(DI.meta).federation).toBe('none');
		expect((await metaService.update({ federation: 'specified' })).federation).toBe('none');
		expect((await db.getRepository(MiMeta).findOneByOrFail({ id: 'x' })).federation).toBe('none');
		expect((await metaService.fetch()).federation).toBe('none');
	});

	test('ignores federation settings received from other processes', async () => {
		const meta = await metaService.fetch();
		app.get<Redis>(DI.redisForSub).emit('message', 'test', JSON.stringify({
			channel: 'internal',
			message: { type: 'metaUpdated', body: { before: meta, after: { ...meta, federation: 'all' } } },
		}));

		expect((await metaService.fetch()).federation).toBe('none');
		expect(app.get<MiMeta>(DI.meta).federation).toBe('none');
	});
});
