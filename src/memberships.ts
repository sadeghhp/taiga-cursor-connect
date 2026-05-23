import { getClient, wrapAxiosError } from "./http/client.js";
import { getProjectBySlug } from "./project-context.js";
import { resolveRoleId } from "./metadata.js";
import type { MembershipSummary } from "./types.js";

export interface InviteMemberInput {
  username: string;
  roleId?: number;
  roleName?: string;
}

export async function inviteMember(
  projectSlug: string,
  input: InviteMemberInput
): Promise<MembershipSummary> {
  const project = await getProjectBySlug(projectSlug);
  let roleId = input.roleId;
  if (roleId == null && input.roleName != null) {
    roleId = await resolveRoleId(project.id, input.roleName);
  }
  if (roleId == null) {
    throw wrapAxiosError(new Error("Provide roleId or roleName."), { projectSlug });
  }
  try {
    const res = await getClient().post<{
      id: number;
      user: number;
      role: number;
      role_name?: string;
      user_email?: string;
      user_full_name?: string;
    }>("/memberships", {
      project: project.id,
      role: roleId,
      username: input.username
    });
    const m = res.data;
    return {
      id: m.id,
      user_id: m.user,
      role_id: m.role,
      role_name: m.role_name ?? null,
      email: m.user_email ?? null,
      full_name: m.user_full_name ?? null
    };
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}
