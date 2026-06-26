# World Cup Pick'em

A private, friends-only World Cup prediction game with **virtual points only**. No real money, no payments, no cash prizes — just fun leaderboard competition.

## Features

- Email/password auth with private invite code
- Start with 1,000 virtual points
- Pick match outcomes (Team A, Draw, Team B) and risk points
- Multiplier-based point rewards
- Live leaderboard with stats
- Admin panel to manage matches, enter scores, and recalculate
- Admin sync for upcoming matches and multipliers (The Odds API)
- CSV leaderboard export
- Mobile-friendly dark sports UI

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- JWT session cookies

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local or Docker)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection string and a random `AUTH_SECRET`.

Generate a secret (optional):

```bash
openssl rand -base64 32
```

### 3. Start PostgreSQL (Docker example)

```bash
docker run --name wcp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=world_cup_pickem -p 5432:5432 -d postgres:16
```

### 4. Run migrations & seed

```bash
npx prisma migrate dev
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Test Accounts (after seeding)

| Role  | Email               | Password     |
|-------|---------------------|--------------|
| Admin | admin@pickem.local  | password123  |
| User  | alex@pickem.local   | password123  |

**Invite code:** `WORLDCUP2026`

## How Points Work

1. Users start with 1,000 virtual points (configurable by admin).
2. When making a pick, risked points are **deducted immediately**.
3. If the pick wins: user receives stake back + profit (`stake × multiplier`).
4. If the pick loses: nothing further (stake already deducted).
5. All changes are logged in `PointsTransaction` for full audit trail.

## Admin Tasks

- **Admin** → Add/edit/delete matches, enter final scores, settle & recalculate
- **Sync Matches & Multipliers** → Import upcoming matches and refresh multipliers (requires `ODDS_API_KEY`)
- **Settings** → Change starting points, disclaimer, invite code
- **Export CSV** → Download leaderboard from admin panel
- **Reset All Points** → Reset every user to starting points

## Match & Multiplier Sync (Admin)

Add your [The Odds API](https://the-odds-api.com/) key to `.env`:

```env
ODDS_API_KEY=your_key_here
ODDS_API_SPORT_KEY=soccer_fifa_world_cup
ODDS_API_REGION=us
ODDS_API_MARKET=h2h
```

In the admin panel, click **Sync Matches & Multipliers** to:

- Import upcoming World Cup matches
- Update multipliers and kickoff times for existing matches
- Skip finished matches (scores are never overwritten)

Decimal prices from the feed are converted to profit multipliers (`decimal price - 1`). Team names are matched safely to avoid duplicates.

## Scripts

| Command            | Description                |
|--------------------|----------------------------|
| `npm run dev`      | Start development server   |
| `npm run build`    | Production build           |
| `npm run start`    | Start production server    |
| `npm run db:migrate` | Run Prisma migrations    |
| `npm run db:seed`  | Seed sample data           |
| `npm run db:studio`| Open Prisma Studio         |

## Disclaimer

This app is for entertainment purposes only. Points have no monetary value. No real-money betting. No payments. No cash prizes.
