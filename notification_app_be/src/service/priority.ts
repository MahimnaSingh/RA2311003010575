export interface Notification {
  ID: string;
  Type: "Placement" | "Result" | "Event";
  Message: string;
  Timestamp: string;
}

export interface ScoredNotification extends Notification {
  weight: number;
  recencyScore: number;
  priority: number;
}

const WEIGHTS: Record<string, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

export function getTopN(notifications: Notification[], n: number): ScoredNotification[] {
  if (notifications.length === 0) return [];

  const timestamps = notifications.map((n) => new Date(n.Timestamp).getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const range = maxTs - minTs || 1;

  const scored: ScoredNotification[] = notifications.map((notif) => {
    const weight = WEIGHTS[notif.Type] ?? 1;
    const ts = new Date(notif.Timestamp).getTime();
    const recencyScore = (ts - minTs) / range;
    return {
      ...notif,
      weight,
      recencyScore,
      priority: weight + recencyScore,
    };
  });

  scored.sort((a, b) => b.priority - a.priority);

  return scored.slice(0, n);
}
