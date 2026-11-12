/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('monorepo runtime configuration', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv('MISSKEY_CONFIG_YML', '');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	test.each(['test', 'production'])('resolves %s configuration from the repository root', async (environment) => {
		vi.stubEnv('NODE_ENV', environment);
		const config = await import('@/config.js');
		expect(config.path).toBe(resolve(import.meta.dirname, '../../../../../../.config', environment === 'test' ? 'test.yml' : 'default.yml'));
	});

	test('resolves custom configuration relative to the root configuration directory', async () => {
		vi.stubEnv('MISSKEY_CONFIG_YML', 'custom.yml');
		const config = await import('@/config.js');
		expect(config.path).toBe(resolve(import.meta.dirname, '../../../../../../.config/custom.yml'));
	});

	test('reads the selected YAML directly and picks up edits without a compile step', async () => {
		const directory = await mkdtemp(resolve(tmpdir(), 'camp-config-'));
		try {
			const file = resolve(directory, 'runtime.yml');
			vi.stubEnv('MISSKEY_CONFIG_YML', file);
			const { loadConfig } = await import('@/config.js');
			const yaml = 'url: https://camp.example\nport: 3000\ndb:\n  host: localhost\n  port: 5432\n  db: camp\n  user: camp\n  pass: test\nredis:\n  host: localhost\n  port: 6379\nid: aidx\n';
			await writeFile(file, yaml);
			const first = loadConfig();
			expect(first.url).toBe('https://camp.example');
			expect(first.rootDir).toBe(resolve(import.meta.dirname, '../../../..'));
			expect(first.db.db).toBe('camp');
			await writeFile(file, yaml.replace('https://camp.example', 'https://updated.example'));
			expect(loadConfig().url).toBe('https://updated.example');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
