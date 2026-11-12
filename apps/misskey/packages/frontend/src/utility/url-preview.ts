/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { computed } from 'vue';
import { hostname } from '@@/js/config.js';
import type { SummalyResult } from '@misskey-dev/summaly';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';

export const isEnabledUrlPreview = computed(() => (instance.enableUrlPreview && !prefer.r.dataSaver.value.disableUrlPreview));

export function getBilibiliPlayer(url: string): SummalyResult['player'] | null {
	let videoUrl: URL;
	try {
		videoUrl = new URL(url);
	} catch {
		return null;
	}

	if (!['https:', 'http:'].includes(videoUrl.protocol)) return null;
	if (!['bilibili.com', 'www.bilibili.com', 'm.bilibili.com'].includes(videoUrl.hostname)) return null;

	const videoId = videoUrl.pathname.match(/^\/video\/(BV[a-zA-Z0-9]{10}|av[1-9][0-9]*)\/?$/)?.[1];
	if (!videoId) return null;

	const playerUrl = new URL('https://player.bilibili.com/player.html');
	if (videoId.startsWith('BV')) {
		playerUrl.searchParams.set('bvid', videoId);
	} else {
		playerUrl.searchParams.set('aid', videoId.slice(2));
	}

	const page = videoUrl.searchParams.get('p');
	if (page && /^[1-9][0-9]*$/.test(page)) playerUrl.searchParams.set('p', page);

	const time = videoUrl.searchParams.get('t');
	if (time && /^[0-9]+(?:\.[0-9]+)?$/.test(time)) playerUrl.searchParams.set('t', time);

	return {
		url: playerUrl.toString(),
		width: 640,
		height: 360,
		allow: ['autoplay', 'fullscreen', 'encrypted-media', 'picture-in-picture'],
	};
}

export function transformPlayerUrl(url: string): string {
	const urlObj = new URL(url);
	if (!['https:', 'http:'].includes(urlObj.protocol)) throw new Error('Invalid protocol');

	const urlParams = new URLSearchParams(urlObj.search);

	if (urlObj.hostname === 'player.twitch.tv' || urlObj.hostname === 'clips.twitch.tv') {
		// TwitchはCSPの制約あり
		// https://dev.twitch.tv/docs/embed/video-and-clips/
		urlParams.set('parent', hostname);
		urlParams.set('allowfullscreen', '');

		urlParams.set('autoplay', prefer.s.autoplayEmbededPlayerOfUrlPreview ? 'true' : 'false');
	} else {
		urlParams.set('autoplay', prefer.s.autoplayEmbededPlayerOfUrlPreview ? '1' : '0');
		urlParams.set('auto_play', prefer.s.autoplayEmbededPlayerOfUrlPreview ? '1' : 'false');
	}
	urlObj.search = urlParams.toString();

	return urlObj.toString();
}
