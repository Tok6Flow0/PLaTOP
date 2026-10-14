const ANIMATION_INTERVAL = 1000 / 30;
const INPUT_INTERVAL = 1000 / 60;
// A modest recovery margin tolerates browser clock jitter while rejecting a
// single-refresh catch-up draw (and three-refresh draws on 119.88 Hz panels).
const RECOVERY_INTERVAL = ANIMATION_INTERVAL * 0.8;
// Browser timestamps can land a fraction before the nominal display deadline.
const CLOCK_TOLERANCE = 0.5;
// Input follows a deadline grid instead of restarting a full interval at
// each slightly late callback. A separate margin absorbs timestamp jitter;
// the recovery guard still forbids rapid catch-up draws.
const INPUT_CLOCK_TOLERANCE = 2;
const INPUT_RECOVERY_INTERVAL = INPUT_INTERVAL * 0.8;

/** Display-synced cinematic cadence. Late frames are skipped, never replayed. */
export class FramePacer {
  private deadline: number | undefined;
  private lastFrame: number | undefined;
  private inputDeadline: number | undefined;
  private invalidated = false;

  invalidate(): void { this.invalidated = true; }

  needsFrame(continuous: boolean): boolean { return continuous || this.invalidated; }

  reset(): void {
    this.deadline = undefined;
    this.lastFrame = undefined;
    this.inputDeadline = undefined;
    this.invalidated = false;
  }

  shouldRender(now: number, continuous: boolean): boolean {
    if (!Number.isFinite(now)) return false;
    if (!continuous) this.deadline = undefined;
    else if (this.deadline === undefined) this.deadline = now;
    if (this.inputDeadline !== undefined && now < this.inputDeadline - INPUT_CLOCK_TOLERANCE) return false;
    if (this.lastFrame !== undefined && now < this.lastFrame + INPUT_RECOVERY_INTERVAL - CLOCK_TOLERANCE) return false;
    const animationDue = continuous && this.deadline !== undefined && now >= this.deadline - CLOCK_TOLERANCE
      && (this.lastFrame === undefined || now >= this.lastFrame + RECOVERY_INTERVAL - CLOCK_TOLERANCE);
    if (!this.invalidated && !animationDue) return false;
    if (animationDue) {
      // Keep the original cadence when one refresh is late, without scheduling
      // a burst to make up for missed frames after a slow draw or a busy tab.
      const elapsed = Math.max(0, now - this.deadline! + CLOCK_TOLERANCE);
      this.deadline! += (Math.floor(elapsed / ANIMATION_INTERVAL) + 1) * ANIMATION_INTERVAL;
    }
    if (this.inputDeadline === undefined || now > this.inputDeadline + INPUT_INTERVAL) {
      this.inputDeadline = now + INPUT_INTERVAL;
    } else {
      const elapsed = Math.max(0, now - this.inputDeadline + INPUT_CLOCK_TOLERANCE);
      this.inputDeadline += (Math.floor(elapsed / INPUT_INTERVAL) + 1) * INPUT_INTERVAL;
    }
    this.lastFrame = now;
    this.invalidated = false;
    return true;
  }
}
