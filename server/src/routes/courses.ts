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

    if (cached.recordset.length > 0) {
      res.json({ source: 'cache', courses: cached.recordset });
      return;
    }

    // Hit external Golf Course API
    const apiKey = process.env.GOLF_API_KEY;
    const response = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!response.ok) {
      res.status(502).json({ error: 'Golf Course API error' });
      return;
    }

    const data = await response.json();
    res.json({ source: 'api', courses: data.courses || [] });
  } catch (err) {
    console.error('Course search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get course details (with holes) from external API
router.get('/details/:courseId', authenticate, async (req, res) => {
  try {
    const apiKey = process.env.GOLF_API_KEY;
    const response = await fetch(`https://api.golfcourseapi.com/v1/courses/${req.params.courseId}`, {
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
    res.status(500).json({ error: 'Failed to get course details' });
  }
});

// Cache a course to our DB
router.post('/cache', authenticate, validate(cacheCourseSchema), async (req, res) => {
  try {
    const { clubName, courseName, apiSourceId, holes } = req.body;
    const pool = await getPool();

    // Insert course
    const result = await pool.request()
      .input('clubName', clubName)
      .input('courseName', courseName)
      .input('apiSourceId', apiSourceId || null)
      .query(`
        INSERT INTO DimCourse (ClubName, CourseName, APISourceID)
        OUTPUT INSERTED.CourseID
        VALUES (@clubName, @courseName, @apiSourceId)
      `);

    const courseId = result.recordset[0].CourseID;

    // Insert holes if provided
    if (holes?.length) {
      for (const hole of holes) {
        await pool.request()
          .input('courseId', courseId)
          .input('holeNum', hole.holeNumber)
          .input('par', hole.par)
          .input('yardage', hole.yardage)
          .input('tee', hole.tee)
          .query(`
            INSERT INTO DimCourseHoles (CourseID, HoleNumber, Par, Yardage, Tee)
            VALUES (@courseId, @holeNum, @par, @yardage, @tee)
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
