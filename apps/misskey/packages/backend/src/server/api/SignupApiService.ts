/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { RegistrationTicketsRepository, UserProfilesRepository, MiMeta } from '@/models/_.js';
import { SignupService } from '@/core/SignupService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { VerificationCodeService, VerificationError } from '@/core/VerificationCodeService.js';
import { FastifyReplyError } from '@/misc/fastify-reply-error.js';
import { bindThis } from '@/decorators.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class SignupApiService {
	constructor(
		@Inject(DI.meta) private meta: MiMeta,
		@Inject(DI.userProfilesRepository) private profiles: UserProfilesRepository,
		@Inject(DI.registrationTicketsRepository) private tickets: RegistrationTicketsRepository,
		private userEntityService: UserEntityService,
		private signupService: SignupService,
		private codes: VerificationCodeService,
	) {}

	@bindThis
	public async signup(request: FastifyRequest<{ Body: {
		username: string; password: string; invitationCode?: string; host?: string;
		phoneChallengeId?: string; phoneCode?: string;
	} }>, reply: FastifyReply) {
		const body = request.body;
		if (!body || typeof body.username !== 'string' || typeof body.password !== 'string'
			|| !this.userEntityService.validateLocalUsername(body.username) || !this.userEntityService.validatePassword(body.password)) {
			throw new FastifyReplyError(400, 'INVALID_PARAMETERS');
		}
		try {
			if (!body.phoneChallengeId || !body.phoneCode) throw new VerificationError('INVALID_CODE');
			const ticket = this.meta.disableRegistration && typeof body.invitationCode === 'string'
				? await this.tickets.findOneBy({ code: body.invitationCode }) : null;
			if (this.meta.disableRegistration && (!ticket || ticket.usedAt || ticket.usedById || (ticket.expiresAt && ticket.expiresAt <= new Date()))) {
				throw new VerificationError('REGISTRATION_CLOSED');
			}
			const challenge = await this.codes.verify(body.phoneChallengeId, body.phoneCode, 'signup');
			if (challenge.channel !== 'sms' || challenge.userId !== null) throw new VerificationError('INVALID_CODE');
			if (await this.profiles.existsBy({ phoneNumber: challenge.address })) throw new VerificationError('PHONE_UNAVAILABLE');
			if (ticket) {
				const claim = await this.tickets.update({ id: ticket.id, usedAt: IsNull(), usedById: IsNull() }, { usedAt: new Date() });
				if (claim.affected !== 1) throw new VerificationError('REGISTRATION_CLOSED');
			}
			try {
				await this.codes.consume([body.phoneChallengeId]);
				const { account, secret } = await this.signupService.signup({
					username: body.username, password: body.password, phoneNumber: challenge.address,
					host: process.env.NODE_ENV === 'test' ? body.host : undefined,
				});
				if (ticket) await this.tickets.update(ticket.id, { usedById: account.id });
				const result = await this.userEntityService.pack(account, account, { schema: 'MeDetailed', includeSecrets: true });
				return { ...result, token: secret };
			} catch (err) {
				if (ticket) await this.tickets.update({ id: ticket.id, usedById: IsNull() }, { usedAt: null });
				if ((err as { code?: string }).code === '23505') throw new VerificationError('PHONE_UNAVAILABLE');
				throw err;
			}
		} catch (err) {
			if (err instanceof VerificationError) {
				reply.code(err.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 400);
				return { error: { code: err.code, message: err.message } };
			}
			throw new FastifyReplyError(400, 'SIGNUP_FAILED');
		}
	}

	@bindThis
	public async signupPending(_request: FastifyRequest<{ Body: { code: string } }>, _reply: FastifyReply): Promise<never> {
		throw new FastifyReplyError(410, 'PHONE_VERIFICATION_REQUIRED');
	}
}
