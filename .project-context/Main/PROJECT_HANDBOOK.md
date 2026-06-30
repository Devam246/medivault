# MediVault — PROJECT_HANDBOOK.md
*(Merged version of TRANSITION.md + IDE_AGENT_RULEBOOK.md)*

**Purpose:** This is the single file every IDE/agent (Cursor, Claude Code, Copilot, etc.) or human developer reads first when picking up this project. It combines two things that used to live in separate files: the behavioral rulebook ("how to work") and the live handoff snapshot ("where things stand right now"). They're merged here because in practice they were read together, updated together, and referenced each other constantly — keeping them apart just meant two files to keep in sync instead of one.

`MEDIVAULT_DETAILED_VERSION_GUIDE.md` is untouched and still the source of truth for *what to build* — every version, every step, every Definition of Done. This file never replaces that guide; it tells you how to behave while executing it, and exactly where the last session left off.

**This file must be updated at the end of every session**, before stopping work or switching tools — not just when a tool switch is known to be happening, since the next session may use a different IDE without warning. Treat updating it as part of finishing the work, not an optional extra step.

---

## 1. How To Use This Document (Read This First)

If you are a new IDE/agent or developer picking up this project:

1. Read this entire file, top to bottom, before touching any code.
2. Go to **Section 3 (Current State)** to find out exactly what to do next.
3. Open `MEDIVAULT_DETAILED_VERSION_GUIDE.md` and locate the current version/step named in Section 3. Read that step in full before writing anything.
4. If you need deeper history — why something looks the way it does, what's already been tried — check the documents listed in **Section 6**.
5. Do not start coding until you've done the above. Do not assume — verify against the actual codebase if anything here seems stale or contradicts what you see in the files.
6. If `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATE.md`, or any file listed in Section 6 is missing entirely, that's a signal something was skipped. Flag it to the user rather than silently proceeding without it. Create missing required files (see Section 7's file structure) before doing any other work.

---

## 2. Core Rules (How To Work)

These rules govern every action taken on this project, regardless of which version or step is in progress. They exist because fast, prompt-driven coding sessions are exactly where scope creep, silent bugs, and undocumented decisions happen. If a rule here ever conflicts with a one-off instruction typed mid-session, the rule wins unless the user explicitly overrides it in writing for that session.

### 2.1 Stay In Scope

- Work only on the current version's current step, as defined in the guide. Do not jump ahead to a later version's tasks, even if it seems efficient or obviously needed soon.
- Do not start a new version until the previous version's Definition of Done is **fully** checked off. No exceptions, no "just this one item from later."
- Do not touch files, folders, or features outside the scope of the current step. Example: if a step says "fix `/patient/search`," do not also refactor an unrelated controller in the same pass, even if it looks messy while you're in there. Note it instead (see 2.5).
- Do not invent new scope. No adding libraries, patterns, abstractions, or "nice to have" improvements that aren't written in the guide — even if they seem like good ideas. Prefer the simplest solution that satisfies the current step using tools the project already has.
- If a step in the guide is ambiguous, underspecified, or impossible to execute as written in this environment, **stop and ask the user for clarification** before proceeding. Don't guess and move forward — a wrong guess compounds across every step built on top of it.
- If unsure whether an action is in scope at all, ask before acting. Asking costs a few seconds; an undocumented out-of-scope change costs a debugging session later.

### 2.2 Test After Every Change

- No change is considered complete until it has been tested. "It compiles" is not a test. "It looks right" is not a test. Nothing is "done" or "fixed" until you've actually run it — assumptions are not verification.
- Match the test to the layer touched:
  - **Logic / utility / repository change** → run the relevant unit test.
  - **Route / controller change** → run the relevant integration test, or manually exercise the endpoint if integration tests don't exist yet for that route.
  - **UI component change** → run the relevant component test, or manually verify in the browser if no test exists yet.
  - **Cross-cutting change** (auth, routing, DB schema) → run the full relevant test suite, not just the one file touched — these changes have wide blast radius.
- If no automated test exists yet for the area touched (e.g. early versions, before the test suite is built), perform a manual verification and **document exactly what was checked and what the result was** in the changelog entry. "Manually verified" with no detail doesn't count.
- Never mark a Definition of Done checkbox without a passing test or a documented manual verification behind it.
- If a test fails after a change, do not move on to the next step. Fix it or roll back before proceeding — a red test blocks all further work in that area.
- After completing an entire version, re-run the **full** existing test suite (not just tests for the new work) to confirm nothing from a prior version broke.

### 2.3 Deviations Must Be Documented With Reasoning

- A deviation from the guide is only allowed when strictly necessary — e.g. the guide's instruction doesn't work in this environment, a dependency is deprecated, or following it as written would break something else. "Seemed better" is not a valid reason.
- Every deviation must be logged **immediately**, before continuing, in `docs/CHANGELOG.md` using this exact format:

  ```
  ### DEVIATION — [date] — [version, e.g. v1.2]
  - What the guide said to do: <quote or summary>
  - What was actually done instead: <description>
  - Why the deviation was necessary: <concrete reason — not "seemed better">
  - Risk/impact of this deviation: <what could break, what changed in behavior>
  ```

- Never silently deviate. If it's not documented, it didn't happen as far as the project record is concerned — and an undocumented deviation is treated as a rule violation, not a minor oversight.
- Do not make a deviation "permanent policy" unilaterally. Flag it to the user and let them decide whether to update the guide itself to reflect the new approach going forward.

### 2.4 Documentation of Every Change

- `docs/CHANGELOG.md` is the single running log of all work. Every session must **append** to it, never overwrite or delete history. If something is later reverted, add a new entry describing the revert and why — don't erase the original entry.
- Each changelog entry must include:
  - Date and version (e.g. `v1.0`, `v1.2 Step 4`)
  - What was changed (files touched, functions added/removed/modified)
  - Why it was changed (which guide step this corresponds to)
  - How it was verified (what test or manual check was run, and the result)
  - A deviation block per 2.3, if applicable
- `docs/DECISIONS.md` is kept separately for one-time architectural decisions only (e.g. which blockchain chain was chosen in v2.1, which async job model was chosen in v1.2). Keeping these out of the noisy changelog keeps them easy to find later when someone asks "why did we choose this."
- Update the relevant Definition of Done checklist **in the guide itself** (check the box) immediately once an item is verified complete — don't batch this up for later, it gets forgotten.

### 2.5 General Discipline

- One step at a time. Don't batch multiple guide steps into a single sweeping change — small, reviewable diffs only. A change that's hard to review is a change that's hard to trust.
- Never touch secrets, credentials, or `.env` files in a way that could expose them — don't print them, don't log them, don't commit them, don't paste them into chat/output unless explicitly asked, and even then redact where possible.
- Never auto-delete data, drop tables, or run destructive migrations (or force-pushes) without explicit confirmation from the user first, even if the guide seems to imply it.
- Don't refactor working code "while you're in there." If something unrelated looks messy, note it in `docs/PROJECT_STATE.md` as a future candidate — don't fix it now.
- Always explain *why*, not just *what*, when proposing or making a change — a one-line rationale per change, minimum.
- Keep commits/changes atomic and tied to one guide step each, so the changelog and the commit history tell the same story.
- Treat every checklist item as binary — done (tested, verified, documented) or not done. No "mostly done" state gets checked off.
- When working across multiple files for one step, finish and verify the **full** step before starting the next one — don't leave a step half-applied across the codebase.
- Before starting any session, read `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATE.md`, and the current version's section of the guide to reconstruct full context. Do not assume memory of prior sessions.
- Never assume an undocumented fact about the codebase. If something isn't in the docs and isn't verifiable by reading the code directly, go read the code — don't guess from training data or general assumptions about "how these projects usually work."

---

## 3. Current State
*(Update this every session — this is the single most important section in this file. Whoever is ending a session: fill this in accurately before you stop. Whoever is starting a session: trust this section over your own assumptions, but verify against the code if something looks off.)*

**Last updated by:** Cursor on 2026-06-30

**Current version in progress:** v1.2 — Architecture Hardening (v1.1 fully complete)

**Current step in progress:** Step 1 — Introduce database migrations

**Status of current step:** Not started

**What was just completed (last session):**
- v1.1 Steps 1–7 complete in `apps/` monorepo:
  - Monorepo layout, dead code removed from `apps/backend`, package names renamed
  - PatientDashboard split (~95 lines) with hooks + 6 section components
  - Canned RAG responses centralized in `apps/rag-service/canned_responses.json`
  - `errorHandler.js` + `AppError` wired; all controllers refactored to `(req, res, next)`
  - README rewritten; `docs/ARCHITECTURE.md` added

**What is in progress / half-done (if anything):**
- Legacy duplicate folders at repo root (`backend/`, `src/`) should be deleted manually

**Open questions / blockers waiting on the user:**
- Confirm deletion of root `backend/` and `src/` after verifying `apps/` runs locally

**Any unresolved deviations from the guide:**
- None

**Known broken / failing things right now (if any):**
- Root-level duplicate code may confuse editors — canonical code is under `apps/`

**Next concrete action to take:**
- Open `MEDIVAULT_DETAILED_VERSION_GUIDE.md` v1.2 Step 1: create `apps/backend/migrations/` and first schema migration files.

> Rules for this section: Don't leave it vague. "Working on backend stuff" is not acceptable. "v1.2 Step 6: validation added to `/auth/register` and `/appointments/book`; remaining routes still need it — see list in `docs/PROJECT_STATE.md`" is acceptable. If you're switching tools mid-step, say so explicitly and note exactly where it was left off — don't round up to "mostly done." Don't delete the previous session's filled-in content without first folding a dated summary into `docs/CHANGELOG.md`, so history isn't lost.

---

## 4. Environment & Setup Recap
*(So a new IDE doesn't have to rediscover this. Keep accurate — update whenever setup steps change, e.g. after Docker lands in v2.0.)*

- **Stack:** React 19 + Vite + Tailwind / Express 5 + Node / MySQL 8 / Web3.js + Sepolia / Python 3.9+ subprocess → Groq
- **Repo layout:** Single-root layout (`backend/`, `src/`) — target monorepo under `apps/` arrives in v1.1
- **How to run locally:** `npm install` at repo root; create `backend/.env` with DB and secret vars; run backend with `node backend/server.js`; run frontend with `npm run dev`
- **How to run tests:** Not yet — v1.3 adds test suite
- **Where secrets live:** `.env` locally via `backend/config/env.js` abstraction; AWS Secrets Manager in deployed environments from v2.0 onward
- **Known environment quirks:** Python subprocess path differs on Windows vs Linux; no `.env` committed to git

---

## 5. Switching IDEs / Tools

- This file is the mandatory handoff document and must be updated at the end of every session, regardless of whether a tool switch is actually happening.
- A new IDE/agent picking up the project must read this file first — before `MEDIVAULT_DETAILED_VERSION_GUIDE.md`, before any other doc, before any code. It's the map to everything else.
- Treat an out-of-date or vague Section 3 as a rule violation equivalent to an undocumented change — it actively misleads the next session, which is worse than no file at all.
- If you are switching tools mid-step, be explicit that the step is incomplete and exactly where it was left off.

---

## 6. Other Documents and What They Mean

Read these as needed — Section 3 above tells you where things stand; these give you depth and history when you need it.

| Order | File | What It Is | When To Read It |
|---|---|---|---|
| 1 | `MEDIVAULT_DETAILED_VERSION_GUIDE.md` | The master build plan. Defines every version (v1.0–v3.0), every step inside each version, and the Definition of Done for each. Source of truth for **what to build**. | Always — find the current version/step here and follow it exactly. |
| 2 | `docs/PROJECT_STATE.md` | A short, frequently-updated status snapshot, maintained turn-by-turn during a single session (more granular than Section 3 above, which is the end-of-session summary). | At the start of a session, to cross-check against Section 3. |
| 3 | `docs/CHANGELOG.md` | Append-only log of every change ever made: what changed, why, how it was tested, and any deviation from the guide. | When you need history — "why does this code look like this," "what was already tried," "was this already fixed before." |
| 4 | `docs/DECISIONS.md` | One-time architectural decisions only (e.g. which blockchain chain was chosen in v2.1, which async job model was chosen in v1.2). | Before making any architecture-level choice, to check if it was already decided. |
| 5 | `docs/ARCHITECTURE.md` | Describes the current real architecture of the system (stack, data flow, service boundaries). Updated as the system evolves, especially after v2.2. | When you need to understand how the system fits together before changing it. |
| 6 | `docs/BLOCKCHAIN.md` | Created in v2.1. Documents the deployed smart contract address, ABI, chosen chain, and the hash-anchoring design. | Any time blockchain-related code is touched. |
| 7 | `docs/DESIGN_SYSTEM.md` | Created in v3.0. Documents color tokens, spacing scale, and shared component usage conventions. | Any time frontend UI work is touched, from v3.0 onward. |
| 8 | `README.md` | High-level project description and local dev setup instructions (clone → env → migrate → seed → run). | First-time setup of the project on a new machine/environment. |

If any of these files are missing, that itself is a signal something was skipped — flag it to the user rather than silently proceeding without it.

---

## 7. File Structure This Handbook Requires

```
PROJECT_HANDBOOK.md     # root-level — read first, every session, by every IDE/agent
docs/
├── CHANGELOG.md        # every change, every session, append-only
├── DECISIONS.md        # one-time architectural decisions
├── PROJECT_STATE.md    # turn-by-turn status snapshot, updated within a session
├── ARCHITECTURE.md     # current system architecture, updated as it evolves
├── BLOCKCHAIN.md        # (created in v2.1, per the main guide)
└── DESIGN_SYSTEM.md     # (created in v3.0, per the main guide)
```

If `docs/CHANGELOG.md`, `docs/DECISIONS.md`, or `docs/PROJECT_STATE.md` do not exist yet, create them as the very first action before any other work begins.

---

## 8. Rules for Updating This File

- Update Section 3 ("Current State") every single session, even if very little changed. A stale Section 3 is worse than no file at all — it actively misleads the next session.
- Never leave Section 3 vague — see the example in Section 3 itself for what "specific enough" looks like.
- Do not delete old Section 3 content without first folding the prior session's filled-in version into `docs/CHANGELOG.md` as a dated entry, so history isn't lost.
- If you are switching tools mid-step, be explicit that the step is incomplete and exactly where it was left off — don't round up to "mostly done."
- This file is the first thing any new IDE/agent must read and the last thing any session must write. Treat it as the handoff baton.
