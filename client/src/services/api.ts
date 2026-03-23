const API_BASE = '/api';

const getToken = (): string | null => localStorage.getItem('token');

const headers = (json = true): HeadersInit => {
  const h: HeadersInit = {};
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
};

const handleRes = async (res: Response) => {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('player');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
};

// Auth
export const login = (email: string, password: string) =>
  fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) }).then(handleRes);

export const register = (email: string, password: string, playerName: string) =>
  fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password, playerName }) }).then(handleRes);

// Benchmarks
export const getBenchmarks = () =>
  fetch(`${API_BASE}/benchmarks`, { headers: headers(false) }).then(handleRes);

// Courses
export const searchCourses = (q: string) =>
  fetch(`${API_BASE}/courses/search?q=${encodeURIComponent(q)}`, { headers: headers(false) }).then(handleRes);

export const getCourseDetails = (courseId: string) =>
  fetch(`${API_BASE}/courses/details/${courseId}`, { headers: headers(false) }).then(handleRes);

export const cacheCourse = (data: Record<string, unknown>) =>
  fetch(`${API_BASE}/courses/cache`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleRes);

// Rounds
export const createRound = (data: Record<string, unknown>) =>
  fetch(`${API_BASE}/rounds`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleRes);

export const getRounds = () =>
  fetch(`${API_BASE}/rounds`, { headers: headers(false) }).then(handleRes);

export const getPlayerStats = () =>
  fetch(`${API_BASE}/rounds/stats`, { headers: headers(false) }).then(handleRes);

// Shots
export const saveShots = (roundId: number, shots: unknown[]) =>
  fetch(`${API_BASE}/shots/batch`, { method: 'POST', headers: headers(), body: JSON.stringify({ roundId, shots }) }).then(handleRes);

export const getShots = (roundId: number) =>
  fetch(`${API_BASE}/shots/${roundId}`, { headers: headers(false) }).then(handleRes);

export const getHoleScores = (roundId: number) =>
  fetch(`${API_BASE}/rounds/${roundId}/scores`, { headers: headers(false) }).then(handleRes);
