<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="file" :class="$style.root" :style="boxStyle">
	<MkMediaList :mediaList="[file]" :user="user"/>
</div>
<span v-else :class="$style.missing">{{ i18n.tsx._longNote.inlineImageMissing({ n: index }) }}</span>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import MkMediaList from '@/components/MkMediaList.vue';
import { computed } from 'vue';
import { i18n } from '@/i18n.js';

// 正文插图は読みやすさのため一定の高さの枠に収める（画像はサーバー側で縮小済みのサムネイルを表示）
const INLINE_IMAGE_MAX_HEIGHT = 280;

const props = defineProps<{
	file: Misskey.entities.DriveFile | null;
	index: number;
	user?: Misskey.entities.UserLite;
}>();

const boxStyle = computed(() => {
	const w = props.file?.properties.width;
	const h = props.file?.properties.height;
	const ratio = w && h ? w / h : 16 / 9;
	return {
		aspectRatio: `${ratio}`,
		width: `min(100%, ${Math.round(INLINE_IMAGE_MAX_HEIGHT * ratio)}px)`,
	};
});
</script>

<style lang="scss" module>
.root {
	display: block;
	margin: 8px 0;
	white-space: normal;
	max-width: 100%;
	max-height: 280px;

	// MkMediaList（root > container > medias）を枠いっぱいに広げ、1枚表示時の独自の縦横比・高さ制限を無効化する
	> div,
	> div > div,
	> div > div > div {
		height: 100%;
	}

	> div > div > div {
		aspect-ratio: auto !important;
		min-height: 0 !important;
		max-height: none !important;
	}
}

.missing {
	opacity: 0.6;
	font-size: 0.9em;
}
</style>
