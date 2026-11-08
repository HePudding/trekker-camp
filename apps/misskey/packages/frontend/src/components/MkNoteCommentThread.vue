<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<MkNote :note="comment" hideReplyTo/>
	<div v-if="replies.length > 0" :class="$style.replies">
		<div v-for="reply in visibleReplies" :key="reply.id" :class="$style.reply">
			<div v-if="reply.replyId !== comment.id && reply.reply != null" :class="$style.replyTarget">
				<i class="ti ti-arrow-back-up"></i>
				<I18n :src="i18n.ts._noteComments.replyTo" tag="span">
					<template #user>
						<MkA v-user-preview="reply.reply.userId" :to="userPage(reply.reply.user)" :class="$style.replyTargetUser">
							<MkUserName :user="reply.reply.user"/>
						</MkA>
					</template>
				</I18n>
			</div>
			<MkNote :note="reply" hideReplyTo dense/>
		</div>
		<button
			v-if="replies.length > COMMENT_PREVIEW_COUNT"
			class="_button"
			:class="$style.toggle"
			:aria-expanded="expanded"
			@click="expanded = !expanded"
		>
			<template v-if="expanded">{{ i18n.ts._noteComments.collapseReplies }} <i class="ti ti-chevron-up"></i></template>
			<template v-else>{{ i18n.tsx._noteComments.viewAllReplies({ n: replies.length }) }} <i class="ti ti-chevron-down"></i></template>
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import * as Misskey from 'misskey-js';
import MkNote from '@/components/MkNote.vue';
import { i18n } from '@/i18n.js';
import { userPage } from '@@/js/user.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { globalEvents } from '@/events.js';
import { COMMENT_PREVIEW_COUNT, fetchThreadReplies } from '@/utility/comment-thread.js';

const props = defineProps<{
	comment: Misskey.entities.Note;
}>();

const replies = shallowRef<Misskey.entities.Note[]>([]);
const expanded = ref(false);

const visibleReplies = computed(() => expanded.value ? replies.value : replies.value.slice(0, COMMENT_PREVIEW_COUNT));

if (props.comment.repliesCount > 0) {
	fetchThreadReplies(props.comment.id, (noteId, limit, untilId) => misskeyApi('notes/children', { noteId, limit, untilId })).then(res => {
		replies.value = res;
	});
}

// この楼中楼への返信が投稿されたら末尾に足して開く
function onNotePosted(note: Misskey.entities.Note) {
	if (note.replyId == null) return;
	if (note.replyId !== props.comment.id && !replies.value.some(r => r.id === note.replyId)) return;
	if (replies.value.some(r => r.id === note.id)) return;
	replies.value = [...replies.value, note];
	expanded.value = true;
}

globalEvents.on('notePosted', onNotePosted);
onBeforeUnmount(() => {
	globalEvents.off('notePosted', onNotePosted);
});
</script>

<style lang="scss" module>
.root {
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.replies {
	margin: 0 16px 12px 72px;
	border-left: solid 2px var(--MI_THEME-divider);
	font-size: 0.95em;
}

.replyTarget {
	padding: 8px 16px 0 16px;
	margin-bottom: -6px;
	font-size: 0.85em;
	opacity: 0.7;
}

.replyTargetUser {
	color: var(--MI_THEME-accent);
}

.toggle {
	display: block;
	padding: 8px 16px 10px 16px;
	font-size: 0.9em;
	color: var(--MI_THEME-accent);

	&:hover {
		text-decoration: underline;
	}
}

@container (max-width: 500px) {
	.replies {
		margin-left: 24px;
		margin-right: 8px;
	}
}
</style>
