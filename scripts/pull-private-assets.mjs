/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execFileSync } from 'node:child_process';
import { access, lstat, mkdir, realpath } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSourceLocation, linkPrivateAssets } from './private-assets.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryUrl = 'https://github.com/HePudding/trekker-camp-assets.git';

function git(directory, args, options = {}) {
	return execFileSync('git', ['-C', directory, ...args], {
		encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' }, ...options,
	}).trim();
}

function sameRepository(actual, expected) {
	const normalize = url => url.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '').toLowerCase();
	return normalize(actual) === normalize(expected);
}

/** Fetch artwork explicitly, preserving dirty worktrees and divergent branches. */
export async function pullPrivateAssets(root = repoRoot, { source = process.env.CAMP_ASSETS_DIR, repository = repositoryUrl } = {}) {
	let publicDirectory = resolve(root, source || 'private-assets/public');
	const link = resolve(root, 'apps/misskey/packages/frontend/assets/camp');
	if (!source) {
		const existing = await lstat(link).catch(error => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (existing?.isSymbolicLink()) publicDirectory = await realpath(link);
	}
	if (basename(publicDirectory) !== 'public') throw new Error('assets:pull requires the public/ directory at the root of the artwork repository.');
	await checkSourceLocation(root, publicDirectory);
	const directory = dirname(publicDirectory);
	await mkdir(directory, { recursive: true });
	const initialized = await access(resolve(directory, '.git')).then(() => true, error => {
		if (error.code === 'ENOENT') return false;
		throw error;
	});
	if (!initialized) {
		git(directory, ['init', '--initial-branch=master']);
		git(directory, ['remote', 'add', 'origin', repository]);
	}
	const actualRoot = await realpath(git(directory, ['rev-parse', '--show-toplevel']));
	if (actualRoot !== await realpath(directory)) throw new Error('The artwork directory must be its own Git repository.');
	if (!sameRepository(git(directory, ['remote', 'get-url', 'origin']), repository)) {
		throw new Error('The artwork origin points to another repository; it was left unchanged.');
	}
	if (!initialized) git(directory, ['lfs', 'update']);
	if (git(directory, ['status', '--porcelain', '--untracked-files=all'])) {
		throw new Error('Artwork has local changes. Commit or save them before assets:pull; no files were overwritten.');
	}
	if (git(directory, ['symbolic-ref', '--quiet', '--short', 'HEAD']) !== 'master') {
		throw new Error('Artwork is on a topic branch. Switch it to master before assets:pull.');
	}
	git(directory, ['fetch', '--no-tags', 'origin', 'master']);
	let hasHead = true;
	try { git(directory, ['rev-parse', '--verify', 'HEAD']); } catch { hasHead = false; }
	if (hasHead) git(directory, ['merge', '--ff-only', 'origin/master']);
	else git(directory, ['checkout', '-b', 'master', '--track', 'origin/master']);
	git(directory, ['lfs', 'pull', '--include=public/**', '--exclude=']);
	const linked = await linkPrivateAssets(root, publicDirectory);
	return { directory, publicDirectory: linked, revision: git(directory, ['rev-parse', 'HEAD']) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const result = await pullPrivateAssets();
		console.log(`Artwork synced: ${result.revision}\n${result.publicDirectory} -> /client-assets/camp/`);
	} catch (error) {
		console.error(`Artwork sync failed: ${error.message}`);
		process.exitCode = 1;
	}
}
