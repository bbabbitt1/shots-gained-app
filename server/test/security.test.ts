import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import courseRoutes from '../src/routes/courses.js';

// No DB needed: every request here is rejected before a query runs
const app = express().use('/api/courses', courseRoutes);
const server = app.listen(0);
after(() => server.close());

const base = () => `http://localhost:${(server.address() as AddressInfo).port}/api/courses`;
const secret = process.env.JWT_SECRET || 'dev-secret';
const get = (path: string, token: string) => fetch(base() + path, { headers: { Authorization: `Bearer ${token}` } });

test('rejects tokens signed with a non-HS256 algorithm', async () => {
  const res = await get('/details/abc', jwt.sign({ playerId: 1 }, secret, { algorithm: 'HS512' }));
  assert.equal(res.status, 401);
});

test('rejects non-numeric courseId before calling the upstream API', async () => {
  const token = jwt.sign({ playerId: 1 }, secret);
  for (const id of ['abc', '..%2Fsearch%3Fsearch_query%3Dx', '1%3Fx%3D1']) {
    assert.equal((await get(`/details/${id}`, token)).status, 400, id);
  }
});
