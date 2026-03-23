# Shots Gained Tracker

Real-time strokes gained tracking app for golf. Log shots on the course from your phone and get instant SG feedback by category — Driving, Approach, Short Game, and Putting.

Built as a mobile-first PWA with offline support, designed for outdoor use with high contrast and large touch targets.

## Screenshots

_Coming soon_

## How It Works

1. **Search and select a course** — pulls tee/yardage data from the Golf Course API
2. **Log shots hole-by-hole** — enter start/end surface and distance, SG calculates instantly
3. **See real-time stats** — live score, SG by category, FIR, GIR, putts as you play
4. **Review your round** — summary with centered diverging bar chart (green = gained, red = lost)
5. **Track over time** — dashboard with aggregate stats across all rounds

### Strokes Gained Formula

```
SG = TourAvg(start_surface, start_distance) - (1 + TourAvg(end_surface, end_distance))

If holed out:  end_value = 0
If penalty:    SG -= 1
```

Benchmarks sourced from PGA Tour averages (~3,500 data points across all surfaces and distances).

### Categories

| Category | Definition |
|----------|-----------|
| Driving | Tee shots on par 4s and 5s |
| Approach | Shots toward the green (including par 3 tee shots) |
| Short Game | Within 50 yards, off the green |
| Putting | On the green |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | Azure SQL (SQL Server) |
| Auth | JWT + bcrypt |
| Offline | PWA (Workbox), IndexedDB (idb-keyval) |
| Security | Helmet, CORS, Zod validation, rate limiting |
| Course Data | [Golf Course API](https://golfcourseapi.com) |

## Project Structure

```
shots-gained-app/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # ShotForm, SGTracker, ShotDetailsPanel, ProtectedRoute
│   │   ├── pages/          # Login, Dashboard, RoundSetup, ShotEntry, RoundSummary,
│   │   │                   #   RoundHistory, RoundDetail
│   │   ├── hooks/          # useRound (round state management)
│   │   ├── services/       # API client, offline (IndexedDB), sync
│   │   └── ...
│   └── public/             # PWA icons, favicon
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # auth, rounds, shots, courses, benchmarks
│   │   ├── middleware/     # JWT auth, Zod validation
│   │   └── db/             # Connection, migrations, seed scripts
│   └── ...
├── shared/                 # Shared between client & server
│   ├── types.ts            # Surfaces, categories, clubs, shot details
│   └── sg-calculator.ts    # SG calculation, category inference, formatting
└── data/
    └── dimaverages.csv     # PGA Tour benchmark data
```

## Data Model

```
DimPlayer     — PlayerID, PlayerName, Email, PasswordHash
DimCourse     — CourseID, ClubName, CourseName, APISourceID
DimRound      — RoundID, PlayerID, CourseID, RoundDate, HolesPlayed, TeePreference
DimAvg        — Surface, Distance, TourAvg (benchmark data)
FactShots     — ShotID, RoundID, Hole, Par, Category, SurfaceStart/End, DistanceStart/End,
                ClubUsed, Penalty, StrokesGained, ShotResult, ShotDetails
FactHoleScores — RoundID, Hole, Score, GreenInReg, FairwayResult, Putts, UpAndDown, SG by category
```

## Getting Started

### Prerequisites

- Node.js 18+
- Azure SQL database (or SQL Server)
- Golf Course API key

### Environment Variables

Create `server/.env`:

```env
DB_SERVER=your-server.database.windows.net
DB_NAME=shots-gained
DB_USER=your-user
DB_PASSWORD=your-password
JWT_SECRET=your-secret-key
GOLF_API_KEY=your-golf-api-key
FRONTEND_URL=http://localhost:5173
```

### Install & Run

```bash
# Install all dependencies
npm install
cd client && npm install
cd ../server && npm install

# Run database migrations and seed benchmark data
cd server
npm run db:migrate
npm run db:seed

# Start both client and server (from project root)
cd ..
npm run dev
```

The client runs on `http://localhost:5173` and proxies API requests to the server on port `3001`.

### Build for Production

```bash
npm run build
cd server && npm start
```

The server serves the built client from `client/dist/` when `NODE_ENV=production`.

## Offline Support

The app works offline via:

- **Service Worker** — caches static assets and API responses (Workbox)
- **IndexedDB** — caches benchmark data locally for SG calculation without network
- **Offline save queue** — rounds saved offline are queued and auto-synced when connectivity returns
- **PWA installable** — add to home screen for native app feel

## License

Private project.
