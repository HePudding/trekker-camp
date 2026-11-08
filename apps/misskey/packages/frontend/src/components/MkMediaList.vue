<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<XBanner v-for="media in medias.nonPreviewable" :key="media.id" :media="media"/>
	<div v-if="count > 0" :class="$style.container">
		<div
			ref="gallery"
			:class="[
				$style.medias,
				...(prefer.s.showMediaListByGridInWideArea && count === 1 ? [$style.gridInWideArea] : []),
				count === 1 ? [$style.n1, {
					[$style.n116_9]: prefer.s.mediaListWithOneImageAppearance === '16_9',
					[$style.n11_1]: prefer.s.mediaListWithOneImageAppearance === '1_1',
					[$style.n12_3]: prefer.s.mediaListWithOneImageAppearance === '2_3',
				}] : $style.carousel,
			]"
			@scroll.passive="updateArrows"
		>
			<template v-for="media in medias.previewable">
				<XAudio
					v-if="media.type.startsWith('audio')"
					:key="`audio:${media.id}`"
					:class="$style.media"
					:style="count > 1 ? carouselItemStyle(media) : undefined"
					:audio="media"
					@mediaClick="onMediaClick(media)"
				/>
				<XVideo
					v-if="media.type.startsWith('video')"
					:key="`video:${media.id}`"
					:ref="(comp) => { mediaComponents.set(media.id, comp as InstanceType<typeof XVideo> | null); }"
					:class="$style.media"
					:style="count > 1 ? carouselItemStyle(media) : undefined"
					:video="media"
					@mediaClick="onMediaClick(media)"
				/>
				<XImage
					v-else-if="media.type.startsWith('image')"
					:key="`image:${media.id}`"
					:ref="(comp) => { mediaComponents.set(media.id, comp as InstanceType<typeof XImage> | null); }"
					:marker="`${markerId}:${media.id}`"
					:disableImageLink="true"
					:class="$style.media"
					:style="count > 1 ? carouselItemStyle(media) : undefined"
					:image="media"
					:raw="raw"
					@mediaClick="onMediaClick(media)"
				/>
			</template>
		</div>
		<template v-if="count > 1">
			<button v-show="canScrollPrev" :class="[$style.arrow, $style.arrowPrev]" class="_button" :aria-label="i18n.ts._longNote.prevMedia" @click.stop="scrollCarousel(-1)"><i class="ti ti-chevron-left"></i></button>
			<button v-show="canScrollNext" :class="[$style.arrow, $style.arrowNext]" class="_button" :aria-label="i18n.ts._longNote.nextMedia" @click.stop="scrollCarousel(1)"><i class="ti ti-chevron-right"></i></button>
		</template>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import type { Content } from '@/components/MkLightbox.item.vue';
import type { MediaComponentExposes } from '@/types/media-component.js';
import XBanner from '@/components/MkMediaBanner.vue';
import XAudio from '@/components/MkMediaAudio.vue';
import XImage from '@/components/MkMediaImage.vue';
import XVideo from '@/components/MkMediaVideo.vue';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { isPreviewable, getType } from '@/utility/lightbox.js';
import { genId } from '@/utility/id.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	mediaList: Misskey.entities.DriveFile[];
	user?: Misskey.entities.User | null; // DriveFileのuserはnullになることがある。その場合に使用する所有者情報
	raw?: boolean;
}>();

const gallery = useTemplateRef('gallery');
const medias = computed(() => {
	const previewable: Misskey.entities.DriveFile[] = [];
	const nonPreviewable: Misskey.entities.DriveFile[] = [];
	for (const file of props.mediaList) {
		if (isPreviewable(file.type)) {
			previewable.push(file);
		} else {
			nonPreviewable.push(file);
		}
	}

	return {
		previewable,
		nonPreviewable,
	};
});
const mediaComponents = new Map<string, MediaComponentExposes | null>();
const count = computed(() => medias.value.previewable.length);
const markerId = genId();

async function calcAspectRatio() {
	if (!gallery.value) return;

	const img = props.mediaList[0];

	if (props.mediaList.length !== 1 || !(img.properties.width && img.properties.height)) {
		gallery.value.style.aspectRatio = '';
		return;
	}

	const ratioMax = (ratio: number) => {
		if (img.properties.width == null || img.properties.height == null) return '';
		return `${Math.max(ratio, img.properties.width / img.properties.height).toString()} / 1`;
	};

	switch (prefer.s.mediaListWithOneImageAppearance) {
		case '16_9':
			gallery.value.style.aspectRatio = ratioMax(16 / 9);
			break;
		case '1_1':
			gallery.value.style.aspectRatio = ratioMax(1 / 1);
			break;
		case '2_3':
			gallery.value.style.aspectRatio = ratioMax(2 / 3);
			break;
		default:
			gallery.value.style.aspectRatio = '';
			break;
	}
}

// 複数メディアは横スクロールのカルーセルで表示する（高さを揃え、幅は各メディアの縦横比に合わせる）
const canScrollPrev = ref(false);
const canScrollNext = ref(false);

function carouselItemStyle(media: Misskey.entities.DriveFile) {
	const w = media.properties.width;
	const h = media.properties.height;
	const ratio = media.type.startsWith('audio') ? 4 / 3 : w && h ? Math.min(Math.max(w / h, 0.5), 2) : 1;
	return { aspectRatio: `${ratio}` };
}

function updateArrows() {
	const el = gallery.value;
	if (el == null || count.value < 2) return;
	canScrollPrev.value = el.scrollLeft > 1;
	canScrollNext.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollCarousel(dir: 1 | -1) {
	const el = gallery.value;
	if (el == null) return;
	el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: prefer.s.animation ? 'smooth' : 'instant' });
}

onMounted(() => {
	calcAspectRatio();
	nextTick(updateArrows);

	if (gallery.value == null) return; // TSを黙らすため
});

onUnmounted(() => {
	mediaComponents.clear();
});

function onMediaClick(file: Misskey.entities.DriveFile) {
	if (prefer.s.imageNewTab) {
		window.open(file.url, '_blank');
		return;
	}
	openGallery(file.id);
}

async function openGallery(id?: string) {
	if (id == null) {
		const firstImage = medias.value.previewable[0];
		if (firstImage == null) return;
		id = firstImage.id;
	}

	const getElementByMarker = (marker: string) => {
		if (gallery.value == null) return null;
		const found = gallery.value.querySelector(`[data-marker="${marker}"]`) as HTMLElement | null;
		if (found == null) return null;
		return markRaw(found);
	};

	const contents = medias.value.previewable.map<Content>(media => ({
		id: media.id,
		type: getType(media.type),
		url: media.url,
		thumbnailUrl: media.thumbnailUrl,
		width: media.properties.width,
		height: media.properties.height,
		filename: media.name,
		file: media,
		sourceElement: getElementByMarker(`${markerId}:${media.id}`),
	}));

	const initiallyRevealedContentIds = contents
		.filter(content => mediaComponents.get(content.id)?.isRevealed() === true)
		.map(content => content.id);

	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkLightbox.vue').then(x => x.default), {
		defaultIndex: contents.findIndex(conten => conten.id === id),
		contents: contents,
		initiallyRevealedContentIds,
		user: props.user,
	}, {
		closed: () => dispose(),
	});
}

defineExpose({
	openGallery,
});
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
}

.container {
	position: relative;
	width: 100%;
}

.medias {
	display: grid;
	grid-gap: 8px;

	height: 100%;
	width: 100%;

	&.n1 {
		grid-template-rows: 1fr;

		// default but fallback (expand)
		min-height: 64px;
		max-height: clamp(
			64px,
			50cqh,
			min(360px, 50vh)
		);

		&.n116_9 {
			min-height: initial;
			max-height: initial;
			aspect-ratio: 16 / 9; // fallback
		}

		&.n11_1{
			min-height: initial;
			max-height: initial;
			aspect-ratio: 1 / 1; // fallback
		}

		&.n12_3 {
			min-height: initial;
			max-height: initial;
			aspect-ratio: 2 / 3; // fallback
		}
	}

	&.carousel {
		display: flex;
		gap: 8px;
		height: clamp(160px, 60cqw, 280px);
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}

		> .media {
			flex: 0 0 auto;
			height: 100%;
			max-width: 85%;
			scroll-snap-align: start;
		}
	}
}

.arrow {
	position: absolute;
	top: 50%;
	z-index: 1;
	display: none;
	width: 34px;
	height: 34px;
	margin-top: -17px;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.6);
	color: #fff;
	backdrop-filter: blur(4px);

	&:hover {
		background: rgba(0, 0, 0, 0.75);
	}

	// 矢印はマウス操作の環境だけで出す（タッチ端末はスワイプで送る）
	@media (hover: hover) and (pointer: fine) {
		display: grid;
		place-items: center;
	}
}

.arrowPrev {
	left: 8px;
}

.arrowNext {
	right: 8px;
}

.media {
	overflow: hidden; // clipにするとバグる
	border-radius: 8px;
	cursor: zoom-in;
}

@container (min-width: 500px) {
	.medias.gridInWideArea {
		display: grid;
		aspect-ratio: auto;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: auto;
		grid-gap: 8px;

		> .media {
			aspect-ratio: 1 / 1;
		}
	}
}
</style>
