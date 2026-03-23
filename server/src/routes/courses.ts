import { Router } from 'express';
import { getPool } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { validate, cacheCourseSchema } from '../middleware/validate.js';

const router = Router();

// Search courses — check DB first, then external API
router.get('/search', authenticate, async (req, res) => {
  try {
    const query = (req.query.q as string) || '';
    if (query.length < 2) {
      res.json([]);
      return;
    }

    const pool = await getPool();

    // Check local cache first
    const cached = await pool.request()
      .input('query', `%${query}%`)
      .query(`
        SELECT CourseID, ClubName, CourseName, APISourceID
        FROM DimCourse
        WHERE ClubName LIKE @query OR CourseName LIKE @query
      `);

    const cachedCourses = cached.recordset.map((c) => ({
      id: c.CourseID,
      club_name: c.ClubName,
      course_name: c.CourseName,
      api_source_id: c.APISourceID,
      source: 'cache' as const,
    }));

    // Also hit external Golf Course API
    let apiCourses: unknown[] = [];
    try {
      const apiKey = process.env.GOLF_API_KEY;
      const response = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        apiCourses = data.courses || [];
      }
    } catch {}

    res.json({ source: 'mixed', cached: cachedCourses, courses: apiCourses });
  } catch (err) {
    console.error('Course search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get course details — check local cache first, then external API
router.get('/details/:courseId', authenticate, async (req, res) => {
  try {
    const courseId = req.params.courseId as string;
    const source = req.query.source as string;

    // If from cache, load from our DB
    if (source === 'cache') {
      const pool = await getPool();
      const holes = await pool.request()
        .input('courseId', parseInt(courseId))
        .query('SELECT HoleNumber, Par, Yardage, Tee FROM DimCourseHoles WHERE CourseID = @courseId ORDER BY Tee, HoleNumber');

      // Group holes by tee
      const teeMap = new Map<string, { par: number; yardage: number }[]>();
      for (const h of holes.recordset) {
        const tee = h.Tee || 'Default';
        if (!teeMap.has(tee)) teeMap.set(tee, []);
        teeMap.get(tee)!.push({ par: h.Par, yardage: h.Yardage });
      }

      const tees = Array.from(teeMap.entries()).map(([teeName, holeList]) => ({
        tee_name: teeName,
        total_yards: holeList.reduce((s, h) => s + h.yardage, 0),
        par_total: holeList.reduce((s, h) => s + h.par, 0),
        holes: holeList,
      }));

      res.json({ course: { tees: { male: tees } } });
      return;
    }

    // Otherwise hit external Golf Course API
    const apiKey = process.env.GOLF_API_KEY;
    const response = await fetch(`https://api.golfcourseapi.com/v1/courses/${courseId}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!response.ok) {
      res.status(502).json({ error: 'Golf Course API error' });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Course details error:', err);
    res.status(500).json({ error: 'Failed to get course details', detail: err instanceof Error ? err.message : String(err) });
  }
});

// Cache a course to our DB
router.post('/cache', authenticate, validate(cacheCourseSchema), async (req, res) => {
  try {
    const { clubName, courseName, apiSourceId, holes } = req.body;
    const pool = await getPool();

    // Upsert course — check existing first
    let courseId: number;
    const existing = await pool.request()
      .input('clubName', clubName)
      .input('courseName', courseName)
      .input('apiSourceId', apiSourceId || null)
      .query(`
        SELECT CourseID FROM DimCourse
        WHERE (APISourceID IS NOT NULL AND APISourceID = @apiSourceId)
           OR (ClubName = @clubName AND CourseName = @courseName)
      `);

    if (existing.recordset.length > 0) {
      courseId = existing.recordset[0].CourseID;
    } else {
      const result = await pool.request()
        .input('clubName', clubName)
        .input('courseName', courseName)
        .input('apiSourceId', apiSourceId || null)
        .query(`
          INSERT INTO DimCourse (ClubName, CourseName, APISourceID)
          OUTPUT INSERTED.CourseID
          VALUES (@clubName, @courseName, @apiSourceId)
        `);
      courseId = result.recordset[0].CourseID;
    }

    // Upsert holes if provided
    if (holes?.length) {
      for (const hole of holes) {
        await pool.request()
          .input('courseId', courseId)
          .input('holeNum', hole.holeNumber)
          .input('par', hole.par)
          .input('yardage', hole.yardage)
          .input('tee', hole.tee || 'Default')
          .query(`
            MERGE DimCourseHoles AS target
            USING (SELECT @courseId AS CourseID, @holeNum AS HoleNumber, @tee AS Tee) AS source
            ON target.CourseID = source.CourseID AND target.HoleNumber = source.HoleNumber AND target.Tee = source.Tee
            WHEN MATCHED THEN UPDATE SET Par = @par, Yardage = @yardage
            WHEN NOT MATCHED THEN INSERT (CourseID, HoleNumber, Par, Yardage, Tee) VALUES (@courseId, @holeNum, @par, @yardage, @tee);
          `);
      }
    }

    res.json({ courseId });
  } catch (err) {
    console.error('Cache course error:', err);
    res.status(500).json({ error: 'Failed to cache course' });
  }
});

export default router;
