/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class PhoneVerification1794288612414 {
    name = 'PhoneVerification1794288612414'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "phoneNumber" character varying(11)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_profile_phone_number" ON "user_profile" ("phoneNumber")`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "verificationSettings" jsonb NOT NULL DEFAULT '{}'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "verificationSettings"`);
        await queryRunner.query(`DROP INDEX "IDX_user_profile_phone_number"`);
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "phoneNumber"`);
    }
}
