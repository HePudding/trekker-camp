/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AchievementSettings1793800965035 {
    name = 'AchievementSettings1793800965035';

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "achievementSettings" jsonb NOT NULL DEFAULT '{"musicBilibiliIds":["BV1ky4xzaER1","BV1dfqBYqEm3","BV1f6d5B2ERX"],"musicNeteaseIds":[],"musicUrls":["https://youtu.be/Efrlqw8ytg4","https://www.youtube.com/watch?v=Efrlqw8ytg4","https://m.youtube.com/watch?v=Efrlqw8ytg4","https://youtu.be/XVCwzwxdHuA","https://www.youtube.com/watch?v=XVCwzwxdHuA","https://m.youtube.com/watch?v=XVCwzwxdHuA","https://open.spotify.com/track/3Cuj0mZrlLoXx9nydNi7RB","https://open.spotify.com/track/7anfcaNPQWlWCwyCHmZqNy","https://open.spotify.com/track/5Odr16TvEN4my22K9nbH7l","https://open.spotify.com/album/5bOlxyl4igOrp2DwVQxBco"]}'`);
    }

    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "achievementSettings"');
    }
}
