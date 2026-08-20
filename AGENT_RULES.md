# Agent Rules — Adaptive API Rate Limiting Middleware

Project: `waeijn/adaptive-api-rate-limiter`
Type: Undergraduate thesis system (CS 3rd year, Pamantasan ng Cabuyao) + Software Engineering 2 course deliverable
Team: Terrence (lead/backend), John Wayne Landong, Benedic Sarmiento, Bryan Cuellar

This file defines how any AI coding agent (Antigravity, Claude, Cursor, Copilot, etc.) should behave when working in this repository. Read this before making any changes.

---

## 1. Branching & Git Safety

- **Never push directly to `main`.** All work happens on feature branches (e.g. `feature/backend-dev`, `feature/frontend-ui`, `chore/*`).
- Before any commit/push action, always run `git status` and `git branch --show-current` first and confirm the branch with the user.
- Never run `git add .` or `git add -A`. Always stage explicit paths so nothing unintended gets committed.
- Never force-push (`git push -f` / `--force`) without explicit, separate confirmation.
- Always show `git diff --staged --stat` and wait for user go-ahead before committing.
- Never delete, restore, or rewrite git history (`reset --hard`, `rebase -i`, `filter-branch`) without explicit instruction.
- Treat any file deletion as high-risk. Flag deleted files in `git status` and ask before staging a deletion.

## 2. Secrets & Sensitive Data

- Never commit `.env`, credentials, API keys, tokens, or connection strings with embedded passwords.
- Before staging any new/modified file, scan for hardcoded secrets. If found, stop and flag it — do not commit.
- `redis.conf` and similar config files are expected to be safe (no embedded passwords) but should still be checked, since production values may differ from dev/thesis defaults.

## 3. Repo Structure — What NOT to Touch Without Explicit Approval

The following are **intentionally kept**, even if they look unused. Do not delete, rename, or restructure without asking the team first:

- `src/` — original planned package architecture (pre-dates the pivot to building directly in `dashboard/backend/`). Currently unused by the running system, but a scope/architecture decision, not a cleanup one.
- `tests/` — scaffolding reserved for real unit tests to be added before panel defense.
- `evaluation/` — used directly in Week 2 (FNR/latency metrics compilation). Never delete `evaluation/results/` folder structure — only the generated `.csv` files inside it are disposable.
- `experiments/` — traffic generation and Locust scenario scripts; some subfolders are placeholders for future experiments.
- `notebooks/` — optional, ask team before removing.
- `data/*/.gitkeep` — reserved paths for VM-generated logs, metrics, cache, and experiment output.
- `deployment/docker/*` — required for VM2 middleware migration.

If a cleanup task is requested, only remove files after explicit confirmation, and do it in an isolated commit (e.g. `chore/remove-unused-scaffolding`) separate from feature work.

## 4. .gitignore Conventions

- Test run outputs under `evaluation/results/` should be ignored at the file level (`evaluation/results/*.csv`), never at the folder level — the `.gitkeep` placeholders must stay tracked.
- Ad-hoc debug/demo artifacts (e.g. `demo_log_output.json`, `sigma_demo.json`) should be gitignored, not committed.
- Local-only dev scripts (e.g. `start_all.ps1`) should be confirmed with the team before deciding to ignore or commit — some may be shared tooling.

## 5. Architecture Decisions to Respect

- **Redis is the source of truth** for rate-limiter state, using an atomic Lua token bucket script — not an in-memory singleton. Do not reintroduce in-memory state as the primary store.
- **AOF persistence (`appendfsync everysec`)** is a deliberate, defensible durability choice (~1s max data loss on crash). Do not change persistence strategy without flagging the tradeoff.
- Token bucket profiles must match thesis Table 4 exactly:
  - Normal: burst=20, rate=10
  - Bursty: burst=40, rate=20
  - Suspicious: burst=5, rate=2
- Classifier order matters: sigma (regularity) check must not intercept bursty users before the lambda (rate) check — this was a previously fixed bug, don't reintroduce it.
- FNR/FPR calculations should use ground-truth Locust user-class labels where possible, not predicted labels — this is a known methodological gap being actively addressed.
- Any change touching request-level identifiable data must consider the professor's "no retention period" requirement — flag any change that would extend how long identifiable request data persists in Redis/AOF.

## 6. Working Style

- This is a two-VM system: VM1 = traffic generator/client simulator, VM2 = middleware + token bucket + classifier. Confirm which VM a change applies to before editing deployment configs.
- Prefer small, isolated commits with clear conventional messages (`feat:`, `fix:`, `chore:`) over large mixed commits — this matters for the panel defense's commit history narrative.
- When in doubt about scope (e.g. "is this file needed"), ask rather than assume — this is thesis-critical infrastructure with a defense deadline.
- Frontend changes should match the existing Figma prototype conventions already implemented (per-preset accent colors, CSS-variable-based theming, localStorage for custom profiles) — don't introduce new styling patterns ad hoc.

## 7. Escalation

If an agent is unsure whether an action is safe (deleting a file, changing persistence config, pushing to a branch, modifying classifier thresholds), it should stop and ask the user rather than proceeding.
