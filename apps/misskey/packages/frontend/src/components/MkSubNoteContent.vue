<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="[$style.root, { [$style.collapsed]: collapsed }]">
	<div>
		<span v-if="note.isHidden" style="opacity: 0.5">({{ i18n.ts.private }})</span>
		<span v-if="note.deletedAt" style="opacity: 0.5">({{ i18n.ts.deletedNote }})</span>
		<MkA v-if="note.replyId" :class="$style.reply" :to="`/notes/${note.replyId}`"><i class="ti ti-arrow-back-up"></i></MkA>
		<Mfm v-if="note.text" :text="note.text" :files="note.files" :parsedNodes="collapsed ? collapsedParsed : null" :author="note.user" :nyaize="'respect'" :emojiUrls="note.emojis"/>
		<MkA v-if="note.renoteId" :class="$style.rp" :to="`/notes/${note.renoteId}`">RN: ...</MkA>
	</div>
	<details v-if="galleryFiles.length > 0">
		<summary>({{ i18n.tsx.withNFiles({ n: galleryFiles.length }) }})</summary>
		<MkMediaList :mediaList="galleryFiles" :user="note.user"/>
	</details>
	<details v-if="note.poll">
		<summary>{{ i18n.ts.poll }}</summary>
		<MkPoll
			:noteId="note.id"
			:multiple="note.poll.multiple"
			:expiresAt="note.poll.expiresAt"
			:choices="$note?.pollChoices ?? note.poll.choices"
			:author="note.user"
			:emojiUrls="note.emojis"
		/>
	</details>
	<MkA v-if="note.hasPoll && note.poll == null" :to="`/notes/${note.id}`">({{ i18n.ts.poll }})</MkA>
	<button v-if="isLong && collapsed" :class="$style.fade" class="_button" @click="collapsed = false">
		<span :class="$style.fadeLabel">{{ i18n.ts.showMore }}</span>
	</button>
	<Transition
		v-else-if="isLong && !collapsed"
		:enterActiveClass="prefer.s.animation ? $style.transition_fc_enterActive : ''"
		:leaveActiveClass="prefer.s.animation ? $style.transition_fc_leaveActive : ''"
		:enterFromClass="prefer.s.animation ? $style.transition_fc_enterFrom : ''"
		:leaveToClass="prefer.s.animation ? $style.transition_fc_leaveTo : ''"
	>
		<button v-show="floatingVisible" :class="$style.showLess" class="_button" @click.stop="collapse()">
			<span :class="$style.showLessLabel"><i class="ti ti-chevron-up"></i> {{ i18n.ts._longNote.collapse }}</span>
		</button>
	</Transition>
</div>
</template>

<script lang="ts" setup>
import { filterUnreferencedFiles } from '@@/js/mfm-inline-image.js';
import { inject, ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import * as mfm from 'mfm-js';
import { shouldCollapsed } from '@@/js/collapsed.js';
import { prefer } from '@/preferences.js';
import { useFloatingCollapse } from '@/composables/use-floating-collapse.js';
import { truncateMfmNodes, COLLAPSED_RENDER_CHARS } from '@@/js/mfm-truncate.js';
import MkMediaList from '@/components/MkMediaList.vue';
import MkPoll from '@/components/MkPoll.vue';
import { i18n } from '@/i18n.js';
import { useNoteCapture } from '@/composables/use-note-capture.js';
import { DI } from '@/di.js';

const props = defineProps<{
	note: Misskey.entities.Note;
}>();

const mock = inject(DI.mock, false);
const $note = props.note.poll ? useNoteCapture({ note: props.note, parentNote: null, mock }).$note : null;
const isLong = shouldCollapsed(props.note, []);

const collapsed = ref(isLong);
const rootEl = useTemplateRef('rootEl');
const { floatingVisible, collapse } = useFloatingCollapse({ rootEl, contentEl: rootEl, collapsed, isLong });

// 折りたたみ中は先頭部分だけを描画する（長文でタイムラインが重くならないように）
const collapsedParsed = isLong && props.note.text ? truncateMfmNodes(mfm.parse(props.note.text), COLLAPSED_RENDER_CHARS).nodes : null;

const galleryFiles = filterUnreferencedFiles(props.note.files ?? [], props.note.text);
</script>

<style lang="scss" module>
.root {
	overflow-wrap: break-word;

	&.collapsed {
		position: relative;
		max-height: 9em;
		overflow: clip;

		> .fade {
			display: block;
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			height: 64px;
			background: linear-gradient(0deg, var(--MI_THEME-panel), color(from var(--MI_THEME-panel) srgb r g b / 0));

			> .fadeLabel {
				display: inline-block;
				background: var(--MI_THEME-panel);
				padding: 6px 10px;
				font-size: 0.8em;
				border-radius: 999px;
				box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
			}

			&:hover {
				> .fadeLabel {
					background: var(--MI_THEME-panelHighlight);
				}
			}
		}
	}
}

.reply {
	margin-right: 6px;
	color: var(--MI_THEME-accent);
}

.rp {
	margin-left: 4px;
	font-style: oblique;
	color: var(--MI_THEME-renote);
}

.transition_fc_enterActive,
.transition_fc_leaveActive {
	transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.transition_fc_enterFrom,
.transition_fc_leaveTo {
	opacity: 0;
	transform: translateY(6px);
}

.showLess {
	width: 100%;
	margin-top: 14px;
	position: sticky;
	bottom: calc(var(--MI-stickyBottom, 0px) + 14px);
}

.showLessLabel {
	display: inline-block;
	background: var(--MI_THEME-popup);
	padding: 6px 10px;
	font-size: 0.8em;
	border-radius: 999px;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}
</style>
