# GitHub Pages Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the Vite + TanStack Router app to GitHub Pages on push to `main` and on merged PRs, with working SPA routing and data fetches under project base path.

**Architecture:** Add a GitHub Actions Pages workflow that builds and deploys `dist`, configure Vite/Router base path for project pages, and centralize asset URL resolution in services so `/data/...` paths resolve correctly under `/state-election/`.

**Tech Stack:** GitHub Actions, Vite, TanStack Router, TypeScript, npm.

---

### Task 1: Add failing tests for base-path URL resolution

**Files:**
- Create: `src/services/url.test.ts`
- Modify: `package.json`
- Modify: `src/services/appConfig.ts`

**Step 1: Write the failing test**
- Add tests validating that `/data/...` resolves to `/state-election/data/...` when base is `/state-election/`.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/services/url.test.ts`
- Expected: FAIL because resolver is missing.

**Step 3: Write minimal implementation**
- Add a helper for public asset path resolution and wire it into config/csv fetch calls.

**Step 4: Run test to verify it passes**
- Run: `npm test -- src/services/url.test.ts`
- Expected: PASS.

### Task 2: Configure app base path for GitHub Pages

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`

**Step 1: Write/adjust tests (if needed)**
- Keep behavior covered by URL tests and verify build output path behavior by build command.

**Step 2: Minimal implementation**
- Set `base` in Vite for CI Pages builds.
- Set router `basepath` from `import.meta.env.BASE_URL`.

**Step 3: Verify**
- Run: `npm run build`
- Expected: PASS.

### Task 3: Add GitHub Pages deployment workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Step 1: Add workflow**
- Trigger on push to `main`, merged PR to `main`, and manual dispatch.
- Build app, copy `index.html` to `404.html`, upload artifact, deploy with Pages actions.

**Step 2: Verify syntax and project checks**
- Run: `npm run lint`
- Run: `npm run build`
- Expected: PASS.
