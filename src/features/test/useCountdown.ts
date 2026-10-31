import { useEffect, useState } from 'react';

/**
 * Seconds left until `endsAt` on the server's clock. `serverNow` corrects for a client clock
 * that runs fast or slow. Returns null until the first tick.
 */
export function useCountdown(endsAt: string | null, serverNow: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const offset = serverNow ? Date.parse(serverNow) - Date.now() : 0;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((Date.parse(endsAt) - (Date.now() + offset)) / 1000)));
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 250);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [endsAt, serverNow]);

  return endsAt ? remaining : null;
}

export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
