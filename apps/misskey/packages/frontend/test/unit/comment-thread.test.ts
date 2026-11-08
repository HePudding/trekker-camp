/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import * as Misskey from 'misskey-js';
import { fetchThreadReplies, isDirectReply, findThreadForReply } from '@/utility/comment-thread.js';

let seq = 0;

function note(partial: Partial<Misskey.entities.Note> & { id: string }): Misskey.entities.Note {
	seq++;
	return {
		replyId: null,
		renoteId: null,
		repliesCount: 0,
		createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
		...partial,
	} as unknown as Misskey.entities.Note;
}

// notes/children を模した取得関数（新しい順で返す。引用も混ざる）
function childrenSource(all: Misskey.entities.Note[]) {
	const calls: string[] = [];
	const fetchChildren = async (noteId: string, limit: number, untilId?: string) => {
		calls.push(noteId);
		return all
			.filter(n => n.replyId === noteId || n.renoteId === noteId)
			.filter(n => untilId == null || n.id < untilId)
			.sort((a, b) => (a.id < b.id ? 1 : -1))
			.slice(0, limit);
	};
	return { fetchChildren, calls };
}

describe('fetchThreadReplies', () => {
	test('flattens every descendant of a comment, oldest first', async () => {
		const all = [
			note({ id: 'b1', replyId: 'c', repliesCount: 1 }),
			note({ id: 'b2', replyId: 'c' }),
			note({ id: 'b3', replyId: 'b1', repliesCount: 1 }),
			note({ id: 'b4', replyId: 'b3' }),
			note({ id: 'b5', replyId: 'c' }),
		];
		const { fetchChildren } = childrenSource(all);
		// 2 件ずつのページで取得させ、ページ送りも通す
		const replies = await fetchThreadReplies('c', fetchChildren, { pageSize: 2 });
		assert.deepStrictEqual(replies.map(n => n.id), ['b1', 'b2', 'b3', 'b4', 'b5']);
	});

	test('skips quotes and does not ask for children of leaf replies', async () => {
		const all = [
			note({ id: 'q1', renoteId: 'c', repliesCount: 3 }),
			note({ id: 'b1', replyId: 'c' }),
		];
		const { fetchChildren, calls } = childrenSource(all);
		const replies = await fetchThreadReplies('c', fetchChildren);
		assert.deepStrictEqual(replies.map(n => n.id), ['b1']);
		assert.deepStrictEqual(calls, ['c']);
	});

	test('stops at the note limit', async () => {
		const all = Array.from({ length: 10 }, (_, i) => note({ id: `b${i}`, replyId: 'c' }));
		const { fetchChildren } = childrenSource(all);
		const replies = await fetchThreadReplies('c', fetchChildren, { maxNotes: 4, pageSize: 3 });
		assert.strictEqual(replies.length, 4);
	});
});

describe('isDirectReply', () => {
	test('only replies to the note count as comments, not quotes', () => {
		assert.isTrue(isDirectReply(note({ id: 'a', replyId: 'n' }), 'n'));
		assert.isFalse(isDirectReply(note({ id: 'b', renoteId: 'n' }), 'n'));
		assert.isFalse(isDirectReply(note({ id: 'c', replyId: 'other' }), 'n'));
	});
});

describe('findThreadForReply', () => {
	test('finds the comment whose thread contains the replied-to note', () => {
		const threads = new Map([
			['c1', new Set(['c1', 'x'])],
			['c2', new Set(['c2', 'y'])],
		]);
		assert.strictEqual(findThreadForReply(threads, 'y'), 'c2');
		assert.strictEqual(findThreadForReply(threads, 'c1'), 'c1');
		assert.isNull(findThreadForReply(threads, 'z'));
	});
});
