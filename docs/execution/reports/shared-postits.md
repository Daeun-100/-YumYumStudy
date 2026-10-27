# Shared room post-its

Implemented in the actual focus room. Storybook and app share `PostitBoard`.

- Migration `300_shared_postits.sql` applied to the linked Supabase project.
- Admitted users can create in their own room and delete any current-day note in that room. Direct table writes and reads are blocked; RPCs validate access.
- Server trigger emits the complete row through private Broadcast topic `postits:room:<id>`. Clients receive only their current room and cannot publish authoritative changes.
- Study day follows the existing Asia/Seoul 06:00 boundary. Older notes remain stored but are hidden. Deletion uses a tombstone.
- Normalized positions support different screen sizes; web mouse and native touch coordinates are both supported.
- Broadcast updates modify local state immediately. Reconnect/resume reloads authoritative data; active-screen 15s reconciliation covers missed events. Snapshot requests replay intervening events, and delete tombstones prevent a late create from restoring a deleted note.
- Create retries reuse a UUID. Server serializes per-author inserts and limits creation to 30 notes per study day, including deleted notes.

Verification:
- Typecheck, lint and focused model tests passed.
- Server transaction tests passed (today-only, invalid content/position rejection, room isolation, retry, friend deletion, no direct table access); fixtures rolled back.
- Three temporary authenticated clients tested private Broadcast create/delete and cross-room rejection. Observed one create delivery at 274ms including RPC round trip (not a latency guarantee). Temporary accounts/data removed.
- Actual local app: create, free placement, reload persistence, open, delete verified in test room. Verification note was removed afterward.
- Screenshot: `docs/images/postits-app-connected.png`.
- Physical Android/iOS devices were not exercised for this change.
