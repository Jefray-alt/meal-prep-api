import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMealPrepsAndTags1748300000000 implements MigrationInterface {
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "meal_prep_tags"`);
    await queryRunner.query(`DROP TABLE "meal_preps"`);
    await queryRunner.query(`DROP TABLE "user_tags"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_tags" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "name"       varchar(100) NOT NULL,
        "user_id"    uuid        NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_tags_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_user_tags_user_id_name" UNIQUE ("user_id", "name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meal_preps" (
        "id"           uuid         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"      uuid         NOT NULL,
        "title"        varchar(100) NOT NULL,
        "instructions" text         NOT NULL,
        "carbs"        decimal(6,2),
        "fat"          decimal(6,2),
        "protein"      decimal(6,2),
        "ingredients"  jsonb        NOT NULL,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meal_preps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meal_preps_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meal_prep_tags" (
        "meal_prep_id" uuid NOT NULL,
        "tag_id"       uuid NOT NULL,
        CONSTRAINT "PK_meal_prep_tags" PRIMARY KEY ("meal_prep_id", "tag_id"),
        CONSTRAINT "FK_meal_prep_tags_meal_prep"
          FOREIGN KEY ("meal_prep_id") REFERENCES "meal_preps"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_meal_prep_tags_tag"
          FOREIGN KEY ("tag_id") REFERENCES "user_tags"("id") ON DELETE CASCADE
      )
    `);
  }
}
