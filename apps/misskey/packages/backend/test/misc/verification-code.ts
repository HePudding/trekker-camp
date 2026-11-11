/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { loadConfig } from '@/config.js';
import type { CodeChallenge, CodeChannel, CodePurpose } from '@/core/VerificationCodeService.js';

/** Seed provider-verified fixtures in the isolated test Redis; production has no test bypass. */
export async function verificationCode(purpose: CodePurpose, address: string, userId: string | null = null, channel: CodeChannel = 'sms') {
	if (process.env.NODE_ENV !== 'test') throw new Error('Verification fixtures require NODE_ENV=test');
	const redis = new Redis(loadConfig().redis);
	const challengeId = randomUUID();
	const code = '123456';
	const hash = createHash('sha256').update(`${challengeId}:${code}`).digest('hex');
	const addressHash = createHash('sha256').update(address).digest('hex');
	const challenge: CodeChallenge = {
		purpose, address, channel, userId, schemeName: 'test', attempts: 0, maxAttempts: 5,
		...(channel === 'sms' ? { verifiedHash: hash } : { emailHash: hash }),
	};
	try {
		await redis.multi()
			.set(`verification:code:${challengeId}`, JSON.stringify(challenge), 'EX', 300)
			.set(`verification:current:${channel}:${purpose}:${addressHash}`, challengeId, 'EX', 300)
			.exec();
	} finally {
		await redis.quit();
	}
	return { challengeId, code };
}

