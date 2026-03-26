import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const validate = (schema: z.ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
      return;
    }
    req.body = result.data;
    next();
  };

// ── Auth Schemas ──
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  playerName: z.string().min(1).max(100).trim(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

// ── Round Schema ──
export const createRoundSchema = z.object({
  courseId: z.number().int().positive(),
  roundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  holesPlayed: z.number().int().min(1).max(18),
  teePreference: z.string().max(50),
  benchmark: z.string().max(20).optional().default('Pro'),
});

// ── Shot Schema ──
const shotSchema = z.object({
  hole: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  holeResult: z.string().max(20).optional(),
  category: z.enum(['Driving', 'Approach', 'Short Game', 'Putting']),
  surfaceStart: z.enum(['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Recovery']),
  distanceStart: z.number().min(0).max(700),
  surfaceEnd: z.enum(['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Recovery', 'Hole']),
  distanceEnd: z.number().min(0).max(700),
  clubUsed: z.string().max(50).optional(),
  shotShape: z.string().max(50).optional(),
  shotResult: z.string().max(20).optional(),
  shotDetails: z.record(z.string(), z.unknown()).optional(),
  penalty: z.boolean(),
  strokesGained: z.number(),
});

export const updateShotSchema = z.object({
  hole: z.number().int().min(1).max(18).optional(),
  par: z.number().int().min(3).max(6).optional(),
  holeResult: z.string().max(20).optional(),
  category: z.enum(['Driving', 'Approach', 'Short Game', 'Putting']).optional(),
  surfaceStart: z.enum(['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Recovery']).optional(),
  distanceStart: z.number().min(0).max(700).optional(),
  surfaceEnd: z.enum(['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Recovery', 'Hole']).optional(),
  distanceEnd: z.number().min(0).max(700).optional(),
  clubUsed: z.string().max(50).optional(),
  shotShape: z.string().max(50).optional(),
  shotResult: z.string().max(20).optional(),
  shotDetails: z.record(z.string(), z.unknown()).optional(),
  penalty: z.boolean().optional(),
  strokesGained: z.number().optional(),
});

export const batchShotsSchema = z.object({
  roundId: z.number().int().positive(),
  shots: z.array(shotSchema).min(1).max(200),
});

// ── Course Cache Schema ──
const holeSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().min(0).max(700),
  tee: z.string().max(50).optional(),
});

export const cacheCourseSchema = z.object({
  clubName: z.string().min(1).max(200).trim(),
  courseName: z.string().max(200).trim(),
  apiSourceId: z.union([z.string(), z.number()]).transform(String).optional(),
  holes: z.array(holeSchema).optional(),
});
