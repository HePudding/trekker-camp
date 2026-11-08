<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPagination :paginator="paginator">
	<template #empty>
		<div :class="$style.empty">{{ i18n.ts._noteComments.empty }}</div>
	</template>
	<template #default="{ items }">
		<template v-for="item in items" :key="item.id">
			<MkNoteCommentThread v-if="isDirectReply(item, note.id)" :comment="item"/>
		</template>
	</template>
</MkPagination>
</template>

<script lang="ts" setup>
import { computed, markRaw, onBeforeUnmount } from 'vue';
import * as Misskey from 'misskey-js';
import MkPagination from '@/components/MkPagination.vue';
import MkNoteCommentThread from '@/components/MkNoteCommentThread.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';
import { globalEvents } from '@/events.js';
import { isDirectReply } from '@/utility/comment-thread.js';

const props = defineProps<{
	note: Misskey.entities.Note;
}>();

const paginator = markRaw(new Paginator('notes/children', {
	limit: 20,
	computedParams: computed(() => ({
		noteId: props.note.id,
	})),
}));

// このノートへの返信が投稿されたら評論区の先頭に出す
function onNotePosted(posted: Misskey.entities.Note) {
	if (posted.replyId !== props.note.id) return;
	if (paginator.items.value.some(item => item.id === posted.id)) return;
	paginator.prepend(posted);
}

globalEvents.on('notePosted', onNotePosted);
onBeforeUnmount(() => {
	globalEvents.off('notePosted', onNotePosted);
});
</script>

<style lang="scss" module>
.empty {
	padding: 32px 16px;
	text-align: center;
	opacity: 0.7;
}
</style>
