/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// @ts-check

import { fileURLToPath } from 'node:url';
import { DEFAULT_INTEGRATION_REFS, filterUnchangedRelocations, findClosestMergeBase, gitMergeBase, gitPaths } from './lib/git.mjs';

/**
 * 允许修改营地简中文案及上游同步源，其余语言文件由上游维护。
 *
 * @param {string[]} changedFiles
 * @returns {0 | 1}
 */
export function runLocaleSafety(changedFiles) {
	const badLocales = changedFiles.filter((file) => (
		file.startsWith('apps/misskey/locales/') &&
		file.endsWith('.yml') &&
		file !== 'apps/misskey/locales/zh-CN.yml' &&
		file !== 'apps/misskey/locales/ja-JP.yml'
	));
	if (badLocales.length === 0) {
		console.log('Locale safety: PASS');
		return 0;
	}
	for (const file of badLocales) console.error(`forbidden locale change: ${file}`);
	return 1;
}

/** @returns {0 | 1 | 2} */
function main() {
	const args = process.argv.slice(2);
	if (args.length !== 0 && !(args.length === 2 && args[0] === '--base' && args[1] !== '' && !args[1].startsWith('--'))) {
		console.error('usage: node scripts/check-locales.mjs [--base <ref>]');
		return 2;
	}

	try {
		const ref = args[1] || process.env.MISSKEY_BASE_REF;
		const base = ref ? gitMergeBase(ref) : findClosestMergeBase(DEFAULT_INTEGRATION_REFS);
		const changedFiles = [...new Set([
			...gitPaths(['diff', '--name-only', '-z', `${base}...HEAD`]),
			...gitPaths(['diff', '--name-only', '-z', 'HEAD']),
			...gitPaths(['ls-files', '--others', '--exclude-standard', '-z']),
		])];
		return runLocaleSafety(filterUnchangedRelocations(changedFiles, base));
	} catch (error) {
		console.error(`Locale safety: ${error instanceof Error ? error.message : String(error)}`);
		return 2;
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	process.exitCode = main();
}
