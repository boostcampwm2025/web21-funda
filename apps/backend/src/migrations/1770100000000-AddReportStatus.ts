import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportStatus1770100000000 implements MigrationInterface {
  name = 'AddReportStatus1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `reports` ADD `status` enum ('pending', 'resolved') NOT NULL DEFAULT 'pending'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `reports` DROP COLUMN `status`');
  }
}
