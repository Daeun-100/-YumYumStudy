package expo.modules.studyguard;

/** Pure mapping shared by UI receipt and Android stop events. Never use send time
 * as stop time, or re-anchor at the execution time of a queued bridge call. */
public final class SessionClock {
  private SessionClock() {}
  public static long serverAt(long startedAt, long serverAnchor, long receivedAt, long eventAt) {
    return Math.max(startedAt, serverAnchor + (eventAt - receivedAt));
  }
}
