import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreferredLanguageToConversations1769970137656 implements MigrationInterface {
    name = 'AddPreferredLanguageToConversations1769970137656'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "assistantContext"`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "preferredLanguage" character varying(10)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "preferredLanguage"`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "assistantContext" character varying`);
    }

}
