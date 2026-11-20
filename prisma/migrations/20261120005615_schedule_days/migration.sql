/*
  Warnings:

  - You are about to drop the column `pinnedDate` on the `Workout` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleDay_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Keep upcoming days people already moved workouts to, as added training days.
INSERT OR IGNORE INTO "ScheduleDay" ("id", "enrollmentId", "date", "kind")
SELECT lower(hex(randomblob(16))), "enrollmentId", "pinnedDate", 'EXTRA'
FROM "Workout"
WHERE "status" = 'PLANNED' AND "enrollmentId" IS NOT NULL AND "pinnedDate" IS NOT NULL AND "pinnedDate" >= date('now', '-1 day')
GROUP BY "enrollmentId", "pinnedDate";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_Workout" ("completedAt", "createdAt", "cycleId", "dayNumber", "enrollmentId", "feeling", "guidance", "id", "notes", "performedDate", "phase", "sequence", "status", "templateKey", "title", "updatedAt", "userId", "weekNumber") SELECT "completedAt", "createdAt", "cycleId", "dayNumber", "enrollmentId", "feeling", "guidance", "id", "notes", "performedDate", "phase", "sequence", "status", "templateKey", "title", "updatedAt", "userId", "weekNumber" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE INDEX "Workout_userId_status_idx" ON "Workout"("userId", "status");
CREATE INDEX "Workout_userId_performedDate_idx" ON "Workout"("userId", "performedDate");
CREATE UNIQUE INDEX "Workout_enrollmentId_sequence_key" ON "Workout"("enrollmentId", "sequence");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDay_enrollmentId_date_key" ON "ScheduleDay"("enrollmentId", "date");
