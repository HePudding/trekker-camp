/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createWriteStream, promises as fsp } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import walk from 'ignore-walk';
import { Pack } from 'tar/pack';
import meta from '../package.json' with { type: "json" };

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const ignore = [
	'**/.git/**/*',
	'**/*ignore',
	'**/.gitmodules',
	'private-assets',
	'private-assets/**',
	'packages/frontend/assets/camp',
	'packages/frontend/assets/camp/**',
	// Exclude files you don't want to include in the tarball here
];

export async function buildTarball(cwd = repoRoot) {
	const mkdirPromise = mkdir(resolve(cwd, 'built', 'tarball'), { recursive: true });
	const pack = new Pack({
		cwd,
		gzip: true,
		// Pack also visits directory children; enforce exclusions at that boundary.
		filter: path => !/^(private-assets|packages\/frontend\/assets\/camp)(\/|$)/.test(path.replaceAll('\\', '/')),
	});
	const patterns = await walk({ path: cwd, ignoreFiles: ['.gitignore'] });

	for await (const entry of fsp.glob(patterns, { cwd, ignore, dot: true })) {
		pack.add(entry);
	}

	pack.end();

	await mkdirPromise;

	await pipeline(pack, createWriteStream(resolve(cwd, 'built', 'tarball', `misskey-${meta.version}.tar.gz`)));
}
