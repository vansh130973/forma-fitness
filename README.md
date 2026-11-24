# Forma | MongoDB-backed Diet & Fitness Management

A responsive personal fitness website upgraded from browser-only storage to a **private MongoDB Atlas-backed account**. Includes the full seven-day vegetarian diet plan and 21 recipes, gym exercise guides and logging, weight and body-fat trends, a nutrition dashboard and weekly reports.

## Security first

The database connection string previously shared in chat contained a usable password. **Change/rotate that MongoDB Atlas database-user password before running or deploying this site.** Never publish the connection string in HTML, JavaScript, GitHub, screenshots or downloadable projects.

No database credentials are included in the project. The backend loads them from a local `.env` file excluded by `.gitignore`. Only the Node.js server opens connections to MongoDB. The web browser calls same-origin authenticated API routes.

## Requirements

- Node.js 20.12+ (Node.js 22 recommended)
- npm internet access for `npm install`
- MongoDB Atlas cluster and a MongoDB user with **readWrite for the target database only**
- Atlas Network Access configured to allow the **server's egress IP** (avoid 0.0.0.0/0 in production)

## Setup

1. Unzip this ZIP into a folder.
2. In MongoDB Atlas: **Database Access → Edit user → Change Password**. Make a new strong password. Update the user's database role so it only accesses `Diet&Fitness` where possible.
3. Copy `.env.example` to `.env`.
4. Update `MONGO_URI` with your newly rotated database credentials. Remove the database pathname from the URI; specify the exact database using `MONGO_DB_NAME=Diet&Fitness`. If a username or password contains reserved URI characters, percent-encode them.
5. Create a separate **12+ character** private password for `APP_PASSWORD`. This is the sign-in password for Forma and must be **different from your MongoDB password**.
6. Ensure the database user's permissions and Atlas IP allowlist admit the backend server.
7. In the project directory run:

```bash
npm install
npm run check
npm test
npm start
```

8. Visit **http://localhost:3000** and sign in using your `APP_PASSWORD`.

Do not double-click `index.html` or publish only `public/`; MongoDB syncing requires running the Node backend.

### Environment example (placeholder values only)

```dotenv
MONGO_URI=mongodb+srv://YOUR_DB_USERNAME:YOUR_NEW_DB_PASSWORD@trufwar.ioqwh9a.mongodb.net/?retryWrites=true&w=majority&appName=TrufWar
MONGO_DB_NAME=Diet&Fitness
APP_PASSWORD=YOUR_SEPARATE_PRIVATE_APP_PASSWORD
PORT=3000
NODE_ENV=development
```

**Database name:** `Diet&Fitness`. The `&` stays in the separate environment setting to avoid potential confusion in a connection URI. MongoDB uses this literal database name on the backend.

## What is stored in MongoDB

- **`fitness_state`** collection, document `_id: "primary"`: nutrition goals, meal check-offs, custom foods, completed workout sets, actual weights/reps, yoga/aerobics attendance, daily notes, weight/waist/body-fat logs, and revision numbers.
- **`fitness_sessions`** collection: hashed random session tokens with expiry, with a TTL index.

**Not stored:** MongoDB credentials, the Forma login password, or the original full personal measurements photograph. Recipes and workout templates remain bundled in the frontend; logs and preferences are in MongoDB.

### API endpoints

| Method | URL | Description |
| --- | --- | --- |
| GET | `/api/health` | Server health (no private content) |
| GET | `/api/auth/session` | Returns logged-in status |
| POST | `/api/auth/login` | Signs in and sets HttpOnly cookie |
| POST | `/api/auth/logout` | Invalidates MongoDB session |
| GET | `/api/state` | Reads authenticated fitness records |
| PUT | `/api/state` | Saves validated fitness records with revision conflict detection |

All writes require a same-origin request with the `X-Forma-Request: 1` header. The password login is rate-limited in memory to five failures per 15-minute window per source IP. Cookies are `HttpOnly` and `SameSite=Strict`, and get the `Secure` flag in `NODE_ENV=production`.

## Migrating from the previous offline Forma website

- If the previous browser data is accessible to the new website at the same origin, the app offers to import those logs when the cloud profile is empty.
- If the previous app was opened by double-clicking its HTML file, export its JSON from **Settings → Export**. Then open this new website, sign in, and import it using **Settings → Import**.
- Don't import on a second device without deciding whether you want to replace the current cloud profile. The cloud profile is the source of truth.
- Failed saves keep a local emergency backup and display an explicit error. If another device changed the cloud revision, export your unsaved data before reloading to avoid overwriting newer records.

## Development tests

The Node test suite uses an in-memory mock repository to validate request authentication, cookie flags, read/write behavior, conflicts, input filtering and logout. A real Atlas connection cannot be tested without a reachable cluster and fresh credentials.

## Deployment notes

This app must run as a **Node server**, not just static hosting. For public deployment, use a process manager (systemd or PM2), reverse proxy with HTTPS (Nginx/Apache), limit Atlas IP access and protect `.env` with filesystem permissions. Never expose port 3000 directly to the public internet without reverse proxy protections.

Example with Nginx behind HTTPS:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Real-IP $remote_addr;
}
```

Use `NODE_ENV=production` for HTTPS deployments. Configure automatic TLS certificate renewal and MongoDB backups. Cookie protection assumes end users connect over HTTPS. Don't set `0.0.0.0/0` for the Atlas allowlist unless absolutely unavoidable during temporary debugging.

## Features

- Dashboard: calorie/protein/carbs/fat consumed, goal rings, weight trend and weekly summaries
- Diet planner: 7-day Indian dairy-vegetarian plan, three meals/day, two rotis/day, meal checkboxes and custom food logging
- Recipe library: 21 meals with full cooking instructions, ingredient weights, prep/cook time and estimated macros
- Workout planner: daily exercises, sets/reps/rest, targeted form/video links, reps and weights log, coach-led yoga/aerobics, Sunday rest
- Progress: date-based weight, abdomen, optional body-fat machine measurements, energy and recovery
- Settings: nutrition goal edits, JSON export/import, reset and retry failed MongoDB synchronization

_Nutrition values are estimates. This is not a substitute for clinical or in-person fitness guidance._

## Render cloud deployment (updated)

**Use `DEPLOY_RENDER.md` for exact steps.** This version fixes the original `.env`-dependent startup command. In Render, choose a Node web service, set `MONGO_URI`, `MONGO_DB_NAME`, `APP_PASSWORD`, and `NODE_ENV` as environment variables, and run `npm start`. An optional `render.yaml` Blueprint is provided. For local `.env` development use `npm run start:local`.

## Workout catalogue update (24 November 2026)

The Workout Planner now contains the requested exercises for Monday through Sunday. Cardio choices, strength exercise sets/reps/rest, optional higher-skill movements, and coach-led yoga/aerobics reference movements are shown by day. Workout logs, exercise load/repetition records, and class attendance continue to be saved by date using the existing authenticated MongoDB API. Demonstration links open external YouTube search results; they are not locally hosted videos.

**Beginner safety:** although the requested target of three sets of 10–12 reps appears on many exercises, the site advises beginning with two sets of four to five main exercises for the first two weeks and adding volume gradually. Deadlifts, swings, burpees, bench dips, and thrusters are optional. For Tuesday, choose either the deadlift drill or goblet squat alternative. Instructor-led classes remain at the coach's discretion.

Redeploy to Render by replacing your GitHub repository files with these updated files, committing, and pushing to the deployed branch. No MongoDB schema migration or environment variable changes are required.
