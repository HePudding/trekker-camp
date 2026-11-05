/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { t as listTar } from 'tar';
import meta from '../package.json' with { type: 'json' };
import { checkPrivateAssets } from './check-private-assets.mjs';
import { linkPrivateAssets } from './private-assets.mjs';
import { buildTarball } from './tarball.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function fixture(t) {
	const tempRoot = resolve(tmpdir());
	const temporary = mkdtempSync(join(tempRoot, 'trekker-assets-test-'));
	const root = join(temporary, 'workspace with spaces');
	mkdirSync(root);
	t.after(() => {
		const within = relative(tempRoot, temporary);
		assert.ok(!isAbsolute(within) && within.startsWith('trekker-assets-test-') && !within.includes('..'));
		const link = join(root, 'packages/frontend/assets/camp');
		if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link);
		rmSync(temporary, { recursive: true, force: true });
	});
	return root;
}

function write(root, path, content) {
	const file = join(root, path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
}

function git(root, ...args) {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

test('local link is idempotent and serves edits without copying private metadata', async t => {
	const root = fixture(t);
	const source = await linkPrivateAssets(root, '');
	assert.equal(source, await linkPrivateAssets(root, ''));
	assert.ok(lstatSync(join(root, 'packages/frontend/assets/camp')).isSymbolicLink());
	write(root, 'private-assets/public/home/hero.webp', 'first artwork');
	write(root, 'private-assets/RIGHTS.md', 'private license record');
	write(root, 'private-assets/.git/config', 'private repository config');
	assert.equal(readFileSync(join(root, 'packages/frontend/assets/camp/home/hero.webp'), 'utf8'), 'first artwork');
	write(root, 'private-assets/public/home/hero.webp', 'updated artwork');
	assert.equal(readFileSync(join(root, 'packages/frontend/assets/camp/home/hero.webp'), 'utf8'), 'updated artwork');
	assert.equal(existsSync(join(root, 'packages/frontend/assets/camp/RIGHTS.md')), false);
	assert.equal(existsSync(join(root, 'packages/frontend/assets/camp/.git')), false);
});

test('worktrees can share an existing source and switch only the serving link', async t => {
	const root = fixture(t);
	write(root, 'private-assets/public/image.webp', 'original');
	await linkPrivateAssets(root, '');
	const shared = join(dirname(root), 'shared assets', 'public');
	mkdirSync(shared, { recursive: true });
	writeFileSync(join(shared, 'image.webp'), 'shared');
	assert.equal(await linkPrivateAssets(root, shared), await linkPrivateAssets(root, ''));
	assert.equal(readFileSync(join(root, 'packages/frontend/assets/camp/image.webp'), 'utf8'), 'shared');
	assert.equal(readFileSync(join(root, 'private-assets/public/image.webp'), 'utf8'), 'original');
	await assert.rejects(linkPrivateAssets(root, join(shared, 'missing')), /ENOENT/);
	assert.equal(readFileSync(join(root, 'packages/frontend/assets/camp/image.webp'), 'utf8'), 'shared');
});

test('existing files and directories are preserved', async t => {
	const root = fixture(t);
	write(root, 'packages/frontend/assets/camp/keep.webp', 'keep');
	await assert.rejects(linkPrivateAssets(root, ''), /already exists/);
	assert.equal(readFileSync(join(root, 'packages/frontend/assets/camp/keep.webp'), 'utf8'), 'keep');
});

test('sources inside the checkout must use the excluded public directory', async t => {
	const root = fixture(t);
	write(root, 'unprotected-artwork/image.webp', 'artwork');
	await assert.rejects(linkPrivateAssets(root, 'unprotected-artwork'), /must be under private-assets\/public/);
	await assert.rejects(linkPrivateAssets(root, 'private-assets/public'), /ENOENT/);
	assert.equal(existsSync(join(root, 'packages/frontend/assets/camp')), false);
	assert.equal(readFileSync(join(root, 'unprotected-artwork/image.webp'), 'utf8'), 'artwork');
});

test('Git ignores artwork and its link, and the check rejects forced additions', async t => {
	const root = fixture(t);
	git(root, 'init', '--quiet');
	copyFileSync(join(repoRoot, '.gitignore'), join(root, '.gitignore'));
	write(root, 'README.md', 'public project');
	write(root, 'private-assets/public/image.webp', 'private artwork');
	await linkPrivateAssets(root, '');
	git(root, 'add', '.');
	assert.deepEqual(git(root, 'ls-files', '-z').split('\0').filter(Boolean), ['.gitignore', 'README.md']);
	checkPrivateAssets(root);
	git(root, 'add', '--force', 'private-assets/public/image.webp');
	assert.throws(() => checkPrivateAssets(root), /Private artwork must stay outside Git/);
});

test('the source archive excludes private artwork even without Git ignore rules', async t => {
	const root = fixture(t);
	write(root, 'README.md', 'public project');
	write(root, 'packages/frontend/assets/default.txt', 'public default');
	write(root, 'private-assets/public/image.webp', 'private artwork');
	write(root, 'private-assets/RIGHTS.md', 'private license');
	await linkPrivateAssets(root, '');
	await buildTarball(root);
	const entries = [];
	await listTar({ file: join(root, 'built/tarball', `misskey-${meta.version}.tar.gz`), onReadEntry: entry => entries.push(entry.path) });
	assert.ok(entries.includes('README.md'));
	assert.ok(entries.includes('packages/frontend/assets/default.txt'));
	assert.equal(entries.some(path => path.startsWith('private-assets') || path.startsWith('packages/frontend/assets/camp')), false, entries.join('\n'));
});

test('Docker build excludes artwork and the deployment mounts only public files read-only', async t => {
	const available = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' });
	if (available.status !== 0) {
		t.skip('Docker engine unavailable');
		return;
	}
	const root = fixture(t);
	copyFileSync(join(repoRoot, '.dockerignore'), join(root, '.dockerignore'));
	write(root, 'README.md', 'public project');
	write(root, 'packages/frontend/assets/default.txt', 'public default');
	write(root, 'private-assets/public/image.webp', 'private artwork');
	write(root, 'private-assets/RIGHTS.md', 'private license');
	// A real directory also models a manually copied asset bundle or a container mount.
	write(root, 'packages/frontend/assets/camp/image.webp', 'private artwork');
	const output = join(dirname(root), 'docker-output');
	execFileSync('docker', ['build', '--file', '-', '--output', `type=local,dest=${output}`, root], {
		input: 'FROM scratch\nCOPY . /\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000,
	});
	assert.equal(readFileSync(join(output, 'README.md'), 'utf8'), 'public project');
	assert.equal(readFileSync(join(output, 'packages/frontend/assets/default.txt'), 'utf8'), 'public default');
	assert.equal(existsSync(join(output, 'private-assets')), false);
	assert.equal(existsSync(join(output, 'packages/frontend/assets/camp')), false);

	write(root, 'compose.yml', 'services:\n  web:\n    image: trekker-camp-test\n');
	copyFileSync(join(repoRoot, 'compose.assets.yml'), join(root, 'compose.assets.yml'));
	const env = { ...process.env, CAMP_ASSETS_DIR: '' };
	const compose = JSON.parse(execFileSync('docker', ['compose', '-f', 'compose.yml', '-f', 'compose.assets.yml', 'config', '--format', 'json'], {
		cwd: root, encoding: 'utf8', env,
	}));
	const mount = compose.services.web.volumes[0];
	assert.equal(mount.type, 'bind');
	assert.equal(mount.target, '/misskey/packages/frontend/assets/camp');
	assert.equal(mount.read_only, true);
	assert.equal(mount.bind?.create_host_path ?? false, false);
	assert.equal(resolve(mount.source), resolve(root, 'private-assets/public'));
});
