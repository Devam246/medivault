# MediVault — DECISIONS

One-time architectural decisions only. Each entry is immutable — if the decision changes, add a new entry superseding the old one.

---

## 2026-06-30 — AuthContext Strategy

**Decision:** Keep `AuthContext.jsx` and wire it into `main.jsx` as the single source of truth for auth state.

**Context:** `AuthContext.jsx` existed but was not wired into `main.jsx`. `RequireAuth.jsx` was reading directly from `localStorage` with different key names (`mv_token`, `mv_role`) than what `AuthContext.jsx` used (`accessToken`).

**Chosen path:** Keep `AuthContext`, standardize localStorage keys to `mv_token` / `mv_role` inside the context, wire `<AuthProvider>` into `main.jsx`, update `RequireAuth.jsx` to use `useAuth()` hook. This is the handbook-recommended path (v1.0 Step 9).

**Reason:** React-idiomatic, avoids prop drilling, and makes the auth surface area easy to extend when `PatientDashboard.jsx` is split in v1.1.

---

## 2026-06-30 — rejectDoctor DB Action

**Decision:** `rejectDoctor` will set `is_verified = -1` (soft-delete, rejected state), not hard delete or leave as `0`.

**Reason:** `is_verified = 0` is the pending state. Using `-1` for rejected allows the admin to distinguish between "pending review" and "explicitly rejected." Hard delete would lose the audit trail of who applied.

---
