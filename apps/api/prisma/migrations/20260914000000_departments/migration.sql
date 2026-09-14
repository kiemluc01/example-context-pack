-- Departments become a catalog: employees.department (free text) is replaced by employees.department_id.
--
-- Rollback (manual; Prisma has no down migrations). Department names are kept, so no data is lost:
--   ALTER TABLE "employees" ADD COLUMN "department" TEXT;
--   UPDATE "employees" e SET "department" = d."name" FROM "departments" d WHERE d."id" = e."department_id";
--   ALTER TABLE "employees" ALTER COLUMN "department" SET NOT NULL;
--   ALTER TABLE "employees" DROP CONSTRAINT "employees_department_id_fkey";
--   ALTER TABLE "departments" DROP CONSTRAINT "departments_manager_id_fkey";
--   ALTER TABLE "employees" DROP COLUMN "department_id";
--   DROP TABLE "departments";
--   CREATE INDEX "employees_department_idx" ON "employees"("department");
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260914000000_departments';

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "manager_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- Backfill: one department per distinct trimmed name, coded PB001, PB002... in name order.
INSERT INTO "departments" ("id", "code", "name", "updated_at")
SELECT gen_random_uuid(),
       'PB' || LPAD(n::text, GREATEST(3, LENGTH(n::text)), '0'),
       "name",
       CURRENT_TIMESTAMP
FROM (
    SELECT "name", ROW_NUMBER() OVER (ORDER BY "name") AS n
    FROM (SELECT DISTINCT BTRIM("department") AS "name" FROM "employees") AS distinct_names
) AS numbered;

-- Link employees, then drop the free-text column.
ALTER TABLE "employees" ADD COLUMN "department_id" UUID;
UPDATE "employees" e SET "department_id" = d."id" FROM "departments" d WHERE d."name" = BTRIM(e."department");
ALTER TABLE "employees" ALTER COLUMN "department_id" SET NOT NULL;

-- DropIndex
DROP INDEX "employees_department_idx";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "department";

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_manager_id_key" ON "departments"("manager_id");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
