import expo.modules.studyguard.GuardSession;

public class GuardSessionTest {
  private static void check(boolean result, String message) { if (!result) throw new AssertionError(message); }
  public static void main(String[] args) {
    GuardSession s = new GuardSession("study");
    s.start(1000);
    check(s.launch("allowedA", 1100), "launch must be granted inside study");
    s.activityPaused("study", 1150);
    s.resumed("allowedA", 1200);
    check(s.running && "allowedA".equals(s.authorized), "explicit launch continues");
    s.resumed("allowedA", 1300);
    check(s.running, "same app internal activity continues");
    s.resumed("allowedB", 1400);
    check(!s.running && s.elapsed(9000) == 400, "allowed A to B must freeze at event time");
    s.resumed("study", 1500);
    check(!s.running, "return must not auto-resume");
    s.start(2000);
    s.resumed("allowedA", 2200);
    check(!s.running, "direct allowed launch without a grant pauses");
    check(!s.launch("allowedA", 2300), "launch while paused is rejected");
    s.resumed("study", 2400); s.start(3000);
    s.launch("allowedA", 3100); s.resumed("allowedA", 3200); s.resumed("study", 3300);
    check(s.running && s.authorized == null, "return to study revokes previous grant");
    s.resumed("allowedA", 3400);
    check(!s.running, "reentering same allowed app from outside is not grandfathered");
    s.start(4000); s.launch("allowedA", 4100); s.resumed("allowedA", 4200);
    s.resumed("study", 4300); s.launch("allowedB", 4400); s.resumed("allowedB", 4500);
    check(s.running && "allowedB".equals(s.authorized), "A to study to B is allowed");
    check(!s.launch("allowedA", 4550), "cannot issue a grant from an external app");
    s.resumed("launcher", 4600);
    check(!s.running, "home must pause");
    s.start(5000); s.launch("allowedA", 5100); s.activityPaused("study", 5150); s.check(11000);
    check(!s.running, "failed launch must time out");
    s.reset(12000); check(s.elapsed(15000) == 0 && !s.running, "reset stays paused");
    s.start(16000); s.activityPaused("study", 16100); s.check(17200);
    check(s.running, "departure shorter than two seconds continues");
    s.check(18099);
    check(s.running, "departure remains running just before two seconds");
    s.check(18100);
    check(!s.running && s.elapsed(18000) == 100, "missing next activity pauses at departure");
    s.reset(19000); s.start(19000); s.activityPaused("study", 19100); s.screenUnavailable(); s.check(60000);
    check(s.running && s.elapsed(60000) == 41000, "screen off keeps counting and clears departure timeout");
    s.start(19000); s.launch("allowedA", 19100); s.resumed("allowedA", 19200);
    s.activityPaused("allowedA", 19300); s.screenUnavailable(); s.check(60000);
    s.resumed("allowedA", 60100);
    check(s.running && "allowedA".equals(s.authorized), "unlock preserves the authorized app");
    s.start(20000); s.activityPaused("study", 20100); s.resumed("study", 20200); s.check(22000);
    check(s.running, "same app activity transition does not pause");
    s.resumed("oldExternal", 19000);
    check(s.running, "late usage events from before manual resume are ignored");
    s.pause(23000, "locked");
    s.pause(25000, "retry");
    check(s.stoppedAt == 23000, "retry must preserve the original departure timestamp");
    check(!s.running && s.authorized == null, "lock invalidates grant");
    System.out.println("GuardSession transition scenarios passed");
  }
}
