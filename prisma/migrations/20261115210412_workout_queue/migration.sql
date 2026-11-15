/*
  Warnings:

  - You are about to drop the column `scheduledDate` on the `Workout` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SetEntry" ADD COLUMN "targetRepsMax" INTEGER;
ALTER TABLE "SetEntry" ADD COLUMN "targetRir" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pattern" TEXT NOT NULL DEFAULT 'push',
    "primaryMuscles" TEXT NOT NULL DEFAULT '[]',
    "secondaryMuscles" TEXT NOT NULL DEFAULT '[]',
    "equipment" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "techniqueCues" TEXT NOT NULL DEFAULT '[]',
    "imageKey" TEXT,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("category", "createdAt", "description", "equipment", "id", "imageKey", "name", "ownerId", "primaryMuscles", "secondaryMuscles", "slug", "techniqueCues") SELECT "category", "createdAt", "description", "equipment", "id", "imageKey", "name", "ownerId", "primaryMuscles", "secondaryMuscles", "slug", "techniqueCues" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");
CREATE INDEX "Exercise_ownerId_idx" ON "Exercise"("ownerId");
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "cycleId" TEXT,
    "sequence" INTEGER,
    "phase" TEXT,
    "templateKey" TEXT,
    "title" TEXT NOT NULL,
    "weekNumber" INTEGER,
    "dayNumber" INTEGER,
    "guidance" TEXT,
    "pinnedDate" TEXT,
    "performedDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "feeling" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Workout_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Workout_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Workout" ("completedAt", "createdAt", "cycleId", "dayNumber", "feeling", "id", "notes", "status", "title", "updatedAt", "userId", "weekNumber") SELECT "completedAt", "createdAt", "cycleId", "dayNumber", "feeling", "id", "notes", "status", "title", "updatedAt", "userId", "weekNumber" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE INDEX "Workout_userId_status_idx" ON "Workout"("userId", "status");
CREATE INDEX "Workout_userId_performedDate_idx" ON "Workout"("userId", "performedDate");
CREATE INDEX "Workout_userId_pinnedDate_idx" ON "Workout"("userId", "pinnedDate");
CREATE UNIQUE INDEX "Workout_enrollmentId_sequence_key" ON "Workout"("enrollmentId", "sequence");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
