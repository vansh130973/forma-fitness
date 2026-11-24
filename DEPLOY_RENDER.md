# Deploy Forma to Render and MongoDB Atlas

This project is a single **Node.js web service** that serves both the frontend and protected API. No separate static-site deployment is necessary.

## 0. Security before deployment

- Reset the Atlas **database-user** password that was exposed in chat.
- Do **not** paste secrets into code, `.env.example`, `render.yaml`, Git, screenshots, or the browser.
- Use a database user with `readWrite` on **`Diet&Fitness` only** where available.
- Use a different, strong password (12+ characters) for the private Forma website (`APP_PASSWORD`).
- The app is a **single-profile** product protected by one shared website password, not a user-registration service.

## 1. Get code into a private GitHub repository

Unzip this project. Create an **empty private GitHub repository** named `forma-fitness` (don't initialize it with a README). Open the terminal in the extracted folder, and execute:

```sh
git init
git add .
git commit -m "Prepare Forma for secure Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/forma-fitness.git
git push -u origin main
```

Do not run `git add` on local secrets. The included `.gitignore` excludes `.env`.

## 2. Prepare MongoDB Atlas

1. In Atlas > **Database Access**, rotate the exposed database password and set a narrow `readWrite` database role.
2. In Atlas > **Database / Clusters > Connect > Drivers**, copy the Node.js connection URI. Replace its password with the NEW value locally in Render's secrets UI. Percent-encode reserved characters in the new username/password.
3. Use the URI without `/Diet&Fitness` in the path. Set `MONGO_DB_NAME` separately to the literal `Diet&Fitness`.
4. Make sure the cluster is running and the user is enabled.

## 3. Deploy on Render (Dashboard route)

1. Go to https://dashboard.render.com/ and choose **New > Web Service**.
2. Connect the **private GitHub repository** and select `main` branch.
3. Runtime: **Node**. Root Directory: repository root (leave blank if package.json is at the top).
4. Build Command: `npm install && npm run check && npm test`.
5. Start Command: `npm start`.
6. Health Check Path: `/api/health` (if the option is shown).
7. Set environment variables:

   | Name | Value |
   |---|---|
   | `MONGO_URI` | The NEW complete `mongodb+srv://...` secret connection string copied from Atlas |
   | `MONGO_DB_NAME` | `Diet&Fitness` |
   | `APP_PASSWORD` | A DIFFERENT long private website password |
   | `NODE_ENV` | `production` |

   Do not set `PORT`; Render provides it. The included `.node-version` selects Node 22.22.0.
8. Create the service and monitor deploy logs.

**Alternative:** Render > New > Blueprint; connect repo and use its `render.yaml`. Render prompts for `MONGO_URI` and `APP_PASSWORD` on initial creation. Never add their values to `render.yaml`.

## 4. Restrict Atlas Network Access to Render egress

1. Once the Render service is created, open its details > **Connect > Outbound**. Copy ALL IP addresses / CIDR ranges that Render lists for your service.
2. In Atlas **Network Access > IP Access List > Add IP Address**, add those ranges.
3. When the deployed service connects successfully, remove the unrestricted `0.0.0.0/0` rule shown in your earlier Atlas screenshot.
4. The existing address for your own machine does not cover Render's outbound traffic. Shared Render ranges are different from exclusive dedicated outbound IPs; for extra isolation, use dedicated IPs or private connectivity if your hosting plan supports it.

If initial deployment fails before you add IP ranges, add the ranges, then use Render **Manual Deploy / Deploy latest commit**.

## 5. Verify deployment and MongoDB persistence

1. Visit `https://YOUR-SERVICE.onrender.com/api/health` in a browser. Expected: `{"status":"ok"}`. This confirms an HTTP response, not that writing data succeeded.
2. Visit `https://YOUR-SERVICE.onrender.com/` and sign in using **`APP_PASSWORD`**, NOT the Atlas password.
3. Open **Diet Planner**, choose a day, mark one meal completed, and wait for the UI sync indicator to say **Saved to MongoDB**.
4. Reload the website. The meal should remain checked. Do not assume a save succeeded if the indicator says it failed.
5. In **Progress**, add a new dated weight measurement (for example your real 98 kg) and save. Refresh and confirm it persists.
6. In **Workout Planner**, log a completed set with your actual reps and resistance. Refresh and confirm it remains.
7. In MongoDB Atlas > **Browse Collections**, expand the `Diet&Fitness` database > `fitness_state`. Open the `_id: "primary"` document; the `state` field holds meal, workout and progress records; its `revision` increases after saving. The `fitness_sessions` collection is created on login.
8. Sign in from a second browser or device and verify you can retrieve the same state. Because there is one profile, use one device at a time for editing when possible; the server returns a conflict rather than overwriting edits made by another device.

## 6. Troubleshooting

- `MONGO_URI is missing` or `APP_PASSWORD ...`: enter both variables in **Render > Environment** and redeploy.
- `ServerSelectionError`, timeout, network unreachable: add Render's **outbound** CIDR ranges in Atlas Network Access; check cluster uptime and string.
- `Authentication failed`: rotate/check the Atlas **database-user** password, replace `MONGO_URI` in Render, and redeploy.
- `not authorized` / cannot create index: grant your app user necessary `readWrite` on `Diet&Fitness` (index creation requires suitable privileges).
- A successful `/api/health` but failed login/save: inspect **Render > Logs**, network allowlist, Atlas permissions and authentication settings.
- `401` on `/api/state`: log in again; it is a private route.
- `409` on saving: your MongoDB data changed from another device; export any unsaved changes before refreshing.
- Do **not** deploy only the `public` directory. Both frontend and backend must run together under the same origin for cookie auth to work.

## Local run (optional)

```sh
cp .env.example .env
# Set the four values in .env; never commit it.
npm install
npm test
npm run start:local
```

Visit `http://localhost:3000`. `npm start` is intentionally cloud-safe and reads environment variables already supplied by Render; `npm run start:local` explicitly reads your local `.env` file.
