/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class Cap1794501011899 {
    name = 'Cap1794501011899'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "enableCap" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableCap"`);
    }
}
