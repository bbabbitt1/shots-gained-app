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
}

const pendingKey = (id: string) => `pending-round-${id}`;

export const savePendingRound = async (setup: PendingRound['setup'], shots: Shot[]) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const round: PendingRound = { id, setup, shots, savedAt: new Date().toISOString() };
  await set(pendingKey(id), round);
  return id;
};

export const getPendingRounds = async (): Promise<PendingRound[]> => {
  const all = await entries();
  return all
    .filter(([key]) => String(key).startsWith('pending-round-'))
    .map(([, val]) => val as PendingRound);
};

export const removePendingRound = (id: string) => del(pendingKey(id));

// ── Online status ──
export const isOnline = () => navigator.onLine;
