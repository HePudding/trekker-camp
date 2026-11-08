<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="file" :class="$style.root">
	<MkMediaList :mediaList="[file]" :user="user"/>
</div>
<span v-else :class="$style.missing">{{ i18n.tsx._longNote.inlineImageMissing({ n: index }) }}</span>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import MkMediaList from '@/components/MkMediaList.vue';
import { i18n } from '@/i18n.js';

defineProps<{
	file: Misskey.entities.DriveFile | null;
	index: number;
	user?: Misskey.entities.UserLite;
}>();
</script>

<style lang="scss" module>
.root {
	display: block;
	margin: 8px 0;
	white-space: normal;
}

.missing {
	opacity: 0.6;
	font-size: 0.9em;
}
</style>
