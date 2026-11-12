/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function fixture(t) {
	const root = await mkdtemp(join(tmpdir(), 'camp-start-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const app = join(root, 'apps/misskey');
	const backend = join(app, 'packages/backend');
	for (const directory of ['scripts', 'packages/backend/scripts', 'packages/backend/built', 'packages/backend/node_modules/typeorm']) {
		await mkdir(join(app, directory), { recursive: true });
	}
	await copyFile(new URL('./start.mjs', import.meta.url), join(app, 'scripts/start.mjs'));
	await writeFile(join(backend, 'package.json'), '{"type":"module"}');
	await writeFile(join(backend, 'node_modules/typeorm/package.json'), '{"type":"module"}');
	const log = join(root, 'steps.jsonl');
	const record = `import { appendFileSync } from 'node:fs';
appendFileSync(process.env.CAMP_START_TEST_LOG, JSON.stringify({
	step: STEP, cwd: process.cwd(), argv: process.argv.slice(2), execArgv: process.execArgv,
	nodeOptions: process.env.NODE_OPTIONS, config: process.env.MISSKEY_CONFIG_YML,
	preloaded: globalThis.campStartPreloaded,
}) + '\\n');
process.exit(Number(process.env['CAMP_START_TEST_FAIL_' + STEP] || 0));
`;
	for (const [file, step] of [['scripts/check_connect.js', 'check'], ['built/entry.js', 'entry'], ['node_modules/typeorm/cli.js', 'migrate']]) {
		await writeFile(join(backend, file), record.replaceAll('STEP', JSON.stringify(step)));
	}
	return {
		root, backend,
		async run(args = [], env = {}) {
			return execFileAsync(process.execPath, [...args, join(app, 'scripts/start.mjs')], {
				cwd: root,
				env: { ...process.env, NODE_OPTIONS: '', CAMP_START_TEST_LOG: log, ...env },
			});
		},
		async steps() {
			return (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
		},
		start: join(app, 'scripts/start.mjs'),
		log,
	};
}

test('starts the backend from the monorepo root and forwards Node options', async t => {
	const f = await fixture(t);
	await mkdir(join(f.root, 'preload files'));
	await writeFile(join(f.root, 'preload files/setup.mjs'), 'globalThis.campStartPreloaded = true;');
	await f.run(['--max-old-space-size=128'], {
		NODE_OPTIONS: '--import="./preload files/setup.mjs"',
		MISSKEY_CONFIG_YML: 'custom.yml',
	});
	const steps = await f.steps();
	assert.deepEqual(steps.map(step => step.step), ['check', 'entry']);
	for (const step of steps) {
		assert.equal(step.cwd, f.backend);
		assert.equal(step.config, 'custom.yml');
		assert.equal(step.preloaded, true);
	}
	assert.deepEqual(steps[1].execArgv, ['--max-old-space-size=128']);
});

test('migrates before checking connections and starting the backend', async t => {
	const f = await fixture(t);
	await execFileAsync(process.execPath, [f.start, '--migrate'], {
		cwd: f.root,
		env: { ...process.env, NODE_OPTIONS: '', CAMP_START_TEST_LOG: f.log },
	});
	const steps = await f.steps();
	assert.deepEqual(steps.map(step => step.step), ['migrate', 'check', 'entry']);
	assert.deepEqual(steps[0].argv, ['migration:run', '-d', 'ormconfig.js']);
});

for (const failure of ['migrate', 'check']) {
	test(`does not start after a failed ${failure} step`, async t => {
		const f = await fixture(t);
		await assert.rejects(execFileAsync(process.execPath, [f.start, '--migrate'], {
			cwd: f.root,
			env: { ...process.env, NODE_OPTIONS: '', CAMP_START_TEST_LOG: f.log, [`CAMP_START_TEST_FAIL_${failure}`]: '23' },
		}), { code: 23 });
		assert.deepEqual((await f.steps()).map(step => step.step), failure === 'migrate' ? ['migrate'] : ['migrate', 'check']);
	});
}
