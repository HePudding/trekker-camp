/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert, afterEach, vi, expect } from 'vitest';
import { render, cleanup, fireEvent, type RenderResult } from '@testing-library/vue';
import type { SummalyResult } from '@misskey-dev/summaly';
import { components } from '@/components/index.js';
import { directives } from '@/directives/index.js';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import MkYouTubePlayer from '@/components/MkYouTubePlayer.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

describe('MkUrlPreview', () => {
	const renderPreviewBy = async (summary: Partial<SummalyResult>, url = summary.url!): Promise<RenderResult> => {
		if (!summary.player) {
			summary.player = {
				url: null,
				width: null,
				height: null,
				allow: [],
			};
		}

		fetchMock.mockOnceIf((req) => {
			const url = new URL(req.url);
			return url.pathname === '/url';
		}, () => {
			return {
				status: 200,
				body: JSON.stringify(summary),
			};
		});

		const result = render(MkUrlPreview, {
			props: { url },
			global: { directives, components },
		});

		await new Promise<void>(resolve => {
			const observer = new MutationObserver(() => {
				resolve();
				observer.disconnect();
			});
			observer.observe(result.container, { childList: true, subtree: true });
		});

		return result;
	};

	const renderAndOpenPreview = async (summary: Partial<SummalyResult>): Promise<HTMLIFrameElement | null> => {
		const mkUrlPreview = await renderPreviewBy(summary);
		const buttons = mkUrlPreview.getAllByRole('button');
		buttons[0].click();
		// Wait for the click event to be fired
		await Promise.resolve();

		return mkUrlPreview.container.querySelector('iframe');
	};

	afterEach(() => {
		fetchMock.resetMocks();
		vi.restoreAllMocks();
		cleanup();
	});

	test('Should render the description', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			description: 'Mocked description',
		});
		mkUrlPreview.getByText('Mocked description');
	});

	test('Having a player should render a button', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: [],
			},
		});
		const buttons = mkUrlPreview.getAllByRole('button');
		assert.strictEqual(buttons.length, 2, 'two buttons');
	});

	test('Having a player should setup the iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.src, 'https://example.local/player?autoplay=1&auto_play=1');
		assert.strictEqual(
			iframe?.sandbox.toString(),
			'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-storage-access-by-user-activation allow-same-origin',
		);
	});

	test('Having a player with `allow` field should set permissions', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: ['fullscreen', 'web-share'],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'fullscreen;web-share');
	});

	test('A Summaly proxy response without allow falls back to the default', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: undefined as any,
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'autoplay;encrypted-media;fullscreen');
	});

	test('Filtering the allow list from the Summaly proxy', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: ['autoplay', 'camera', 'fullscreen'],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'autoplay;fullscreen');
	});

	test('Having a player width should keep the fixed aspect ratio', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: 400,
				height: 200,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.parentElement?.style.paddingTop, '50%');
	});

	test('Having a player width should keep the fixed height', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: 200,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.parentElement?.style.paddingTop, '200px');
	});

	test('Bilibili links open and close an official player without player metadata', async () => {
		const preview = await renderPreviewBy({
			url: 'https://www.bilibili.com/video/BV1B7411m7LV/',
			title: 'Video title',
		}, 'https://www.bilibili.com/video/BV1B7411m7LV/?p=2&t=30&spm_id_from=333.1007');
		assert.isNull(preview.container.querySelector('iframe'));
		await fireEvent.click(preview.getByRole('button', { name: i18n.ts.enablePlayer }));
		const iframe = preview.container.querySelector('iframe');
		assert.exists(iframe);
		const playerUrl = new URL(iframe!.src);
		assert.strictEqual(playerUrl.origin, 'https://player.bilibili.com');
		assert.strictEqual(playerUrl.pathname, '/player.html');
		assert.strictEqual(playerUrl.searchParams.get('bvid'), 'BV1B7411m7LV');
		assert.strictEqual(playerUrl.searchParams.get('p'), '2');
		assert.strictEqual(playerUrl.searchParams.get('t'), '30');
		assert.strictEqual(playerUrl.searchParams.get('autoplay'), '1');
		assert.isFalse(playerUrl.searchParams.has('spm_id_from'));
		assert.strictEqual(iframe!.parentElement?.style.paddingTop, '56.25%');
		assert.include(iframe!.allow, 'fullscreen');
		await fireEvent.click(preview.getByRole('button', { name: i18n.ts.disablePlayer }));
		assert.isNull(preview.container.querySelector('iframe'));
		preview.getByText('Video title');
	});

	test('Bilibili short links use the resolved video URL', async () => {
		const preview = await renderPreviewBy({
			url: 'https://www.bilibili.com/video/BV1B7411m7LV/?p=3',
		}, 'https://b23.tv/example');
		await fireEvent.click(preview.getByRole('button', { name: i18n.ts.enablePlayer }));
		const playerUrl = new URL(preview.container.querySelector('iframe')!.src);
		assert.strictEqual(playerUrl.searchParams.get('bvid'), 'BV1B7411m7LV');
		assert.strictEqual(playerUrl.searchParams.get('p'), '3');
	});

	test.each(['http', 'network', 'empty'] as const)('Bilibili playback survives a %s preview failure, including window playback', async (failure) => {
		const popup = vi.spyOn(os, 'popup').mockReturnValue({ dispose: vi.fn() });
		fetchMock.mockOnceIf(req => new URL(req.url).pathname === '/url', async () => {
			if (failure === 'network') throw new TypeError('Failed to fetch');
			return { body: '{}', status: failure === 'http' ? 503 : 200 };
		});
		const url = 'https://www.bilibili.com/video/BV1B7411m7LV/';
		const preview = render(MkUrlPreview, {
			props: { url },
			global: { directives, components },
		});
		await preview.findByText(i18n.ts.failedToPreviewUrl);
		await fireEvent.click(preview.getByRole('button', { name: i18n.ts.openInWindow }));
		expect(popup).toHaveBeenCalledWith(expect.anything(), {
			urlOrSummalyResult: {
				url,
				title: url,
				player: expect.objectContaining({ url: 'https://player.bilibili.com/player.html?bvid=BV1B7411m7LV' }),
			},
		}, expect.anything());
		await fireEvent.click(preview.getByRole('button', { name: i18n.ts.enablePlayer }));
		assert.exists(preview.container.querySelector('iframe'));
	});

	test('The player window renders the supplied Bilibili player and branding', () => {
		const player = render(MkYouTubePlayer, {
			props: {
				urlOrSummalyResult: {
					url: 'https://www.bilibili.com/video/BV1B7411m7LV/',
					title: 'Video title',
					player: {
						url: 'https://player.bilibili.com/player.html?bvid=BV1B7411m7LV',
						width: 640,
						height: 360,
						allow: ['autoplay', 'fullscreen'],
					},
				},
			},
			global: {
				components,
				stubs: { MkWindow: { template: '<div><slot name="header"/><slot/></div>' } },
			},
		});
		const iframe = player.container.querySelector('iframe');
		assert.exists(iframe);
		assert.strictEqual(new URL(iframe!.src).hostname, 'player.bilibili.com');
		assert.exists(player.container.querySelector('.ti-brand-bilibili'));
		player.getByText('Video title');
	});

	test('Loading a tweet in iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://twitter.com/i/web/status/1685072521782325249',
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.getAttribute('allow'), 'fullscreen;web-share');
		assert.strictEqual(iframe?.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin');
	});

	test('Loading a post in iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://x.com/i/web/status/1685072521782325249',
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.getAttribute('allow'), 'fullscreen;web-share');
		assert.strictEqual(iframe?.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin');
	});
});
