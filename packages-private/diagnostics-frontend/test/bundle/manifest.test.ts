/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { collectBundleReport } from '../../src/bundle/manifest';
import type { BundleManifest } from '../../src/bundle/manifest';

const tempRoot = resolve(tmpdir());
let workDir: string;

beforeAll(async () => {
	workDir = await mkdtemp(join(tempRoot, 'diagnostics-frontend-test-'));
});

afterAll(async () => {
	const cleanupPath = resolve(workDir);
	expect(dirname(cleanupPath)).toBe(tempRoot);
	expect(basename(cleanupPath)).toMatch(/^diagnostics-frontend-test-/);
	await rm(cleanupPath, { recursive: true, force: true });
});

async function createBuild(name: string, manifest: BundleManifest, files: Record<string, number>) {
	const repoDir = join(workDir, name);
	const outDir = join(repoDir, 'built/_frontend_vite_');
	await mkdir(outDir, { recursive: true });
	await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest));
	for (const [file, size] of Object.entries(files)) {
		const filePath = join(outDir, file);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, 'x'.repeat(size));
	}
	return repoDir;
}

test('fails loudly when the built output is missing', async () => {
	await expect(collectBundleReport(join(workDir, 'nonexistent'))).rejects.toThrow();
});

test('collects manifest, generated chunks and startup files from a Chinese-only build', async () => {
	const manifest: BundleManifest = {
		'src/_boot_.ts': { file: 'assets/boot.js', src: 'src/_boot_.ts', isEntry: true, imports: ['_i18n.js'] },
		'_i18n.js': { file: 'scripts/i18n.js', name: 'i18n' },
		'src/pages/lazy.vue': { file: 'assets/lazy.js', src: 'src/pages/lazy.vue' },
		'style.css': { file: 'assets/style.css' },
	};
	const repoDir = await createBuild('chinese', manifest, {
		'assets/boot.js': 12,
		'assets/lazy.js': 9,
		'assets/style.css': 3,
		'zh-CN/i18n.js': 7,
		'zh-CN/nested/orphan.js': 5,
		'zh-CN/ignored.css': 4,
	});

	const report = await collectBundleReport(repoDir);

	expect(report.manifest).toEqual(manifest);
	expect(report.chunks).toHaveLength(4);
	expect(report.chunks.reduce((sum, chunk) => sum + chunk.size, 0)).toBe(33);
	expect(report.chunksByManifestKey['_i18n.js']).toMatchObject({ file: 'zh-CN/i18n.js', size: 7, manifestKeys: ['_i18n.js'] });
	expect(report.comparableChunks['named:i18n']).toBe(report.chunksByManifestKey['_i18n.js']);
	expect(report.chunks.find(chunk => chunk.file === 'zh-CN/nested/orphan.js')).toMatchObject({ comparisonKey: null, manifestKeys: [], size: 5 });
	expect(report.startupFiles).toEqual(['assets/boot.js', 'zh-CN/i18n.js']);
});

test('rejects a missing Chinese chunk even when the Japanese output exists', async () => {
	const repoDir = await createBuild('japanese-only', {
		'src/_boot_.ts': { file: 'scripts/boot.js', src: 'src/_boot_.ts', isEntry: true },
	}, {
		'ja-JP/boot.js': 12,
	});

	await expect(collectBundleReport(repoDir)).rejects.toThrow('Expected zh-CN localized chunk for scripts/boot.js');
});

test('resolves non-localized assets without requiring a locale directory', async () => {
	const repoDir = await createBuild('assets-only', {
		'src/_boot_.ts': { file: 'assets/boot.js', src: 'src/_boot_.ts', isEntry: true },
	}, {
		'assets/boot.js': 12,
	});

	const report = await collectBundleReport(repoDir);
	expect(report.chunks).toHaveLength(1);
	expect(report.chunks[0]).toMatchObject({ file: 'assets/boot.js', size: 12 });
	expect(report.startupFiles).toEqual(['assets/boot.js']);
});
