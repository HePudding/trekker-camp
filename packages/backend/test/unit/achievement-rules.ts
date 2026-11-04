/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { DEFAULT_ACHIEVEMENT_SETTINGS, matchesCommunityLoveAchievement, matchesMusicAchievement, matchesNicknameAchievement } from '@/misc/achievement-rules.js';
import type { AchievementSettings } from '@/misc/achievement-rules.js';

const settings: AchievementSettings = {
	musicBilibiliIds: ['BV1xx411c7mD'],
	musicNeteaseIds: ['123456789'],
	musicUrls: ['https://example.com/music/theme'],
};

describe('Achievement music rules', () => {
	test.each([
		'听听 BV1xx411c7mD 吧',
		'https://www.bilibili.com/video/BV1xx411c7mD/?p=2',
		'https://m.bilibili.com/video/BV1xx411c7mD',
		'https://music.163.com/#/song?id=123456789',
		'https://music.163.com/song?id=123456789&userid=9876',
		'https://y.music.163.com/m/song?id=123456789&app_version=1',
		'分享歌曲（https://music.163.com/song?id=123456789）。',
		'[听歌](https://music.163.com/song?id=123456789)',
		'https://example.com/music/theme?ref=camp',
	])('matches configured music: %s', text => {
		expect(matchesMusicAchievement(text, settings)).toBe(true);
	});

	test.each([
		'123456789',
		'https://music.163.com/song?id=1234567890',
		'https://music.163.com/playlist?id=123456789',
		'https://example.com/song?id=123456789',
		'https://music.163.com.example.com/song?id=123456789',
		'https://music.163.com@evil.test/song?id=123456789',
		'https://www.bilibili.com/video/BV1yy411c7mD',
		'https://music.163.com/song?userid=123456789',
		'https://music.163.com/#//',
		'https://music.163.com/#//example.com/song?id=123456789',
	])('does not match unrelated IDs or links: %s', text => {
		expect(matchesMusicAchievement(text, settings)).toBe(false);
	});

	test('uses replaced settings on the next check', () => {
		const meta = { achievementSettings: structuredClone(settings) };
		expect(matchesMusicAchievement('BV1xx411c7mD', meta.achievementSettings)).toBe(true);
		meta.achievementSettings = { ...settings, musicBilibiliIds: ['BV1yy411c7mD'] };
		expect(matchesMusicAchievement('BV1xx411c7mD', meta.achievementSettings)).toBe(false);
		expect(matchesMusicAchievement('BV1yy411c7mD', meta.achievementSettings)).toBe(true);
	});

	test('retains the original music defaults', () => {
		for (const url of DEFAULT_ACHIEVEMENT_SETTINGS.musicUrls) {
			expect(matchesMusicAchievement(url, DEFAULT_ACHIEVEMENT_SETTINGS)).toBe(true);
		}
	});
});

describe('Community and nickname achievements', () => {
	test.each(['I LOVE Misskey', 'Misskey ❤', '我爱旅人营地', '喜欢星塔旅人', '星塔旅人 LOVE', '旅人营地❤'])('recognizes affection: %s', text => {
		expect(matchesCommunityLoveAchievement(text)).toBe(true);
	});

	test.each(['旅人营地', '星塔旅人', '我喜欢游戏', 'Misskey', 'Misskey 爱'])('requires both matching parts: %s', text => {
		expect(matchesCommunityLoveAchievement(text)).toBe(false);
	});

	test('recognizes only the original author names', () => {
		for (const name of ['syuilo', 'しゅいろ']) {
			expect(matchesNicknameAchievement(name)).toBe(true);
		}
		for (const name of ['测试角色', 'syuilo的朋友', 'Syuilo', '魔王']) {
			expect(matchesNicknameAchievement(name)).toBe(false);
		}
	});
});
