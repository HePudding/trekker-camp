/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type AchievementSettings = {
	musicBilibiliIds: string[];
	musicNeteaseIds: string[];
	musicUrls: string[];
};

export const DEFAULT_ACHIEVEMENT_SETTINGS: AchievementSettings = {
	musicBilibiliIds: ['BV1ky4xzaER1', 'BV1dfqBYqEm3', 'BV1f6d5B2ERX'],
	musicNeteaseIds: [],
	musicUrls: [
		'https://youtu.be/Efrlqw8ytg4',
		'https://www.youtube.com/watch?v=Efrlqw8ytg4',
		'https://m.youtube.com/watch?v=Efrlqw8ytg4',
		'https://youtu.be/XVCwzwxdHuA',
		'https://www.youtube.com/watch?v=XVCwzwxdHuA',
		'https://m.youtube.com/watch?v=XVCwzwxdHuA',
		'https://open.spotify.com/track/3Cuj0mZrlLoXx9nydNi7RB',
		'https://open.spotify.com/track/7anfcaNPQWlWCwyCHmZqNy',
		'https://open.spotify.com/track/5Odr16TvEN4my22K9nbH7l',
		'https://open.spotify.com/album/5bOlxyl4igOrp2DwVQxBco',
	],
};

export function matchesMusicAchievement(text: string, settings: AchievementSettings): boolean {
	if (settings.musicBilibiliIds.some(id => text.includes(id))) return true;
	if (settings.musicUrls.some(url => text.includes(url))) return true;
	if (settings.musicNeteaseIds.length === 0) return false;

	for (const match of text.matchAll(/https?:\/\/[^\s<>"'\[\]（）()，。！？]+/gi)) {
		let url: URL;
		try {
			url = new URL(match[0]);
			if (!['music.163.com', 'y.music.163.com'].includes(url.hostname)) continue;
			if (url.hash.startsWith('#/')) url = new URL(url.hash.slice(1), url.origin);
		} catch {
			continue;
		}
		if (!['music.163.com', 'y.music.163.com'].includes(url.hostname)) continue;
		if (!/^\/(?:m\/)?song\/?$/.test(url.pathname)) continue;
		const songId = url.searchParams.get('id');
		if (songId !== null && settings.musicNeteaseIds.includes(songId)) return true;
	}
	return false;
}

export function matchesCommunityLoveAchievement(text: string): boolean {
	const lowerText = text.toLowerCase();
	const englishLove = lowerText.includes('love') || text.includes('❤');
	return (lowerText.includes('misskey') && englishLove) ||
		((text.includes('旅人营地') || text.includes('星塔旅人')) &&
			(englishLove || text.includes('爱') || text.includes('喜欢')));
}

export function matchesNicknameAchievement(name: string): boolean {
	return name === 'syuilo' || name === 'しゅいろ';
}
