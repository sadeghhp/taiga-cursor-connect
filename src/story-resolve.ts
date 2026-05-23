import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import type { StoryRefInput, TaigaUserStory } from "./types.js";

export async function getStoryById(storyId: number): Promise<TaigaUserStory> {
  try {
    const res = await getClient().get<TaigaUserStory>(`/userstories/${storyId}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getStoryByRefSlug(
  projectSlug: string,
  storyRef: number
): Promise<TaigaUserStory> {
  try {
    const res = await getClient().get<TaigaUserStory>("/userstories/by_ref", {
      params: { ref: storyRef, project__slug: projectSlug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, storyRef });
  }
}

export async function resolveStoryRef(
  input: StoryRefInput & { projectSlug: string }
): Promise<TaigaUserStory> {
  if (input.storyId != null) return getStoryById(input.storyId);
  if (input.storyRef != null) {
    return getStoryByRefSlug(input.projectSlug, input.storyRef);
  }
  throw new TaigaError("Provide storyId or storyRef with projectSlug.");
}

/** Ensure a user story belongs to the given project (by internal id). */
export async function assertStoryInProject(
  story: TaigaUserStory,
  projectId: number,
  projectSlug: string
): Promise<void> {
  const pid = story.project ?? (await getStoryById(story.id)).project;
  if (pid !== projectId) {
    throw new TaigaError(
      `User story #${story.ref} (id ${story.id}) does not belong to project ${projectSlug}.`
    );
  }
}
