/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-locales.mjs', import.meta.url));

for (const scenario of [
	{ file: 'zh-CN', state: 'working', status: 0 },
	{ file: 'ja-JP', state: 'staged', status: 0 },
	{ file: 'en-US', state: 'committed', status: 1 },
	{ file: 'zh-TW', state: 'untracked', status: 1 },
	{ file: 'en-US', state: 'deleted', status: 1 },
]) {
	test(`locale CLI checks ${scenario.state} ${scenario.file} changes`, (t) => {
		const tempRoot = resolve(tmpdir());
		const repo = mkdtempSync(join(tempRoot, 'trekker-locale-test-'));
		t.after(() => {
			const relativePath = relative(tempRoot, resolve(repo));
			assert.ok(!isAbsolute(relativePath) && !relativePath.startsWith('..') && relativePath.startsWith('trekker-locale-test-'));
			rmSync(repo, { recursive: true, force: true });
		});
		const env = {
			...process.env,
			GIT_AUTHOR_NAME: 'Locale test', GIT_AUTHOR_EMAIL: 'locale-test@example.invalid',
			GIT_COMMITTER_NAME: 'Locale test', GIT_COMMITTER_EMAIL: 'locale-test@example.invalid',
		};
		const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
		git('init', '--quiet');
		const file = join(repo, 'locales', `${scenario.file}.yml`);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(join(repo, 'README.md'), 'Locale fixture\n');
		if (scenario.state !== 'untracked') writeFileSync(file, 'hello: initial\n');
		git('add', '.');
		git('commit', '--quiet', '-m', 'Initial fixture');
		const base = git('rev-parse', 'HEAD');

		if (scenario.state === 'deleted') rmSync(file);
		else writeFileSync(file, 'hello: changed\n');
		if (scenario.state === 'staged' || scenario.state === 'committed') git('add', '.');
		if (scenario.state === 'committed') git('commit', '--quiet', '-m', 'Change locale');

		const result = spawnSync(process.execPath, [script, '--base', base], { cwd: repo, env, encoding: 'utf8' });
		assert.equal(result.status, scenario.status, result.stderr);
		if (scenario.status === 0) assert.match(result.stdout, /Locale safety: PASS/);
		else assert.match(result.stderr, new RegExp(`forbidden locale change: locales/${scenario.file}\\.yml`));
	});
}
