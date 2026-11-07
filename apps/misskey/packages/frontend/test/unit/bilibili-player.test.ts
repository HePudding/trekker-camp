/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getBilibiliPlayer } from '@/utility/url-preview.js';

describe('getBilibiliPlayer', () => {
	test.each([
		'https://www.bilibili.com/video/BV1B7411m7LV',
		'https://bilibili.com/video/BV1B7411m7LV/',
		'http://m.bilibili.com/video/BV1B7411m7LV/',
	])('embeds the BV video at %s', (url) => {
		expect(getBilibiliPlayer(url)).toEqual({
			url: 'https://player.bilibili.com/player.html?bvid=BV1B7411m7LV',
			width: 640,
			height: 360,
			allow: ['autoplay', 'fullscreen', 'encrypted-media', 'picture-in-picture'],
		});
	});

	test('embeds an av video', () => {
		expect(getBilibiliPlayer('https://www.bilibili.com/video/av170001/')?.url)
			.toBe('https://player.bilibili.com/player.html?aid=170001');
	});

	test('preserves the selected part and starting time without tracking parameters', () => {
		expect(getBilibiliPlayer('https://www.bilibili.com/video/BV1B7411m7LV/?p=2&t=30.5&spm_id_from=333.1007&vd_source=tracking#reply')?.url)
			.toBe('https://player.bilibili.com/player.html?bvid=BV1B7411m7LV&p=2&t=30.5');
	});

	test('accepts a starting time of zero', () => {
		expect(getBilibiliPlayer('https://www.bilibili.com/video/av170001?p=1&t=0')?.url)
			.toBe('https://player.bilibili.com/player.html?aid=170001&p=1&t=0');
	});

	test.each(['p=0&t=-1', 'p=-2&t=abc', 'p=1.5&t=Infinity', 'p=abc&t=', 'p=&t=1e3'])(
		'ignores invalid playback parameters: %s', (query) => {
			expect(getBilibiliPlayer(`https://www.bilibili.com/video/BV1B7411m7LV?${query}`)?.url)
				.toBe('https://player.bilibili.com/player.html?bvid=BV1B7411m7LV');
		},
	);

	test.each([
		'not a URL',
		'javascript:alert(1)',
		'ftp://www.bilibili.com/video/BV1B7411m7LV',
		'https://www.bilibili.com.example.com/video/BV1B7411m7LV',
		'https://www.bilibili.com@evil.example/video/BV1B7411m7LV',
		'https://space.bilibili.com/video/BV1B7411m7LV',
		'https://b23.tv/example',
		'https://www.bilibili.com/',
		'https://www.bilibili.com/bangumi/play/ep123',
		'https://www.bilibili.com/video/BV123',
		'https://www.bilibili.com/video/BV1B7411m7LVextra',
		'https://www.bilibili.com/video/BV1B7411m7LV/other',
		'https://www.bilibili.com/video/av0',
		'https://www.bilibili.com/video/av123abc',
	])('does not create a player for %s', (url) => {
		expect(getBilibiliPlayer(url)).toBeNull();
	});
});
