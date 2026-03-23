import { useState, useCallback, useMemo } from 'react';
import type { Shot, BenchmarkRow, SGByCategory, Category, Course, CourseHole } from '@shared/types';
import { calculateStrokesGained, inferCategory } from '@shared/sg-calculator';

export interface RoundState {
  course: Course | null;
  tee: string;
  holesPlayed: number;
  roundDate: string;
  holes: CourseHole[];
  currentHole: number;
  currentPar: number;
  shots: Shot[];
  benchmarks: BenchmarkRow[];
}

const initialState: RoundState = {
  course: null,
  tee: '',
  holesPlayed: 18,
  roundDate: new Date().toISOString().split('T')[0],
  holes: [],
  currentHole: 1,
  currentPar: 4,
  shots: [],
  benchmarks: [],
};

export const useRound = () => {
  const [state, setState] = useState<RoundState>(initialState);

  const setCourse = useCallback((course: Course, tee: string, holes: CourseHole[], holesPlayed: number) => {
    setState((s) => ({ ...s, course, tee, holes, holesPlayed }));
  }, []);

  const setBenchmarks = useCallback((benchmarks: BenchmarkRow[]) => {
    setState((s) => ({ ...s, benchmarks }));
  }, []);

  const setCurrentHole = useCallback((hole: number, par: number) => {
    setState((s) => ({ ...s, currentHole: hole, currentPar: par }));
  }, []);

  const addShot = useCallback((shot: Shot) => {
    setState((s) => ({ ...s, shots: [...s.shots, shot] }));
  }, []);

  const removeLastShot = useCallback(() => {
    setState((s) => ({ ...s, shots: s.shots.slice(0, -1) }));
  }, []);

  const resetRound = useCallback(() => {
    setState(initialState);
  }, []);

  // Current hole shots
  const currentHoleShots = useMemo(
    () => state.shots.filter((s) => s.hole === state.currentHole),
    [state.shots, state.currentHole]
  );

  // Cumulative SG by category
  const sgByCategory = useMemo((): SGByCategory => {
    const result: SGByCategory = { Driving: 0, Approach: 0, 'Short Game': 0, Putting: 0 };
    for (const shot of state.shots) {
      result[shot.category] += shot.strokesGained;
    }
    // Round to 3 decimal places
    for (const key of Object.keys(result) as Category[]) {
      result[key] = Math.round(result[key] * 1000) / 1000;
    }
    return result;
  }, [state.shots]);

  const totalSG = useMemo(
    () => Math.round(state.shots.reduce((sum, s) => sum + s.strokesGained, 0) * 1000) / 1000,
    [state.shots]
  );

  return {
    state,
    setState,
    setCourse,
    setBenchmarks,
    setCurrentHole,
    addShot,
    removeLastShot,
    resetRound,
    currentHoleShots,
    sgByCategory,
    totalSG,
    calculateStrokesGained: (input: Parameters<typeof calculateStrokesGained>[1]) =>
      calculateStrokesGained(state.benchmarks, input),
    inferCategory,
  };
};
