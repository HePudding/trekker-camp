/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { linkPrivateAssets } from './private-assets.mjs';
import { pullPrivateAssets } from './pull-private-assets.mjs';

const gitEnvironment = {
	...process.env,
	GIT_AUTHOR_NAME: 'Artwork test', GIT_AUTHOR_EMAIL: 'artwork-test@example.invalid',
	GIT_COMMITTER_NAME: 'Artwork test', GIT_COMMITTER_EMAIL: 'artwork-test@example.invalid',
};

function git(cwd, ...args) {
	return execFileSync('git', args, { cwd, env: gitEnvironment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fixture(t) {
	const parent = resolve(tmpdir());
	const temporary = mkdtempSync(join(parent, 'camp-pull-test-'));
	const root = join(temporary, 'workspace');
	const seed = join(temporary, 'seed');
	const remote = join(temporary, 'remote.git');
	mkdirSync(root);
	mkdirSync(seed);
	git(temporary, 'init', '--bare', '--initial-branch=master', remote);
	git(seed, 'init', '--initial-branch=master');
	mkdirSync(join(seed, 'public'));
	writeFileSync(join(seed, 'public', 'image.svg'), '<svg/>');
	git(seed, 'add', '.');
	git(seed, 'commit', '-m', 'Initial artwork');
	git(seed, 'remote', 'add', 'origin', remote);
	git(seed, 'push', '-u', 'origin', 'master');
	t.after(() => {
		const within = relative(parent, temporary);
		assert.ok(!isAbsolute(within) && within.startsWith('camp-pull-test-') && !within.includes('..'));
		for (const workspace of [root, join(temporary, 'second-worktree')]) {
			try { unlinkSync(join(workspace, 'packages/frontend/assets/camp')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
		}
		rmSync(temporary, { recursive: true, force: true });
	});
	return { root, seed, remote, temporary };
}

test('first pull initializes an empty local asset directory, then fast-forwards', async t => {
	const { root, seed, remote } = fixture(t);
	await linkPrivateAssets(root, '');
	const initial = await pullPrivateAssets(root, { source: '', repository: remote });
	assert.equal(initial.revision, git(seed, 'rev-parse', 'HEAD'));
	assert.equal((await pullPrivateAssets(root, { source: '', repository: remote })).revision, initial.revision);
	writeFileSync(join(seed, 'public', 'image.svg'), '<svg>updated</svg>');
	git(seed, 'add', '.');
	git(seed, 'commit', '-m', 'Update artwork');
	git(seed, 'push');
	await pullPrivateAssets(root, { source: '', repository: remote });
	assert.equal(readFileSync(join(root, 'packages/frontend/assets/camp/image.svg'), 'utf8'), '<svg>updated</svg>');
});

test('pull preserves uncommitted assets and topic branches', async t => {
	const { root, remote } = fixture(t);
	const { directory } = await pullPrivateAssets(root, { source: '', repository: remote });
	writeFileSync(join(directory, 'public', 'new.svg'), '<svg>local</svg>');
	await assert.rejects(pullPrivateAssets(root, { source: '', repository: remote }), /local changes/);
	assert.equal(readFileSync(join(directory, 'public', 'new.svg'), 'utf8'), '<svg>local</svg>');
	git(directory, 'add', '.');
	git(directory, 'commit', '-m', 'Local artwork');
	git(directory, 'switch', '-c', 'artwork');
	await assert.rejects(pullPrivateAssets(root, { source: '', repository: remote }), /topic branch/);
	assert.equal(git(directory, 'branch', '--show-current'), 'artwork');
});

test('pull refuses divergent history and preserves the local commit', async t => {
	const { root, seed, remote } = fixture(t);
	const { directory } = await pullPrivateAssets(root, { source: '', repository: remote });
	writeFileSync(join(directory, 'public', 'local.svg'), '<svg>local</svg>');
	git(directory, 'add', '.');
	git(directory, 'commit', '-m', 'Local change');
	const localHead = git(directory, 'rev-parse', 'HEAD');
	writeFileSync(join(seed, 'public', 'remote.svg'), '<svg>remote</svg>');
	git(seed, 'add', '.');
	git(seed, 'commit', '-m', 'Remote change');
	git(seed, 'push');
	await assert.rejects(pullPrivateAssets(root, { source: '', repository: remote }));
	assert.equal(git(directory, 'rev-parse', 'HEAD'), localHead);
});

test('pull follows the existing shared worktree link and rejects another origin', async t => {
	const { root, remote, temporary } = fixture(t);
	const first = await pullPrivateAssets(root, { source: '', repository: remote });
	const second = join(temporary, 'second-worktree');
	mkdirSync(second);
	await linkPrivateAssets(second, first.publicDirectory);
	const shared = await pullPrivateAssets(second, { source: '', repository: remote });
	assert.equal(shared.directory, first.directory);
	await assert.rejects(pullPrivateAssets(second, { source: '', repository: remote + '-different' }), /another repository/);
	assert.equal(git(shared.directory, 'remote', 'get-url', 'origin'), remote);
});
