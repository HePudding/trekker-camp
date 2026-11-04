/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import locales from 'i18n';
import { languages } from 'i18n/const';

describe('Chinese locales', () => {
	it('only publishes Simplified and Traditional Chinese', () => {
		expect(languages).toEqual(['zh-CN', 'zh-TW']);
		expect(Object.keys(locales)).toEqual(['zh-CN', 'zh-TW']);
	});

	it('preserves Traditional Chinese and fills missing translations from Simplified Chinese', () => {
		expect(locales['zh-TW']._lang_).toBe('繁體中文（台灣）');
		expect(locales['zh-TW']._announcement.autoArchiveAt).toBe(locales['zh-CN']._announcement.autoArchiveAt);
		expect(locales['zh-TW']._followApproval).toEqual(locales['zh-CN']._followApproval);
	});
});

const languageCases = [
	{ stored: null, browser: 'en-US', expected: 'zh-CN' },
	{ stored: null, browser: 'ja-JP', expected: 'zh-CN' },
	{ stored: null, browser: 'zh', expected: 'zh-CN' },
	{ stored: null, browser: 'zh-TW', expected: 'zh-TW' },
	{ stored: 'en-US', browser: 'en-US', expected: 'zh-CN' },
	{ stored: 'ja-JP', browser: 'ja-JP', expected: 'zh-CN' },
	{ stored: 'null', browser: 'fr-FR', expected: 'zh-CN' },
	{ stored: 'zh-CN', browser: 'zh-TW', expected: 'zh-CN' },
	{ stored: 'zh-TW', browser: 'en-US', expected: 'zh-TW' },
];

describe.each([
	['main', resolve(import.meta.dirname, '../../public/loader/boot.js')],
	['embed', resolve(import.meta.dirname, '../../../frontend-embed/public/loader/boot.js')],
])('%s bootloader', (_name, bootloaderUrl) => {
	const source = readFileSync(bootloaderUrl, 'utf-8');

	it.each(languageCases)('loads $expected for saved $stored and browser $browser', async ({ stored, browser, expected }) => {
		const storage = new Map<string, string>();
		if (stored !== null) storage.set('lang', stored);

		await runInNewContext(source, {
			LANGS: languages,
			navigator: { language: browser },
			localStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
			window: { location: { search: '' }, addEventListener: vi.fn() },
			document: { readyState: 'loading' },
			location: { search: '' },
			URLSearchParams,
		});

		expect(storage.get('lang')).toBe(expected);
	});
});

describe('shared client language', () => {
	afterEach(() => {
		localStorage.removeItem('lang');
	});

	it.each([null, 'en-US', 'ja-JP', 'zh-CN', 'zh-TW'])('normalizes saved language %s', async (stored) => {
		vi.resetModules();
		if (stored !== null) localStorage.setItem('lang', stored);

		const { lang, langs } = await import('@@/js/config.js');
		expect(lang).toBe(stored === 'zh-TW' ? 'zh-TW' : 'zh-CN');
		expect(langs.map(([code]) => code)).toEqual(['zh-CN', 'zh-TW']);
	});
});
