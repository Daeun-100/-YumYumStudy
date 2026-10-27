# Android allowed apps connected to study sessions

The original standalone probe has been replaced with actual study-session integration. Web sessions continue accruing when hidden; only Android loads the native guard. Native methods and the settings entry are no longer limited to test package IDs.

## Entry points

- Home: upper-right **허용앱** button beside the study-time heading.
- Focus: **허용앱** replaces the previous member-count button in the upper-right header.
- Both open the shared `Dialog` + `Card` modal, with an X close button. Empty lists link to settings; populated lists use selection followed by an explicit launch button.
- My page: **나의 공부 → 허용앱 설정**. Web shows an Android-only label and information rather than native permissions.
- Settings guide: optional sideload restricted-settings acknowledgement, actual Usage Access check, then actual notification check. Acknowledging the guide never substitutes for a permission grant.

## Actual timer flow

`StudyProvider` prepares monitoring only on an explicit Android start, then binds the server-acknowledged session ID, authenticated owner and room. Opening a registered app from the launcher creates a short-lived grant for that package. Another package, lock, permission loss or observation gap pauses locally. Returning does not resume. The settings screen displays and controls the same server study timer.

`StudyLink` persists the session binding and an earliest departure outbox before sending the stop. The departure timestamp uses the server-time anchor plus Android monotonic elapsed time. Credentials remain in memory and are not written to preferences or logs. The native service sends the owner's authenticated RPC while JS is suspended; expired credentials or offline requests are retried and reconciled on return. New starts are blocked until an outstanding stop is acknowledged. Old-session acknowledgements must not cancel a new session preparation.

`stop_study_on_exit` (migration 290) was added to the linked database after rollback-only tests. It checks owner, admission and room, clamps stop time to session start/server now, and never increases an existing end time. Existing functions and user records were not rewritten. The RPC and history entry were applied explicitly; unrelated migrations were not pushed.

The foreground UI also applies a persisted departure to the last snapshot before waiting for the network, subtracting any time already present after departure. Native state changes trigger reconciliation without polling the database every second. A process restart never automatically re-arms a discovered session.

## Verification and limits

- Host tests execute the exact Java transition engine and cover explicit/direct launches, A→B rejection, A→study→B allowance, no auto-resume, timeout, same-package activities and original departure preservation.
- Presentation tests cover late snapshots, old-session acknowledgements and the 06:00 boundary. The full suite passed (87 tests at integration time).
- SQL rollback tests cover end-time accuracy, retry idempotency, earliest-stop semantics, cross-user/room rejection, finite timestamps and nonnegative/nonfuture durations. Temporary fixtures were fully rolled back.
- A local two-worker, nonparallel Android build compiled the native integration and produced a signed test APK. Subsequent modal/My-page UI edits and the final old-acknowledgement preparation guard require a fresh APK build; do not treat the existing APK as all current working files.
- Local web UI entry points and common-modal panel were visually checked. This does not verify Android app switching on a phone.

Usage events are polling-based observations, not a guarantee of exact launch provenance. Very short recents transitions, system UI, split screen/PiP and OEM power management require phone tests. While offline or forcibly stopped, peers may still see a server session until the stored departure synchronizes. If a process dies before a newly started server session has been bound, its orphan is stopped conservatively when rediscovered; continuous server-side lease enforcement is not implemented.
