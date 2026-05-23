import { getClient, wrapAxiosError } from "./http/client.js";
import type { TaigaProject } from "./types.js";

/** Resolve project by URL slug; shared by domain modules (no taiga-client import). */
export async function getProjectBySlug(slug: string): Promise<TaigaProject> {
  try {
    const res = await getClient().get<TaigaProject>("/projects/by_slug", {
      params: { slug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug: slug });
  }
}
