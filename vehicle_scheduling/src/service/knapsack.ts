export interface Vehicle {
  TaskID: string;
  Duration: number;
  Impact: number;
}

export interface ScheduleResult {
  depotID: number;
  mechanicHours: number;
  totalImpact: number;
  selectedTasks: string[];
}

export function solve(
  depotID: number,
  budget: number,
  vehicles: Vehicle[]
): ScheduleResult {
  const n = vehicles.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(budget + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= budget; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  const selected: string[] = [];
  let w = budget;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1].TaskID);
      w -= vehicles[i - 1].Duration;
    }
  }

  return {
    depotID,
    mechanicHours: budget,
    totalImpact: dp[n][budget],
    selectedTasks: selected,
  };
}
