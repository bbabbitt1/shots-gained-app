import type { BenchmarkRow, SGInput, Surface, EndSurface, Category } from './types.js';
import { FAIRWAY_RESULTS, GIR_RESULTS, SHOT_RESULTS, PAR5_LAY_RESULTS } from './types.js';

/**
 * Find the nearest benchmark value for a given surface and distance.
 * Benchmarks are keyed by surface+distance; we find the closest distance match.
 */
export const findBenchmark = (
  benchmarks: BenchmarkRow[],
  surface: Surface,
  distance: number
): number => {
  const surfaceRows = benchmarks.filter((b) => b.surface === surface);
  if (surfaceRows.length === 0) {
    console.warn(`No benchmark data for surface: ${surface}`);
    return 0;
  }

  let closest = surfaceRows[0];
  let minDiff = Math.abs(surfaceRows[0].distance - distance);

  for (const row of surfaceRows) {
    const diff = Math.abs(row.distance - distance);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }

  return closest.tourAvg;
};

/**
 * Core strokes gained calculation.
 *
 * SG = TourAvg(start) - (1 + TourAvg(end))
 * If end surface is "Hole", end value = 0
 * If penalty, SG -= 1
 */
export const calculateStrokesGained = (
  benchmarks: BenchmarkRow[],
  input: SGInput
): number => {
  const startVal = findBenchmark(benchmarks, input.surfaceStart, input.distanceStart);

  let endVal = 0;
  if (input.surfaceEnd !== 'Hole') {
    endVal = findBenchmark(benchmarks, input.surfaceEnd as Surface, input.distanceEnd);
  }

  let sg = startVal - (1 + endVal);

  if (input.penalty) {
    sg -= 1;
  }

  return Math.round(sg * 1000) / 1000;
};

/**
 * Auto-assign category based on surface, distance, and hole par.
 * Short Game: off the green, within 50 yards (not from tee)
 * Approach: longer shots toward the green
 * Driving: tee shots on par 4/5
 * Putting: on the green
 */
export const inferCategory = (
  surface: Surface,
  par: number,
  shotNumber: number,
  distance?: number
): Category => {
  if (surface === 'Green') return 'Putting';
  if (surface === 'Tee' && par >= 4) return 'Driving';
  if (surface === 'Tee' && par === 3) return 'Approach';
  if (shotNumber === 1 && par >= 4) return 'Driving';
  if (distance !== undefined && distance <= 50 && surface !== 'Tee') return 'Short Game';
  return 'Approach';
};

/**
 * Determine which shot result options to show based on context.
 * Returns { label, options } or null if no result selector applies.
 */
export const getShotResultContext = (
  par: number,
  shotNumber: number,
  category: Category
): { label: string; options: readonly string[] } | null => {
  // Putting — no result selector
  if (category === 'Putting') return null;

  // Driving on Par 4/5 — fairway result
  if (category === 'Driving' && par >= 4) {
    return { label: 'Fairway Result', options: FAIRWAY_RESULTS };
  }

  // Par 3 tee shot — always GIR eligible
  if (par === 3 && shotNumber === 1) {
    return { label: 'Green Result', options: GIR_RESULTS };
  }

  // Par 5 second shot — include layup option
  if (par === 5 && shotNumber === 2) {
    return { label: 'Shot Result', options: PAR5_LAY_RESULTS };
  }

  // GIR-eligible shot (shot number <= par - 2)
  if (shotNumber <= par - 2) {
    return { label: 'Green Result', options: GIR_RESULTS };
  }

  // Non-GIR — too late for GIR, just track where it went
  return { label: 'Shot Result', options: SHOT_RESULTS };
};

/**
 * Auto-determine shot result based on end surface.
 */
export const autoShotResult = (
  endSurface: EndSurface,
  par: number,
  shotNumber: number,
  category: Category
): string | undefined => {
  const ctx = getShotResultContext(par, shotNumber, category);
  if (!ctx) return undefined;

  if (category === 'Driving') {
    if (endSurface === 'Green' || endSurface === 'Hole') return 'Drive Green';
    if (endSurface === 'Fairway') return 'Hit Fairway';
    return undefined;
  }

  if (endSurface === 'Green' || endSurface === 'Hole') {
    return shotNumber <= par - 2 ? 'GIR' : 'Green';
  }

  return undefined;
};

/**
 * Format SG value for display: "+1.234" or "-0.567"
 */
export const formatSG = (sg: number): string => {
  const sign = sg >= 0 ? '+' : '';
  return `${sign}${sg.toFixed(2)}`;
};
