<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialogEl"
	:width="720"
	:height="520"
	:withOkButton="true"
	@close="cancel()"
	@ok="ok()"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts._longNote.tableEditor }}</template>
	<div :class="$style.root">
		<div :class="$style.toolbar">
			<MkButton small @click="addRow()"><i class="ti ti-row-insert-bottom"></i> {{ i18n.ts._longNote.addRow }}</MkButton>
			<MkButton small @click="addColumn()"><i class="ti ti-column-insert-right"></i> {{ i18n.ts._longNote.addColumn }}</MkButton>
			<span :class="$style.hint">{{ i18n.ts._longNote.tableFirstRowIsHeader }}</span>
		</div>
		<div :class="$style.scroller">
			<table :class="$style.table">
				<thead>
					<tr>
						<th v-for="(_, ci) in cols" :key="ci" :class="$style.colHead">
							<button v-if="cols > 1" v-tooltip="i18n.ts._longNote.removeColumn" class="_button" :class="$style.remove" @click="removeColumn(ci)"><i class="ti ti-x"></i></button>
						</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(row, ri) in rows" :key="ri" :class="{ [$style.headerRow]: ri === 0 }">
						<td v-for="(_, ci) in cols" :key="ci" :class="$style.cell">
							<input
								v-model="row[ci]"
								:class="$style.input"
								:aria-label="`${ri + 1}-${ci + 1}`"
								@paste="onPaste($event, ri, ci)"
							>
						</td>
						<td>
							<button v-if="rows.length > 1" v-tooltip="i18n.ts._longNote.removeRow" class="_button" :class="$style.remove" @click="removeRow(ri)"><i class="ti ti-x"></i></button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue';
import { tsvToRows } from '@@/js/mfm-table.js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	initialRows?: string[][] | null;
}>();

const emit = defineEmits<{
	(ev: 'done', rows: string[][]): void;
	(ev: 'closed'): void;
}>();

const dialogEl = useTemplateRef('dialogEl');

function normalize(src: string[][]): string[][] {
	const c = Math.max(1, ...src.map(r => r.length));
	return src.map(r => Array.from({ length: c }, (_, i) => r[i] ?? ''));
}

const rows = ref<string[][]>(normalize(props.initialRows && props.initialRows.length > 0 ? props.initialRows : [['', ''], ['', '']]));
const cols = computed(() => rows.value[0]?.length ?? 1);

function addRow() {
	rows.value.push(Array.from({ length: cols.value }, () => ''));
}

function addColumn() {
	for (const r of rows.value) r.push('');
}

function removeRow(i: number) {
	rows.value.splice(i, 1);
}

function removeColumn(i: number) {
	for (const r of rows.value) r.splice(i, 1);
}

// スプレッドシートの範囲を貼り付けたら、カーソル位置から展開する
function onPaste(ev: ClipboardEvent, ri: number, ci: number) {
	const pasted = tsvToRows(ev.clipboardData?.getData('text') ?? '');
	if (pasted == null) return;
	ev.preventDefault();
	pasted.forEach((pr, dr) => {
		while (rows.value.length <= ri + dr) addRow();
		pr.forEach((v, dc) => {
			while (cols.value <= ci + dc) addColumn();
			rows.value[ri + dr][ci + dc] = v;
		});
	});
}

function ok() {
	const cleaned = rows.value.filter(r => r.some(c => c.trim() !== ''));
	if (cleaned.length > 0) emit('done', cleaned);
	dialogEl.value?.close();
}

function cancel() {
	dialogEl.value?.close();
}
</script>

<style lang="scss" module>
.root {
	padding: 16px;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
}

.hint {
	font-size: 0.85em;
	opacity: 0.7;
}

.scroller {
	overflow-x: auto;
}

.table {
	border-collapse: collapse;
}

.colHead {
	height: 24px;
	text-align: center;
}

.cell {
	border: solid 1px var(--MI_THEME-divider);
	padding: 0;
}

.headerRow .input {
	font-weight: bold;
	background: var(--MI_THEME-bg);
}

.input {
	box-sizing: border-box;
	width: 10em;
	padding: 6px 8px;
	border: none;
	outline: none;
	background: transparent;
	color: inherit;
	font: inherit;

	&:focus {
		box-shadow: inset 0 0 0 2px var(--MI_THEME-accent);
	}
}

.remove {
	padding: 4px;
	opacity: 0.5;

	&:hover {
		opacity: 1;
		color: var(--MI_THEME-error);
	}
}
</style>
