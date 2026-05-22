import { getClient, wrapAxiosError } from "./http/client.js";
import type { PointSummary, TaigaPoint, TaigaRole } from "./types.js";

export async function listPointsForProject(projectId: number): Promise<PointSummary[]> {
  try {
    const res = await getClient().get<TaigaPoint[]>("/points", {
      params: { project: projectId }
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((p) => ({ id: p.id, name: p.name, value: p.value }));
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

async function getComputableRoleId(projectId: number): Promise<number | null> {
  try {
    const res = await getClient().get<TaigaRole[]>("/roles", {
      params: { project: projectId }
    });
    const roles = Array.isArray(res.data) ? res.data : [];
    const computable = roles.find((r) => r.computable);
    return computable?.id ?? roles[0]?.id ?? null;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

/** Map estimate hours to nearest Taiga point value for the default computable role. */
export async function resolvePointsFromEstimateHours(
  projectId: number,
  estimateHours: number
): Promise<Record<string, number> | undefined> {
  const roleId = await getComputableRoleId(projectId);
  if (roleId == null) return undefined;

  const points = await listPointsForProject(projectId);
  if (points.length === 0) return undefined;

  let best = points[0];
  let bestDiff = Math.abs((best.value ?? 0) - estimateHours);
  for (const p of points) {
    const v = p.value ?? 0;
    const diff = Math.abs(v - estimateHours);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return { [String(roleId)]: best.id };
}
