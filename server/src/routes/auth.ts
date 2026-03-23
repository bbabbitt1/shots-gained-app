import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../db/connection.js';
import { validate, registerSchema, loginSchema } from '../middleware/validate.js';

const router = Router();

router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, playerName } = req.body;
    const pool = await getPool();

    const existing = await pool.request()
      .input('email', email)
      .query('SELECT PlayerID FROM DimPlayer WHERE Email = @email');

    if (existing.recordset.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.request()
      .input('name', playerName)
      .input('email', email)
      .input('hash', hash)
      .query(`
        INSERT INTO DimPlayer (PlayerName, Email, PasswordHash)
        OUTPUT INSERTED.PlayerID, INSERTED.PlayerName, INSERTED.Email
        VALUES (@name, @email, @hash)
      `);

    const player = result.recordset[0];
    const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-secret');
    if (!secret) { res.status(500).json({ error: 'Server config error' }); return; }
    const token = jwt.sign({ playerId: player.PlayerID }, secret, { expiresIn: '7d' });

    res.json({
      token,
      player: { playerId: player.PlayerID, playerName: player.PlayerName, email: player.Email },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await getPool();

    const result = await pool.request()
      .input('email', email)
      .query('SELECT PlayerID, PlayerName, Email, PasswordHash FROM DimPlayer WHERE Email = @email');

    if (result.recordset.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const player = result.recordset[0];
    const valid = await bcrypt.compare(password, player.PasswordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-secret');
    if (!secret) { res.status(500).json({ error: 'Server config error' }); return; }
    const token = jwt.sign({ playerId: player.PlayerID }, secret, { expiresIn: '7d' });

    res.json({
      token,
      player: { playerId: player.PlayerID, playerName: player.PlayerName, email: player.Email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
