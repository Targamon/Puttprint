# Putting Putt Print on the internet (plain steps for Geoff)

Everything — the app, the server, the Privacy and Support pages — runs as **one** service.
Hosts like Render give you a free `https://` web address automatically (phones need https for GPS).

## Easiest: Render + GitHub
1. Put this `puttprint` folder in a GitHub repository (a free account at github.com).
2. Go to **render.com** → sign up (you can "Sign in with GitHub").
3. Click **New +** → **Blueprint** → pick your repository. Render reads `render.yaml` and sets everything up.
4. Click **Apply**. The first build takes ~5 minutes.
5. When it says **Live**, your address looks like: **https://puttprint.onrender.com**
   (if the name is taken it adds letters, e.g. `https://puttprint-ab12.onrender.com`).

Open it on your phone — that's the real app. Every time you push changes to GitHub, Render redeploys.

### Free vs. paid
- `render.yaml` uses the **Starter** plan (~$7/month) with a 1 GB disk so player accounts, rounds and rooms are **kept**.
- On **Free**: change `plan: starter` to `plan: free` and delete the `disk:` block. It works, but
  **the database is wiped on every restart/redeploy**, and the site sleeps after 15 min idle (first open takes ~1 min).

## Settings (environment variables)
| Name | Needed? | What it does |
|---|---|---|
| `PORT` | no | Render sets it. Default 8787. |
| `DATA_DIR` | no | Where the database lives. `/data` (the disk). |
| `CORS_ORIGIN` | no | Only if another website must call the API. Comma-separated list. |
| `DB_URL` | no | Use a hosted libSQL/Turso database instead of the disk file. |

## After it's live — update the App Store info
In `APP_STORE.md`, replace the placeholder links with your real address:
- Privacy Policy URL: `https://YOUR-ADDRESS/privacy`
- Support URL: `https://YOUR-ADDRESS/support`
- Health check (just to test): `https://YOUR-ADDRESS/health`

For the phone (Capacitor) apps, build with the live server address:
`cd app && VITE_API_URL=https://YOUR-ADDRESS/api npm run build:native`

## Other options
- **Docker anywhere:** `docker compose up --build` → open http://localhost:8787
- **Fly.io:** see the comment at the top of `fly.toml`.
- **Railway:** New Project → Deploy from GitHub → it finds the `Dockerfile`; add a Volume mounted at `/data`.

## Test on a computer without Docker
```
npm run install:all
npm run build
npm start          # open http://localhost:8787
```
