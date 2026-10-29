type Options = {
  now(): number;
  setTimer(run: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
  onCollect(): void;
  onExpire(): void;
  goalMs?: number;
  rewardMs?: number;
  holdMs?: number;
  extraWaitMs?: number;
  autoDismiss?: boolean;
};

/** One notice owns one bounded lifetime. Late replies never revive an expired notice. */
export function createRewardTiming(options: Options) {
  const { now, setTimer, clearTimer, onCollect, onExpire, goalMs = 4000, rewardMs = 2000, holdMs = 800, extraWaitMs = 2000, autoDismiss = true } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stampedAt: number | undefined;
  let reward = false, pending = false, collecting = false, closed = false;
  const clear = () => { if (timer !== undefined) clearTimer(timer); timer = undefined; };
  const deadline = () => stampedAt! + goalMs + (pending ? extraWaitMs : 0);
  const expire = () => { if (closed) return; closed = true; clear(); onExpire(); };
  const evaluate = () => {
    clear();
    if (closed || collecting || stampedAt === undefined) return;
    const time = now();
    if (autoDismiss && !reward && time >= deadline()) { expire(); return; }
    if (reward) {
      const delay = Math.max(0, stampedAt + holdMs - time);
      if (delay) timer = setTimer(evaluate, delay);
      else { collecting = true; onCollect(); }
    } else if (autoDismiss) timer = setTimer(evaluate, Math.max(0, deadline() - time));
  };
  return {
    update(confirmedReward: boolean, waitingForReward: boolean) {
      if (closed || collecting) return;
      // Check the previous deadline before accepting new flags from a delayed response.
      if (autoDismiss && stampedAt !== undefined && now() >= deadline()) { expire(); return; }
      reward = confirmedReward; pending = waitingForReward; evaluate();
    },
    stamped() { if (stampedAt === undefined && !closed) { stampedAt = now(); evaluate(); } },
    rewardFinished() { if (!closed && collecting && autoDismiss) { clear(); timer = setTimer(expire, rewardMs); } },
    dispose() { closed = true; clear(); },
  };
}
