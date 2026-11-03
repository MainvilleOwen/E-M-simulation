# Deploying E&M Lab to GitHub Pages

The app is a static site (`index.html`, `favicon.svg`, `css/`, `js/`). No build step, no server code, no network calls at runtime.

`gh auth status` failed in the build container, so nothing was deployed automatically. These are the exact steps.

## 1. Decide on visibility (Owen)

GitHub Pages on a free account only serves **public** repositories. If `MainvilleOwen/E-M-simulation` is private, either make it public (Settings → General → Danger Zone → Change visibility) or use a paid plan. Nothing in the repo is secret.

## 2. Get the code onto `main`

The work is on the branch `claude/new-session-yifgk1`. Either merge it through a pull request on GitHub, or locally:

```bash
git fetch origin
git checkout main            # or: git checkout -b main origin/claude/new-session-yifgk1  (if main does not exist yet)
git merge --ff-only origin/claude/new-session-yifgk1
git push origin main
```

## 3. Turn on Pages with GitHub Actions

On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The workflow `.github/workflows/pages.yml` then deploys on every push to `main` (or run it by hand: **Actions → Deploy to GitHub Pages → Run workflow**). It publishes only the site files.

The site will be at:

```
https://mainvilleowen.github.io/E-M-simulation/
```

### Alternative without Actions

**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. This works too (a `.nojekyll` file is included so nothing is filtered out), but it also publishes the test screenshots in `checks/`.

## 4. Smoke-test the live site

From a machine with the repo and Node installed:

```bash
npm install
npx playwright install chromium     # once per machine
E2E_BASE_URL=https://mainvilleowen.github.io/E-M-simulation/ npx playwright test tests/e2e/smoke.spec.js tests/e2e/home.spec.js
```

`E2E_BASE_URL` makes the tests use the live URL instead of starting a local server. Both viewports (phone 390×844 and desktop 1366×768) run.

## 5. Local use (no deploy)

```bash
npm install
npm run serve        # then open http://localhost:8080/
```

ES modules do not load from `file://`, so opening `index.html` directly will not work.
