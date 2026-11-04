<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 1000px;">
	<div :class="$style.root">
		<MkFoldableSection class="item">
			<template #header>Stats</template>
			<XStats/>
		</MkFoldableSection>

		<MkFoldableSection class="item">
			<template #header>Active users</template>
			<XActiveUsers/>
		</MkFoldableSection>

		<MkFoldableSection class="item">
			<template #header>Heatmap</template>
			<XHeatmap/>
		</MkFoldableSection>

		<MkFoldableSection class="item">
			<template #header>Retention rate</template>
			<XRetention/>
		</MkFoldableSection>

		<MkFoldableSection class="item">
			<template #header>Moderators</template>
			<XModerators/>
		</MkFoldableSection>

		<MkFoldableSection class="item">
			<template #header>New users</template>
			<XUsers/>
		</MkFoldableSection>

	</div>
</div>
</template>

<script lang="ts" setup>
import XUsers from './overview.users.vue';
import XActiveUsers from './overview.active-users.vue';
import XStats from './overview.stats.vue';
import XRetention from './overview.retention.vue';
import XModerators from './overview.moderators.vue';
import XHeatmap from './overview.heatmap.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';

definePage(() => ({
	title: i18n.ts.dashboard,
	icon: 'ti ti-dashboard',
}));
</script>

<style lang="scss" module>
.root {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
	grid-gap: 16px;
}
</style>
