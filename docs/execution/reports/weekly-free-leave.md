# Weekly free leave — 2026-10-27

- Free: one grant at Monday 06:00 Asia/Seoul; expires exactly the next Monday 06:00, with no rollover.
- Reward: existing six-goal-day qualification and earning-week start +21-day expiry unchanged.
- Automatic free grants start 2026-11-02. The 2026-10-26 week requires a separate explicit user instruction; no grant was issued.
- DB adds kind (free/reward, existing rows default to reward), user/week/kind uniqueness, and kind-specific expiry checks. Reservation, cancellation, attendance and earliest-expiry selection remain unchanged.
- Server cron runs Sunday 21:00 GMT. Reconciliation also recovers the current week's free grant. Internal grant function is unavailable to app roles.
- Migration applied remotely. Rollback SQL tests passed for first grant, duplicate calls, expiry boundaries, reward coexistence, invalid reservation and function permissions. Verified free=0, reward=2, reservations=2 after testing.
- App decoding and balance/rules display updated in source. Include these changes in the next app release before the first free grant: older apps reject free grants due to strict week/expiry validation.
- Lint, typecheck and all 139 unit tests passed.
