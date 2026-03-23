// ── Surfaces & Categories ──
export const SURFACES = ['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Recovery'] as const;
export const END_SURFACES = [...SURFACES, 'Hole'] as const;
export const CATEGORIES = ['Driving', 'Approach', 'Short Game', 'Putting'] as const;
export const HOLE_RESULTS = ['Albatross', 'Eagle', 'Birdie', 'Par', 'Bogey', 'Double', 'Triple', 'Other'] as const;

// Contextual shot results
export const FAIRWAY_RESULTS = ['Hit Fairway', 'Miss Left', 'Miss Right', 'Drive Green'] as const;
export const GIR_RESULTS = ['GIR', 'Short', 'Long', 'Left', 'Right'] as const;
export const SHOT_RESULTS = ['Green', 'Short', 'Long', 'Left', 'Right'] as const;
export const PAR5_LAY_RESULTS = ['Green', 'Short', 'Long', 'Left', 'Right', 'Layup'] as const;

export type FairwayResult = typeof FAIRWAY_RESULTS[number];
export type ShotResult = string; // flexible — any of the above

export const CLUBS = [
  'Driver', 'Mini Driver',
  '3 Wood', '5 Wood', '7 Wood', '9 Wood',
  '2 Hybrid', '3 Hybrid', '4 Hybrid', '5 Hybrid',
  '2 Iron', '3 Iron', '4 Iron', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron',
  'PW', '48°', '50°', '52°', '54°', '56°', '58°', '60°',
  'Putter',
] as const;

// ── Shot Detail Options (collapsible per-category) ──

// Common
export const WIND_DIRECTIONS = ['into', 'downwind', 'left-to-right', 'right-to-left', 'none'] as const;
export const WIND_STRENGTHS = ['calm', 'light', 'moderate', 'strong'] as const;
export const LIE_QUALITIES = ['perfect', 'good', 'fair', 'poor', 'buried'] as const;

// Driving
export const INTENDED_SHAPES = ['straight', 'draw', 'fade'] as const;
export const FAIRWAY_WIDTHS = ['tight', 'average', 'wide'] as const;

// Approach
export const PIN_DEPTHS = ['front', 'middle', 'back'] as const;
export const PIN_SIDES = ['left', 'center', 'right'] as const;
export const GREEN_FIRMNESS = ['soft', 'medium', 'firm'] as const;

// Short Game
export const SHORT_GAME_TYPES = ['chip', 'pitch', 'flop', 'bump-and-run', 'bunker'] as const;

// Putting
export const BREAK_TYPES = ['straight', 'left-to-right', 'right-to-left', 'double-break'] as const;
export const BREAK_SEVERITIES = ['flat', 'slight', 'moderate', 'severe'] as const;
export const PUTT_SLOPES = ['uphill', 'downhill', 'level'] as const;
export const PUTT_MISSES = ['high', 'low', 'short', 'long', 'lip-out', 'mis-read', 'made'] as const;
export const GREEN_SPEEDS = ['slow', 'medium', 'fast'] as const;

// Composite detail types
export interface CommonDetails {
  windDirection?: typeof WIND_DIRECTIONS[number];
  windStrength?: typeof WIND_STRENGTHS[number];
  lieQuality?: typeof LIE_QUALITIES[number];
}

export interface DrivingDetails extends CommonDetails {
  intendedShape?: typeof INTENDED_SHAPES[number];
  fairwayWidth?: typeof FAIRWAY_WIDTHS[number];
}

export interface ApproachDetails extends CommonDetails {
  pinDepth?: typeof PIN_DEPTHS[number];
  pinSide?: typeof PIN_SIDES[number];
  greenFirmness?: typeof GREEN_FIRMNESS[number];
}

export interface ShortGameDetails extends CommonDetails {
  shotType?: typeof SHORT_GAME_TYPES[number];
}

export interface PuttingDetails {
  breakType?: typeof BREAK_TYPES[number];
  breakSeverity?: typeof BREAK_SEVERITIES[number];
  puttSlope?: typeof PUTT_SLOPES[number];
  puttMiss?: typeof PUTT_MISSES[number];
  greenSpeed?: typeof GREEN_SPEEDS[number];
}

export type ShotDetails = DrivingDetails | ApproachDetails | ShortGameDetails | PuttingDetails;

export type Surface = typeof SURFACES[number];
export type EndSurface = typeof END_SURFACES[number];
export type Category = typeof CATEGORIES[number];
export type HoleResult = typeof HOLE_RESULTS[number];

// ── Models ──
export interface Player {
  playerId: number;
  playerName: string;
  email: string;
}

export interface BenchmarkRow {
  surface: Surface;
  distance: number;
  tourAvg: number;
}

export interface Course {
  courseId: number;
  clubName: string;
  courseName: string;
  apiSourceId?: string;
  holes?: CourseHole[];
}

export interface CourseHole {
  holeNumber: number;
  par: number;
  yardage: number;
  tee?: string;
}

export interface Round {
  roundId: number;
  playerId: number;
  courseId: number;
  roundDate: string;
  holesPlayed: number;
  teePreference: string;
  benchmark: string;
}

export interface Shot {
  shotId?: number;
  playerId: number;
  roundId?: number;
  hole: number;
  par: number;
  holeResult?: HoleResult;
  category: Category;
  surfaceStart: Surface;
  distanceStart: number;
  surfaceEnd: EndSurface;
  distanceEnd: number;
  clubUsed?: string;
  shotShape?: string;
  shotResult?: ShotResult;
  shotDetails?: ShotDetails;
  penalty: boolean;
  strokesGained: number;
}

// ── SG Calculation Input ──
export interface SGInput {
  surfaceStart: Surface;
  distanceStart: number;
  surfaceEnd: EndSurface;
  distanceEnd: number;
  penalty: boolean;
}

// ── Cumulative SG by Category ──
export interface SGByCategory {
  Driving: number;
  Approach: number;
  'Short Game': number;
  Putting: number;
}

// ── API Types ──
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  playerName: string;
}

export interface AuthResponse {
  token: string;
  player: Player;
}

export interface CourseSearchResult {
  id: string;
  clubName: string;
  courseName: string;
}
