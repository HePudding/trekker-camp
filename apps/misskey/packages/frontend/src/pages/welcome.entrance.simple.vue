<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meta" :class="$style.root">
	<MkFeaturedPhotos :class="$style.bg"/>
	<div :class="$style.logoWrapper">
		<img v-if="!logoFailed" :key="logoUrl" :src="logoUrl" :class="$style.logo" alt="旅人营地" @error="logoFailed = true"/>
		<span v-else :class="$style.logoFallback">旅人营地</span>
	</div>
	<div :class="$style.contents">
		<MkVisitorDashboard/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import MkFeaturedPhotos from '@/components/MkFeaturedPhotos.vue';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';
import { instance as meta } from '@/instance.js';
import { store } from '@/store.js';

const logoFailed = ref(false);
const logoUrl = computed(() => `/client-assets/trekker-camp/branding/wordmark-${meta.backgroundImageUrl || store.s.darkMode ? 'light' : 'dark'}-v1.png`);
</script>

<style lang="scss" module>
.root {
	height: 100cqh;
	overflow: auto;
	overscroll-behavior: contain;
}

.bg {
	position: fixed;
	top: 0;
	right: 0;
	width: 100vw;
	height: 100vh;
	// 固定レイヤがホイール操作を奪い、コンテンツ列以外の上でページをスクロールできなくなるのを防ぐ (issue #17680)
	pointer-events: none;
}

.logoWrapper {
	position: fixed;
	top: 36px;
	left: 36px;
	flex: auto;
	color: var(--MI_THEME-fg);
	user-select: none;
	pointer-events: none;
}

.logoFallback {
	font-size: 24px;
	font-weight: bold;
}

.logo {
	display: block;
	width: 200px;
	height: auto;

	@media (max-width: 450px) {
		width: 160px;
	}
}

.contents {
	position: relative;
	width: min(430px, calc(100% - 32px));
	margin: auto;
	padding: 100px 0 100px 0;
}
</style>
