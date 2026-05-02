import { getToken } from "../config/auth";
import { Log } from "../config/logger";
import { solve, Vehicle, ScheduleResult } from "./knapsack";

const BASE = "http://20.207.122.201/evaluation-service";

interface Depot {
  ID: number;
  MechanicHours: number;
}

export async function runScheduler(): Promise<ScheduleResult[]> {
  await Log("backend", "info", "service", "fetching depots and vehicles from test server");

  const token = await getToken();

  const [depotsRes, vehiclesRes] = await Promise.all([
    fetch(`${BASE}/depots`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE}/vehicles`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  if (!depotsRes.ok || !vehiclesRes.ok) {
    await Log("backend", "error", "service", "failed to fetch depots or vehicles");
    throw new Error("failed to fetch data from test server");
  }

  const { depots } = (await depotsRes.json()) as { depots: Depot[] };
  const { vehicles } = (await vehiclesRes.json()) as { vehicles: Vehicle[] };

  await Log("backend", "info", "service", `fetched ${depots.length} depots and ${vehicles.length} vehicles`);

  const results: ScheduleResult[] = depots.map((depot) =>
    solve(depot.ID, depot.MechanicHours, vehicles)
  );

  await Log("backend", "info", "service", "knapsack scheduling completed for all depots");

  return results;
}
