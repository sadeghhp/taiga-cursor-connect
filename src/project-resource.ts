import { getClient, TaigaError } from "./http/client.js";

/** Verify a Taiga entity's project field matches the expected project. */
export function assertEntityProject(
  entityProject: number | undefined,
  expectedProjectId: number,
  entityLabel: string,
  entityId: number,
  projectSlug: string
): void {
  if (entityProject !== expectedProjectId) {
    throw new TaigaError(
      `${entityLabel} ${entityId} does not belong to project ${projectSlug}.`
    );
  }
}
