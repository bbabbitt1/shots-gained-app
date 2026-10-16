import { get, set, del, entries } from 'idb-keyval';
import type { BenchmarkRow, Shot } from '@shared/types';

// ── Benchmarks ──
export const cacheBenchmarks = (data: BenchmarkRow[]) => set('benchmarks', data);
export const getCachedBenchmarks = () => get<BenchmarkRow[]>('benchmarks');

// ── Pending Rounds (offline save queue) ──
interface PendingRound {
  id: string;
  setup: {
    course: { clubName: string; courseName: string; apiSourceId?: string };
    tee: string;
    holes: { holeNumber: number; par: number; yardage: number; tee?: string }[];
    holesPlayed: number;
    roundDate: string;
  };
  shots: Shot[];
  savedAt: string;
  playerId?: number; // absent on rounds queued before ownership tagging
}

const pendingKey = (id: string) => `pending-round-${id}`;

// Only a numeric id counts; anything else (missing/corrupt player record) is "not logged in"
const currentPlayerId = (): number | undefined => {
  try {
    const id = JSON.parse(localStorage.getItem('player') || '{}').playerId;
    return typeof id === 'number' ? id : undefined;
  } catch { return undefined; }
};

// Fail closed: only the player who queued a round may see or sync it, so a shared device can't push
// one player's rounds into another's account. Untagged rounds belong to no one until claimed.
export const isOwnedBy = (round: Pick<PendingRound, 'playerId'>, playerId: number | undefined) =>
  playerId !== undefined && round.playerId === playerId;

export const savePendingRound = async (setup: PendingRound['setup'], shots: Shot[]) => {
  const playerId = currentPlayerId();
  if (playerId === undefined) throw new Error('Session expired — log in again to save');
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const round: PendingRound = { id, setup, shots, savedAt: new Date().toISOString(), playerId };
  await set(pendingKey(id), round);
  return id;
};

const allPendingRounds = async (): Promise<PendingRound[]> =>
  (await entries())
    .filter(([key]) => String(key).startsWith('pending-round-'))
    .map(([, val]) => val as PendingRound);

export const getPendingRounds = async (): Promise<PendingRound[]> => {
  const playerId = currentPlayerId();
  return (await allPendingRounds()).filter((r) => isOwnedBy(r, playerId));
};

// Rounds queued before ownership tagging; synced only after the logged-in player explicitly claims them
export const getUnclaimedRounds = async (): Promise<PendingRound[]> =>
  (await allPendingRounds()).filter((r) => r.playerId === undefined);

export const claimUnclaimedRounds = async () => {
  const playerId = currentPlayerId();
  if (playerId === undefined) return;
  for (const r of await getUnclaimedRounds()) await set(pendingKey(r.id), { ...r, playerId });
};

export const removePendingRound = (id: string) => del(pendingKey(id));

// ── Online status ──
export const isOnline = () => navigator.onLine;
