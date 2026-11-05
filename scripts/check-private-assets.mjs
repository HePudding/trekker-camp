/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const privatePaths = ['private-assets', 'packages/frontend/assets/camp'];

/** Reject artwork or a private repository/link accidentally added to the index. */
export function checkPrivateAssets(cwd = process.cwd()) {
	const tracked = execFileSync('git', ['ls-files', '--cached', '-z', '--', ...privatePaths], { cwd, encoding: 'utf8' })
		.split('\0').filter(Boolean);
	if (tracked.length > 0) {
		throw new Error(`Private artwork must stay outside Git:\n${tracked.join('\n')}`);
	}
	// A link has no trailing slash; matching it also excludes the entire subtree.
	const probes = privatePaths;
	const ignored = execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
		cwd, encoding: 'utf8', input: probes.join('\0') + '\0',
	}).split('\0');
	const missing = probes.filter(path => !ignored.includes(path));
	if (missing.length > 0) throw new Error(`Missing artwork Git exclusions: ${missing.join(', ')}`);
	console.log('Private assets: PASS');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		checkPrivateAssets();
	} catch (error) {
		console.error(`Private assets: FAIL — ${error.message}`);
		process.exitCode = 1;
	}
}
