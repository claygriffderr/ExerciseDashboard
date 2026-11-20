# Exercise Dashboard

A web app for planning, scheduling and logging strength training built on Jim Wendler's **5/3/1** method. It's meant to work for a range of people, from experienced lifters to someone picking up a barbell for the first time.

> **Status:** All four v1 steps are done: secure accounts, two 5/3/1 programs, the exercise library, the plate calculator, guided setup, the training calendar, session logging and JSON export. Diet tracking and a progress dashboard come later (see [Roadmap](#roadmap)).

## Using it

1. **Sign up and set up your plan.** A guided setup asks about your experience, program, training days, main lifts, program options, equipment and starting weights. Every choice explains what it means, and all of them can be changed later in **Settings**.
2. **Follow the calendar.** Each month shows workout and rest days. Click a workout to see its sets and weights, mark it done, skip it, or move it to another day (on a computer you can also drag it).
3. **Miss a day? Nothing is lost.** Workouts are a list done in order: a missed workout moves to your next training day. After two or more weeks away, the calendar suggests repeating a week or lowering your weights a little.
4. **Beginners find their numbers safely.** The beginner on-ramp starts with practice weeks, then two test sessions where you record a comfortable set of 5. Training maxes are worked out from those, with no maxing out.
5. **Log each session.** On a workout, enter the weight and reps of each set (tick a set to log it as planned), add assistance exercises from the library or create your own, pick how it felt, and write notes. A gentle **rest timer** starts when you tick a set and turns green when the break is over. Change the times (between sets of each kind, and between exercises) or turn it off in the box at the top of the workout.
6. **Export your history** from the Export page as a JSON file with dates, planned and logged sets, ratings and notes. It explains itself, so you can hand it to an AI assistant (a starting prompt is on the page).
7. **Plates** (bottom corner, every page) shows how to load the bar, with options close to your target weight.

## Run it locally (for development)

You need **Node.js 22** (the version the Docker image uses). Newer releases may have no ready-made build of the SQLite driver yet, in which case `npm install` tries to compile it and needs a C++ compiler.

```bash
cp .env.example .env      # local settings; the defaults are fine
npm install               # also generates the database client
npm run db:migrate        # creates data/dev.db
npm run dev               # http://localhost:3000
```

Open http://localhost:3000, create an account, and you'll land on the dashboard.

**After pulling new changes**, run `npm install` and `npm run db:migrate` again before `npm run dev`, so the database client and tables match the code.

**On Windows** (Command Prompt): use `copy .env.example .env` instead of `cp`. If the project folder is synced by OneDrive, pause syncing during `npm install` (or keep the project outside OneDrive), since OneDrive can lock files in `node_modules` and cause `EPERM` errors.

## Run it with Docker (local or on a server)

```bash
docker compose up -d --build
```

Then open http://localhost:3000. The database lives in the `app-data` Docker volume, so it survives restarts and rebuilds. Back that volume up to keep your training history.

Database migrations run automatically each time the container starts.

### Settings

Set these in `docker-compose.yml` or in a `.env` file next to it.

| Variable | Default | What it does |
| --- | --- | --- |
| `ALLOW_SIGNUPS` | `true` | Set to `false` once everyone who needs an account has one. Existing users can still log in. |
| `SECURE_COOKIES` | `true` | Login cookies are HTTPS-only. `http://localhost` still works. Set `false` only for plain HTTP on a trusted home network (for example `http://192.168.1.20:3000`). |
| `TRUSTED_PROXY_COUNT` | `0` | How many reverse proxies sit in front of the app. Set `1` behind Caddy or nginx so login rate limits see each visitor's real IP address. |
| `DATABASE_URL` | `file:/app/data/app.db` | Where the SQLite database lives. |

### Hosting on the internet

Put the app behind a reverse proxy that handles HTTPS. With [Caddy](https://caddyserver.com/) that's one line in a `Caddyfile` (it gets a certificate automatically):

```
training.example.com {
    reverse_proxy localhost:3000
}
```

Then set `TRUSTED_PROXY_COUNT=1`, keep `SECURE_COOKIES=true`, and consider `ALLOW_SIGNUPS=false` after your accounts are created.

## Security

- **Passwords** are hashed with Argon2id (19 MiB memory, 2 passes), the OWASP-recommended baseline. Passwords need at least 10 characters.
- **Sessions** use a random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (with the `__Host-` prefix and `Secure` flag over HTTPS). The database stores only a SHA-256 hash of each token, so a copy of the database can't be used to log in as anyone. Sessions last 30 days and extend while in use; logging out deletes the session on the server.
- **Cross-site request forgery:** forms post through Next.js Server Actions, which reject requests whose `Origin` doesn't match the site. `SameSite` cookies add a second layer.
- **Brute force:** login is limited to 8 attempts per account and 30 per IP address every 15 minutes. Sign-ups are limited to 5 per IP address per hour. Failed logins take the same time whether or not the email exists.
- **Headers:** a per-request Content Security Policy with a nonce (no inline scripts unless Next.js signed them), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a locked-down permissions policy, and HSTS in production.
- **Redirects** after login only go to paths on this site.
- **Every protected page and action checks the session on the server.** The request proxy's redirect to the login page is just a convenience.
- The Docker image runs as an unprivileged user.

When the app is reachable directly (no reverse proxy), a visitor can fake their IP address in a header and dodge the per-IP limit. The per-account limit still applies. Running behind a reverse proxy with `TRUSTED_PROXY_COUNT=1` closes that gap.

## Project layout

```
prisma/schema.prisma        Data model (users, sessions, profiles, exercises,
                            programs, cycles, training maxes, workouts, sets)
prisma/migrations/          Database migrations
src/proxy.ts                Per-request CSP nonce, signed-out redirects
src/lib/auth/               Passwords, session tokens, cookies, validation,
                            the data access layer (getCurrentUser / requireUser)
src/lib/security/           Rate limiting, client IP, safe redirects
src/lib/training/            The training engine (pure TypeScript, no database):
  five-three-one.ts           Wave percentages, max estimates, progression
  plates.ts, equipment.ts     Plate math and rounding to loadable weights
  exercises.ts, muscles.ts    The built-in exercise catalog
  programs/                   Program definitions (beginner on-ramp, standard 5/3/1)
  schedule.ts                 Workout queue -> calendar dates, time-away advice
  progress.ts                 Training max changes between cycles
src/lib/plan/                A person's plan: setup answers (settings.ts, draft.ts),
                            calendar layout (calendar.ts), and the database side
                            (store.ts: plans, queue, cycles; workouts.ts: move,
                            skip, done, undo, test results, time away)
src/instrumentation.ts      Syncs the exercise catalog into the database at startup
src/app/(auth)/             Log in, sign up, and their Server Actions
src/lib/log/                 Workout logs, custom exercises and the JSON export
src/app/api/export/         JSON download of the signed-in person's history
src/app/(app)/              Signed-in pages (dashboard, calendar, workouts,
                            onboarding, settings, export, programs, exercises) and the
                            plan Server Actions (plan-actions.ts)
src/components/             Setup wizard, plate calculator, muscle map, workout card
tests/                      Unit tests (npm test)
```

### Data model notes

- Weights are in pounds (lb). Kilograms may come later.
- Calendar days are stored as `YYYY-MM-DD` strings. A day with no workout is a rest day. "Today" comes from the time zone the browser reported during setup (`Profile.timezone`).
- Program definitions (5/3/1 templates) live in code. The database stores each person's choices and history.
- The built-in exercises live in `src/lib/training/exercises.ts` and are copied into the database each time the server starts. Custom exercises belong to one user.
- A program is an ordered queue of workouts (`Workout.sequence`). Calendar dates are worked out from the queue and the person's training days, so a missed workout moves to the next training day instead of being dropped. Moving a workout changes the *days*, never the order: the day it leaves becomes a day off and the day it goes to becomes a training day (`ScheduleDay` rows, `OFF` or `EXTRA`), and the queue fills the training days in order. `performedDate` is when a workout was actually done or skipped.
- Small lists (plates, weekdays, muscles, cues) are JSON strings so the schema moves to Postgres without changes beyond the provider.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run db:migrate` | Create and apply a migration after editing the schema (dev) |
| `npm run db:deploy` | Apply pending migrations (production) |

## Roadmap

1. ~~**Foundation and secure login**~~
2. ~~**Program engine and exercise library:**~~ 5/3/1 math, the workout queue, an always-available plate calculator, two programs (a beginner on-ramp and standard 5/3/1), and an exercise library with technique cues and muscle diagrams.
3. ~~**Onboarding and calendar:**~~ a guided setup where every choice is explained and editable later in Settings, and a month calendar of workout and rest days (an agenda list on phones). Missed workouts move to the next training day, can be moved to a rest day or skipped, and the app suggests easing back in after time away. Standard 5/3/1 lets you choose your volume: Boring But Big (5×10), First Set Last (5×5) or main sets only.
4. ~~**Session logging and export:**~~ log sets, accessories (built-in and custom), how it felt and notes, and export history as JSON for AI-assisted review.
5. ~~**Rest timer:**~~ an optional timer between sets and between exercises, with adjustable times.

Later: diet tracking, a progress dashboard, and warm-up sets calculated from the weights you actually use.
