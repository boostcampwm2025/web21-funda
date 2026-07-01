import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRankingWeekLockedStatus1770200000000 implements MigrationInterface {
  name = 'RemoveRankingWeekLockedStatus1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `ranking_weeks` SET `status` = 'OPEN' WHERE `status` = 'LOCKED'",
    );
    await queryRunner.query(
      "ALTER TABLE `ranking_weeks` MODIFY `status` enum ('OPEN', 'EVALUATED', 'ARCHIVED') NOT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `ranking_weeks` MODIFY `status` enum ('OPEN', 'LOCKED', 'EVALUATED', 'ARCHIVED') NOT NULL",
    );
  }
}
