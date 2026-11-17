-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "experienceLevel" TEXT NOT NULL DEFAULT 'NEW_TO_LIFTING',
    "barWeight" REAL NOT NULL DEFAULT 45,
    "availablePlates" TEXT NOT NULL DEFAULT '[45,35,25,10,5,2.5]',
    "trainingDaysPerWeek" INTEGER NOT NULL DEFAULT 3,
    "trainingWeekdays" TEXT NOT NULL DEFAULT '[1,3,5]',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "restTimer" TEXT NOT NULL DEFAULT '{}',
    "onboardingDoneAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("availablePlates", "barWeight", "experienceLevel", "onboardingDoneAt", "timezone", "trainingDaysPerWeek", "trainingWeekdays", "updatedAt", "userId") SELECT "availablePlates", "barWeight", "experienceLevel", "onboardingDoneAt", "timezone", "trainingDaysPerWeek", "trainingWeekdays", "updatedAt", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
