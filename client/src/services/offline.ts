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

const currentPlayerId = (): number | undefined => {
  try { return JSON.parse(localStorage.getItem('player') || '{}').playerId; } catch { return undefined; }
};

// Only the player who queued a round may see or sync it, so a shared device can't push one player's
// rounds into another's account. ponytail: untagged legacy rounds still go to whoever is logged in.
export const isOwnedBy = (round: Pick<PendingRound, 'playerId'>, playerId: number | undefined) =>
  playerId !== undefined && (round.playerId === undefined || round.playerId === playerId);

export const savePendingRound = async (setup: PendingRound['setup'], shots: Shot[]) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const round: PendingRound = { id, setup, shots, savedAt: new Date().toISOString(), playerId: currentPlayerId() };
  await set(pendingKey(id), round);
  return id;
};

export const getPendingRounds = async (): Promise<PendingRound[]> => {
  const all = await entries();
  const playerId = currentPlayerId();
  return all
    .filter(([key]) => String(key).startsWith('pending-round-'))
    .map(([, val]) => val as PendingRound)
    .filter((r) => isOwnedBy(r, playerId));
};

export const removePendingRound = (id: string) => del(pendingKey(id));

// ── Online status ──
export const isOnline = () => navigator.onLine;
