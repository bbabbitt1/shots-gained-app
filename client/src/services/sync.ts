import { getPendingRounds, removePendingRound } from './offline';
import { cacheCourse, createRound, saveShots } from './api';

let isSyncing = false;

export const syncPendingRounds = async (): Promise<{ synced: number; failed: number }> => {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  try {
    const pending = await getPendingRounds();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const round of pending) {
      try {
        const courseRes = await cacheCourse({
          clubName: round.setup.course.clubName,
          courseName: round.setup.course.courseName,
          apiSourceId: round.setup.course.apiSourceId,
          holes: round.setup.holes?.map((h) => ({
            holeNumber: h.holeNumber,
            par: h.par,
            yardage: h.yardage,
            tee: round.setup.tee,
          })),
        });

        const roundRes = await createRound({
          courseId: courseRes.courseId,
          roundDate: round.setup.roundDate,
          holesPlayed: round.setup.holesPlayed,
          teePreference: round.setup.tee,
          benchmark: 'Pro',
        });

        await saveShots(roundRes.roundId, round.shots);
        await removePendingRound(round.id);
        synced++;
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  } finally {
    isSyncing = false;
  }
};
