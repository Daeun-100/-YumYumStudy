package expo.modules.studyguard;

/** Android-independent transition policy, tested on the host JVM. All times are monotonic milliseconds. */
public final class GuardSession {
  public final String ownPackage;
  public boolean running = false;
  public long accumulated = 0, startedAt = 0, stoppedAt = 0;
  public String foreground, authorized = null, reason = "검증을 시작해 주세요";
  private String pending = null;
  private long deadline = 0, unfocusedAt = -1;
  public GuardSession(String ownPackage) { this.ownPackage = ownPackage; this.foreground = ownPackage; }
  public long elapsed(long now) { return accumulated + (running ? Math.max(0, now - startedAt) : 0); }
  public void start(long now) {
    running = true; startedAt = now; stoppedAt = 0; foreground = ownPackage;
    authorized = null; pending = null; unfocusedAt = -1; reason = "스터디앱에서 측정 중";
  }
  public void pause(long now, String why) {
    if (!running) return;
    accumulated = elapsed(now); stoppedAt = now; running = false; authorized = null; pending = null;
    unfocusedAt = -1; reason = why;
  }
  public void reset(long now) { pause(now, "시간을 초기화했어요"); accumulated = 0; }
  public boolean launch(String pkg, long now) {
    if (!running || !ownPackage.equals(foreground)) return false;
    authorized = null; pending = pkg; deadline = now + 5000;
    reason = "허용앱 실행 확인 중"; return true;
  }
  public void resumed(String pkg, long now) {
    if (running && now < startedAt) return;
    foreground = pkg; unfocusedAt = -1;
    if (!running) return;
    if (ownPackage.equals(pkg)) {
      authorized = null; pending = null; reason = "스터디앱에서 측정 중"; return;
    }
    if (pkg.equals(pending) && now <= deadline) {
      authorized = pkg; pending = null; reason = "스터디앱에서 실행한 허용앱 사용 중"; return;
    }
    if (pkg.equals(authorized)) return;
    pause(now, "허용된 이동 경로를 벗어나 자동 일시정지: " + pkg);
  }
  public void activityPaused(String pkg, long now) {
    if (running && now >= startedAt && pkg.equals(foreground) && unfocusedAt < 0) unfocusedAt = now;
  }
  public void screenUnavailable() {
    // Locking the screen is not an app departure. Preserve any authorized app.
    unfocusedAt = -1; pending = null;
  }
  public void check(long now) {
    if (!running) return;
    if (pending != null && now > deadline) {
      pause(unfocusedAt >= 0 ? unfocusedAt : deadline, "허용앱 실행을 확인하지 못해 일시정지"); return;
    }
    if (pending == null && unfocusedAt >= 0 && now - unfocusedAt >= 2000)
      pause(unfocusedAt, "앱 이탈 또는 최근 앱 화면으로 이동하여 일시정지");
  }
}
