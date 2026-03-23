# Shots Gained App

## Overview
Real-time shots gained tracking web app for golf rounds. Replaces an existing Python/Tkinter desktop app with a modern web stack deployable to Azure.

**Timeline:** MVP must be deployed and usable by 2026-03-25 (golf trip).

## Tech Stack
- **Frontend:** TypeScript, React (Vite), Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** Azure SQL (SQL Server)
- **Hosting:** Azure App Service (or Azure Static Web Apps for frontend)
- **API:** Golf Course API (`https://api.golfcourseapi.com/v1/`) — API Key: `E2ASQ6BSGEORKADN7DDAWCSTMA`

## Architecture

### Data Model (Dimensional)
- **DimPlayer** — PlayerID (PK), PlayerName, Email, PasswordHash
- **DimAvg** — Surface, Distance, TourAvg, UnitOfMeasurement (benchmark data seeded from `dimaverages.csv`)
- **DimCourse** — CourseID (PK), ClubName, CourseName, APISourceID, cached from Golf Course API
- **DimRound** — RoundID (PK), PlayerID (FK), CourseID (FK), RoundDate, HolesPlayed, TeePreference, Benchmark, CreatedDate
- **FactShots** — ShotID (PK), PlayerID, RoundID, Hole, Par, HoleResult, Category, SurfaceStart, DistanceStart, SurfaceEnd, DistanceEnd, ClubUsed, ShotShape, Penalty, StrokesGained

### Core Calculation
```
StrokesGained = TourAvg[StartSurface, StartDistance] - (1 + TourAvg[EndSurface, EndDistance])
// If EndSurface == "Hole": EndValue = 0
// If Penalty: SG -= 1
```

### Categories
- **Driving** — Tee shots on Par 4/5
- **Approach** — Shots to the green (non-putting, non-driving)
- **Short Game** — Chips, pitches, bunker shots around the green
- **Putting** — Shots from the green

### Surfaces
Tee, Fairway, Rough, Sand, Green, Recovery, Penalty → End can also be "Hole"

## Key Features (MVP)
1. Player login — simple email/password (JWT + bcrypt)
2. Course selection — search Golf Course API (returns tee/yardage per hole), cache to DimCourse
3. Benchmark: Pro only for MVP
4. Shot-by-shot entry with manual distance input + real-time SG calculation
5. Cumulative SG tracker by category (Driving, Approach, Short Game, Putting)
6. Round summary with SG breakdown
7. Mobile-first responsive UI (used on the course — large tap targets, minimal inputs)
8. Holes played: 9 / 18 / custom (e.g., 12 holes)

## Future Features
- Offline support (service worker + IndexedDB sync)
- Blast Motion putting metrics integration
- Historical round comparison
- Multiple benchmark levels (scratch, 5hcp, 10hcp)
- Scoring trends / dashboards

## Reference: Existing Python App
Located at `C:\Users\babbi\PycharmProjects\StrokesGained\`
- `shot_entry.py` — Core SG calculation logic
- `dimaverages.csv` — Benchmark data (tour averages by surface/distance)
- `round_summary.py` — Analytics and DB write logic
- `tableload.py` — Schema definitions

## Project Structure
```
shots-gained-app/
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API client calls
│   │   ├── types/       # TypeScript interfaces
│   │   └── utils/       # SG calculation, helpers
│   └── ...
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── models/      # DB queries/models
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Auth, error handling
│   │   └── db/          # Connection, migrations, seed
│   └── ...
├── shared/              # Shared types between client/server
└── CLAUDE.md
```

## Commands
```bash
# Development
cd client && npm run dev     # Start frontend dev server
cd server && npm run dev     # Start backend dev server

# Build
cd client && npm run build   # Build frontend
cd server && npm run build   # Build backend

# Database
cd server && npm run db:migrate  # Run migrations
cd server && npm run db:seed     # Seed benchmark data
```

## Design

### Color Palette
```
/* Base */
--bg-primary:    #0A0F1A    /* App background — deep navy-black */
--bg-card:       #141B2D    /* Cards, panels, shot entry form */
--bg-surface:    #1C2640    /* Elevated surfaces, modals, dropdowns */
--border:        #2A3A5C    /* Borders, dividers */
--text-primary:  #F1F5F9    /* Primary text — near-white */
--text-secondary:#94A3B8    /* Labels, secondary info */
--text-muted:    #64748B    /* Placeholders, disabled */

/* Accent */
--accent:        #3B82F6    /* Primary actions, buttons, links */
--accent-hover:  #2563EB    /* Button hover */

/* Strokes Gained States */
--sg-positive:    #22C55E   /* Positive SG (bright green) */
--sg-positive-bg: #22C55E1A /* Subtle green tint */
--sg-negative:    #EF4444   /* Negative SG (bright red) */
--sg-negative-bg: #EF44441A /* Subtle red tint */
--sg-neutral:     #94A3B8   /* Zero / neutral */

/* Category Colors (cumulative tracker) */
--cat-driving:    #F59E0B   /* Amber — power, distance */
--cat-approach:   #3B82F6   /* Blue — precision, iron play */
--cat-shortgame:  #A78BFA   /* Purple — finesse, touch */
--cat-putting:    #22D3EE   /* Cyan — green, reads */
```

### Design Principles
- Mobile-first — used on the golf course from a phone
- High contrast for outdoor sunlight readability
- Minimal taps per shot entry — smart defaults, auto-carry from previous shot
- Large touch targets (44px+ minimum)
- Font: Inter (Google Fonts) — clean, legible at small sizes
