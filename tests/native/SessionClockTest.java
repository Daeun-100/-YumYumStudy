import expo.modules.studyguard.SessionClock;
public class SessionClockTest {
  private static void equal(long a,long b) { if(a!=b) throw new AssertionError(a+" != "+b); }
  public static void main(String[] args) {
    // A bridge call queued 26 seconds later retains its receive-time pair.
    equal(SessionClock.serverAt(100000,101000,500,26500),127000);
    // Native pause before response receipt is clamped only to the session start.
    equal(SessionClock.serverAt(100000,101000,500,100),100600);
    equal(SessionClock.serverAt(100000,101000,500,-5000),100000);
    // Re-sending hours later never changes the event's saved endpoint.
    long event=26500;
    equal(SessionClock.serverAt(100000,101000,500,event),127000);
    System.out.println("SessionClock receipt/queue/stop mapping passed");
  }
}
