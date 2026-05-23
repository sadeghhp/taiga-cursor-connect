import axios from "axios";
import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import { getProjectBySlug } from "./project-context.js";
import { assertEntityProject } from "./project-resource.js";
import type {
  SwimlaneSummary,
  SwimlanesSupport,
  TaigaSwimlane
} from "./types.js";

const swimlaneSupportCache = new Map<number, SwimlanesSupport>();

/** @internal Clear probe cache (tests only). */
export function clearSwimlanesSupportCache(): void {
  swimlaneSupportCache.clear();
}

function trimSwimlane(s: TaigaSwimlane): SwimlaneSummary {
  return {
    id: s.id,
    name: s.name,
    order: s.order
  };
}

function isSwimlanesUnsupportedStatus(status: number | undefined): boolean {
  return status === 404 || status === 403 || status === 501;
}

async function fetchSwimlanesByProjectId(
  projectId: number
): Promise<TaigaSwimlane[]> {
  const res = await getClient().get<TaigaSwimlane[]>("/swimlanes", {
    params: { project: projectId }
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** Probe whether this Taiga instance exposes swimlane APIs (cached per project). */
export async function probeSwimlanesSupport(
  projectId: number
): Promise<SwimlanesSupport> {
  const cached = swimlaneSupportCache.get(projectId);
  if (cached != null) return cached;

  try {
    await fetchSwimlanesByProjectId(projectId);
    const result: SwimlanesSupport = { supported: true };
    swimlaneSupportCache.set(projectId, result);
    return result;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      if (isSwimlanesUnsupportedStatus(status)) {
        const result: SwimlanesSupport = {
          supported: false,
          message:
            "Swimlanes API not available on this Taiga instance (requires taiga-back with swimlanes)."
        };
        swimlaneSupportCache.set(projectId, result);
        return result;
      }
    }
    throw wrapAxiosError(e);
  }
}

async function getSwimlaneById(swimlaneId: number): Promise<TaigaSwimlane> {
  try {
    const res = await getClient().get<TaigaSwimlane>(`/swimlanes/${swimlaneId}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

async function assertSwimlaneInProject(
  swimlaneId: number,
  projectId: number,
  projectSlug: string
): Promise<TaigaSwimlane> {
  const swimlane = await getSwimlaneById(swimlaneId);
  assertEntityProject(
    swimlane.project,
    projectId,
    "Swimlane",
    swimlaneId,
    projectSlug
  );
  return swimlane;
}

export async function resolveSwimlaneId(
  projectId: number,
  swimlaneName: string,
  knownSupport?: SwimlanesSupport
): Promise<number> {
  const support = knownSupport ?? (await probeSwimlanesSupport(projectId));
  if (!support.supported) {
    throw new TaigaError(
      support.message ??
        "Swimlanes are not supported on this Taiga instance."
    );
  }
  try {
    const rows = await fetchSwimlanesByProjectId(projectId);
    const normalized = swimlaneName.trim().toLowerCase();
    const matches = rows.filter(
      (s) => s.name.trim().toLowerCase() === normalized
    );
    if (matches.length === 0) {
      throw new TaigaError(
        `No swimlane named "${swimlaneName}" in project ${projectId}.`
      );
    }
    if (matches.length > 1) {
      throw new TaigaError(
        `Ambiguous swimlane name "${swimlaneName}" (${matches.length} matches).`
      );
    }
    return matches[0].id;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function listSwimlanesForProject(
  projectId: number,
  support: SwimlanesSupport
): Promise<SwimlaneSummary[]> {
  if (!support.supported) {
    return [];
  }
  const rows = await fetchSwimlanesByProjectId(projectId);
  return rows.map(trimSwimlane).sort((a, b) => a.order - b.order);
}

export async function listSwimlanes(
  projectSlug: string
): Promise<{ supported: boolean; message?: string; swimlanes: SwimlaneSummary[] }> {
  const project = await getProjectBySlug(projectSlug);
  const support = await probeSwimlanesSupport(project.id);
  if (!support.supported) {
    return { supported: false, message: support.message, swimlanes: [] };
  }
  try {
    const swimlanes = await listSwimlanesForProject(project.id, support);
    return { supported: true, swimlanes };
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface CreateSwimlaneInput {
  name: string;
  order?: number;
}

export async function createSwimlane(
  projectSlug: string,
  input: CreateSwimlaneInput
): Promise<SwimlaneSummary> {
  const project = await getProjectBySlug(projectSlug);
  const support = await probeSwimlanesSupport(project.id);
  if (!support.supported) {
    throw new TaigaError(
      support.message ??
        "Swimlanes are not supported on this Taiga instance."
    );
  }
  const body: Record<string, unknown> = {
    name: input.name,
    project: project.id
  };
  if (input.order != null) body.order = input.order;
  try {
    const res = await getClient().post<TaigaSwimlane>("/swimlanes", body);
    return trimSwimlane(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface UpdateSwimlaneInput {
  name?: string;
  order?: number;
}

export async function updateSwimlane(
  projectSlug: string,
  swimlaneId: number,
  input: UpdateSwimlaneInput
): Promise<SwimlaneSummary> {
  const project = await getProjectBySlug(projectSlug);
  const support = await probeSwimlanesSupport(project.id);
  if (!support.supported) {
    throw new TaigaError(
      support.message ??
        "Swimlanes are not supported on this Taiga instance."
    );
  }
  await assertSwimlaneInProject(swimlaneId, project.id, projectSlug);
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name;
  if (input.order != null) body.order = input.order;
  if (Object.keys(body).length === 0) {
    throw new TaigaError("Provide at least one field to update (name, order).");
  }
  try {
    const res = await getClient().patch<TaigaSwimlane>(
      `/swimlanes/${swimlaneId}`,
      body
    );
    return trimSwimlane(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function deleteSwimlane(
  projectSlug: string,
  swimlaneId: number,
  moveToSwimlaneId?: number
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  const support = await probeSwimlanesSupport(project.id);
  if (!support.supported) {
    throw new TaigaError(
      support.message ??
        "Swimlanes are not supported on this Taiga instance."
    );
  }
  await assertSwimlaneInProject(swimlaneId, project.id, projectSlug);
  if (moveToSwimlaneId != null) {
    await assertSwimlaneInProject(moveToSwimlaneId, project.id, projectSlug);
  }
  try {
    const params =
      moveToSwimlaneId != null ? { moveTo: moveToSwimlaneId } : undefined;
    await getClient().delete(`/swimlanes/${swimlaneId}`, { params });
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

/** Apply swimlane id or name to a PATCH/create body; throws if unsupported. */
export async function applySwimlaneToBody(
  body: Record<string, unknown>,
  projectId: number,
  swimlaneId?: number,
  swimlaneName?: string
): Promise<void> {
  if (swimlaneId == null && swimlaneName == null) return;
  const support = await probeSwimlanesSupport(projectId);
  if (!support.supported) {
    throw new TaigaError(
      support.message ??
        "Swimlanes are not supported on this Taiga instance."
    );
  }
  if (swimlaneId != null) {
    body.swimlane = swimlaneId;
    return;
  }
  if (swimlaneName != null) {
    body.swimlane = await resolveSwimlaneId(
      projectId,
      swimlaneName,
      support
    );
  }
}
