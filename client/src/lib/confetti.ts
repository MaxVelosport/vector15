import confetti from "canvas-confetti";

const PALETTE = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];

export function fireConfetti(intensity: "small" | "medium" | "big" = "medium") {
  const config = {
    small:  { particleCount: 50,  spread: 60, startVelocity: 30 },
    medium: { particleCount: 100, spread: 70, startVelocity: 35 },
    big:    { particleCount: 200, spread: 90, startVelocity: 45 },
  }[intensity];

  confetti({ ...config, origin: { y: 0.7 }, colors: PALETTE, disableForReducedMotion: true });
}

export function fireCelebration() {
  const end = Date.now() + 2500;
  (function frame() {
    confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors: PALETTE, disableForReducedMotion: true });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: PALETTE, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function fireFirstTimeAction(key: string, intensity: "small" | "medium" | "big" = "medium"): boolean {
  if (typeof window === "undefined") return false;
  const flagKey = `first-${key}`;
  if (localStorage.getItem(flagKey)) return false;
  localStorage.setItem(flagKey, "1");
  fireConfetti(intensity);
  return true;
}
