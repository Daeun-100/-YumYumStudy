// Browser monotonic time is independent of the user's calendar clock.
// Browser suspension behavior differs: obtain a fresh server anchor on resume.
export const refreshClockOnResume = true;
export const monotonicNow = () => performance.now();
