/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';

/** 楼中楼で最初に見せる返信の数 */
export const COMMENT_PREVIEW_COUNT = 3;

/** 1 件のコメントにぶら下がる返信を取得する上限 */
export const COMMENT_THREAD_MAX_NOTES = 300;

/** notes/children の 1 回あたりの取得件数（API の上限） */
export const CHILDREN_PAGE_SIZE = 100;

export type FetchChildren = (noteId: string, limit: number, untilId?: string) => Promise<Misskey.entities.Note[]>;

/** 引用ではなく、そのノートへの直接の返信かどうか */
export function isDirectReply(note: Misskey.entities.Note, parentId: string): boolean {
	return note.replyId === parentId;
}

async function fetchDirectReplies(parentId: string, fetchChildren: FetchChildren, budget: number, pageSize: number): Promise<Misskey.entities.Note[]> {
	const result: Misskey.entities.Note[] = [];
	let untilId: string | undefined;
	while (result.length < budget) {
		const page = await fetchChildren(parentId, pageSize, untilId);
		for (const n of page) {
			if (isDirectReply(n, parentId)) result.push(n);
		}
		if (page.length < pageSize) break;
		untilId = page[page.length - 1].id;
	}
	return result.slice(0, budget);
}

/**
 * コメント（rootId）以下のすべての返信を取得し、古い順に平坦化して返す
 */
export async function fetchThreadReplies(rootId: string, fetchChildren: FetchChildren, options: { maxNotes?: number; pageSize?: number } = {}): Promise<Misskey.entities.Note[]> {
	const maxNotes = options.maxNotes ?? COMMENT_THREAD_MAX_NOTES;
	const pageSize = options.pageSize ?? CHILDREN_PAGE_SIZE;
	const collected: Misskey.entities.Note[] = [];
	const queue = [rootId];
	while (queue.length > 0 && collected.length < maxNotes) {
		const parentId = queue.shift()!;
		const replies = await fetchDirectReplies(parentId, fetchChildren, maxNotes - collected.length, pageSize);
		for (const r of replies) {
			collected.push(r);
			if (r.repliesCount > 0) queue.push(r.id);
		}
	}
	return collected.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * 返信先 ID がどのコメントの楼中楼に属するかを探す
 * @param threads コメント ID → そのコメントと配下の返信の ID 集合
 */
export function findThreadForReply(threads: Map<string, Set<string>>, replyId: string): string | null {
	for (const [commentId, ids] of threads) {
		if (ids.has(replyId)) return commentId;
	}
	return null;
}
