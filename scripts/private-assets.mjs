/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { lstat, mkdir, realpath, stat, symlink, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export async function checkSourceLocation(root, source) {
	const within = relative(await realpath(root), source);
	const outside = isAbsolute(within) || within === '..' || within.startsWith('..' + sep);
	const publicDirectory = ['private-assets', 'public'].join(sep);
	if (!outside && within !== publicDirectory && !within.startsWith(publicDirectory + sep)) {
		throw new Error('Artwork inside this checkout must be under private-assets/public; use an external directory to share artwork.');
	}
}

/** Connect separately managed, web-ready artwork to the existing static route. */
export async function linkPrivateAssets(root = repoRoot, source = process.env.CAMP_ASSETS_DIR) {
	const target = resolve(root, 'packages/frontend/assets/camp');
	const current = await lstat(target).catch(error => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current && !current.isSymbolicLink()) {
		throw new Error(`${target} already exists as a regular directory or file; keep its contents and move it before linking artwork.`);
	}

	// Reuse the link across dev runs, including links to another worktree's assets.
	if (current && !source) {
		if (!(await stat(target)).isDirectory()) throw new Error(`Artwork link is not a directory: ${target}`);
		const existingSource = await realpath(target);
		await checkSourceLocation(root, existingSource);
		return existingSource;
	}

	const sourcePath = resolve(root, source || 'private-assets/public');
	if (sourcePath === target || sourcePath.startsWith(target + sep)) {
		throw new Error('Artwork source must be separate from the serving link.');
	}
	if (!source) await mkdir(sourcePath, { recursive: true });
	if (!(await stat(sourcePath)).isDirectory()) throw new Error(`Artwork source is not a directory: ${sourcePath}`);
	const resolvedSource = await realpath(sourcePath);
	await checkSourceLocation(root, resolvedSource);
	if (current) {
		const oldSource = await realpath(target).catch(error => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (oldSource === resolvedSource) return resolvedSource;
		await unlink(target);
	}
	await mkdir(dirname(target), { recursive: true });
	await symlink(resolvedSource, target, process.platform === 'win32' ? 'junction' : 'dir');
	return resolvedSource;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const source = await linkPrivateAssets();
		console.log(`Artwork: ${source} -> /client-assets/camp/`);
	} catch (error) {
		console.error(`Artwork: ${error.message}`);
		process.exitCode = 1;
	}
}
