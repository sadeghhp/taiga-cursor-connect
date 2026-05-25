import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatTaigaError } from "./errors.js";
import { ensureAuthReady, getAuthMode, getLoggedInUsername } from "./http/auth.js";
import { getApiBaseUrl } from "./http/client.js";
import {
  getRegisteredToolCount,
  installToolLogging,
  logAuthReady,
  logConfigError,
  logReady
} from "./mcp-log.js";
import { PACKAGE_VERSION } from "./version.js";
import { bulkSyncTasksCsv } from "./plan-sync.js";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment
} from "./attachments.js";
import {
  listCustomAttributes,
  getCustomAttributeValues,
  setCustomAttributeValues
} from "./custom-attributes.js";
import { inviteMember } from "./memberships.js";
import {
  getMilestone,
  getMilestoneById,
  listIssueTypes,
  listPriorities,
  listRoles,
  listSeverities
} from "./metadata.js";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjectTemplates,
  updateProject
} from "./projects.js";
import {
  createProjectTag,
  deleteProjectTag,
  editProjectTag,
  getProjectIssueStats,
  getProjectStats,
  listProjectTags
} from "./tags.js";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  testWebhook,
  updateWebhook
} from "./webhooks.js";
import {
  createWikiPage,
  deleteWikiPage,
  getWikiPage,
  listWikiPages,
  updateWikiPage
} from "./wiki.js";
import {
  addEpicComment,
  addIssueComment,
  addStoryComment,
  addTaskComment,
  archiveEpic,
  archiveIssue,
  archiveStory,
  archiveTask,
  createEpic,
  createIssue,
  createMilestone,
  createTask,
  createUserStory,
  deleteEpic,
  deleteIssue,
  deleteTask,
  deleteUserStory,
  fetchStoryBundle,
  getProjectDetail,
  getIssueHistory,
  getStoryHistory,
  getTaskHistory,
  linkStoryToEpic,
  listEpics,
  listIssues,
  listMembers,
  listMilestones,
  listPoints,
  listProjects,
  listStatuses,
  listTasks,
  listUserStories,
  resolveEpic,
  resolveIssue,
  resolveStory,
  resolveTask,
  searchProject,
  trimEpicDetail,
  trimHistory,
  trimIssueDetail,
  trimTaskDetail,
  unlinkStoryFromEpic,
  updateEpic,
  updateIssue,
  updateMilestone,
  updateStory,
  updateStoryBacklogOrder,
  updateStorySprintOrder,
  updateTask,
  getKanbanBoard,
  updateStoryKanbanOrder,
  moveStoryOnKanban,
  listUserStoryStatuses,
  createUserStoryStatus,
  updateUserStoryStatus,
  deleteUserStoryStatus,
  reorderUserStoryStatuses,
  listSwimlanes,
  createSwimlane,
  updateSwimlane,
  deleteSwimlane,
  type CreateOptionalFields,
  type EpicUpdateFields,
  type IssueUpdateFields,
  type StatusEntityType,
  type StoryUpdateFields,
  type TaskUpdateFields
} from "./taiga-client.js";
import {
  assertEpicRefValid,
  assertEpicUpdateValid,
  assertAttachmentRefValid,
  assertCustomAttributeRefValid,
  assertIssueRefValid,
  assertIssueUpdateValid,
  assertMilestoneRefValid,
  assertStoryRefValid,
  assertStoryUpdateValid,
  assertTaskRefValid,
  assertTaskUpdateValid,
  buildListQuery,
  createOptionalFieldsShape,
  createStoryFieldsShape,
  epicRefFields,
  epicUpdateFieldsShape,
  issueRefFields,
  issueUpdateFieldsShape,
  listFilterFields,
  milestoneRefFields,
  parseTagsParam,
  storyRefFields,
  storyUpdateFieldsShape,
  taskRefFields,
  taskUpdateFieldsShape
} from "./schemas.js";

const milestoneSlugMapSchema = z.record(z.string());
const storyOrderEntrySchema = z.object({
  storyRef: z.number().optional(),
  storyId: z.number().optional(),
  order: z.number()
});
const storyOrdersSchema = z.array(storyOrderEntrySchema);
const statusOrderEntrySchema = z.object({
  statusId: z.number(),
  order: z.number()
});
const statusOrdersSchema = z.array(statusOrderEntrySchema);

function parseJsonParam<T>(raw: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(raw));
}

function toolError(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }]
  };
}

function toolText(text: string) {
  return {
    content: [{ type: "text" as const, text }]
  };
}

function jsonResult(data: unknown) {
  return toolText(JSON.stringify(data, null, 2));
}

function pickCommonUpdate(args: {
  statusName?: string;
  statusId?: number;
  isClosed?: boolean;
  subject?: string;
  description?: string;
  assignedToId?: number;
  unassign?: boolean;
  tags?: string;
  isBlocked?: boolean;
  blockedNote?: string;
  milestoneSlug?: string;
  milestoneId?: number;
  epicId?: number;
  unlinkEpic?: boolean;
  dueDate?: string;
  estimateHours?: number;
  swimlaneId?: number;
  swimlaneName?: string;
  userStoryId?: number;
  typeName?: string;
  typeId?: number;
  priorityName?: string;
  priorityId?: number;
  severityName?: string;
  severityId?: number;
}): StoryUpdateFields & TaskUpdateFields & IssueUpdateFields & EpicUpdateFields {
  return {
    statusName: args.statusName,
    statusId: args.statusId,
    isClosed: args.isClosed,
    subject: args.subject,
    description: args.description,
    assignedToId: args.assignedToId,
    unassign: args.unassign,
    tags: parseTagsParam(args.tags),
    isBlocked: args.isBlocked,
    blockedNote: args.blockedNote,
    milestoneSlug: args.milestoneSlug,
    milestoneId: args.milestoneId,
    epicId: args.epicId,
    unlinkEpic: args.unlinkEpic,
    dueDate: args.dueDate,
    estimateHours: args.estimateHours,
    swimlaneId: args.swimlaneId,
    swimlaneName: args.swimlaneName,
    userStoryId: args.userStoryId,
    typeName: args.typeName,
    typeId: args.typeId,
    priorityName: args.priorityName,
    priorityId: args.priorityId,
    severityName: args.severityName,
    severityId: args.severityId
  };
}

function pickCreateOptions(args: {
  statusName?: string;
  statusId?: number;
  assignedToId?: number;
  milestoneSlug?: string;
  milestoneId?: number;
  tags?: string;
  dueDate?: string;
  estimateHours?: number;
  swimlaneId?: number;
  swimlaneName?: string;
  typeName?: string;
  typeId?: number;
  priorityName?: string;
  priorityId?: number;
  severityName?: string;
  severityId?: number;
}): CreateOptionalFields | undefined {
  const opts: CreateOptionalFields = {
    statusName: args.statusName,
    statusId: args.statusId,
    assignedToId: args.assignedToId,
    milestoneSlug: args.milestoneSlug,
    milestoneId: args.milestoneId,
    tags: parseTagsParam(args.tags),
    dueDate: args.dueDate,
    estimateHours: args.estimateHours,
    swimlaneId: args.swimlaneId,
    swimlaneName: args.swimlaneName,
    typeName: args.typeName,
    typeId: args.typeId,
    priorityName: args.priorityName,
    priorityId: args.priorityId,
    severityName: args.severityName,
    severityId: args.severityId
  };
  const has =
    opts.statusName != null ||
    opts.statusId != null ||
    opts.assignedToId != null ||
    opts.milestoneSlug != null ||
    opts.milestoneId != null ||
    (opts.tags != null && opts.tags.length > 0) ||
    opts.dueDate != null ||
    opts.estimateHours != null ||
    opts.swimlaneId != null ||
    opts.swimlaneName != null ||
    opts.typeName != null ||
    opts.typeId != null ||
    opts.priorityName != null ||
    opts.priorityId != null ||
    opts.severityName != null ||
    opts.severityId != null;
  return has ? opts : undefined;
}

const statusEntityTypeSchema = z
  .enum(["user_story", "task", "issue", "epic"])
  .describe("Entity type for status list");

const storyRefOnly = {
  storyId: storyRefFields.storyId,
  storyRef: storyRefFields.storyRef
};
const taskRefOnly = {
  taskId: taskRefFields.taskId,
  taskRef: taskRefFields.taskRef
};
const issueRefOnly = {
  issueId: issueRefFields.issueId,
  issueRef: issueRefFields.issueRef
};
const epicRefOnly = {
  epicId: epicRefFields.epicId,
  epicRef: epicRefFields.epicRef
};

const customAttributeEntitySchema = z
  .enum(["user_story", "task", "issue", "epic"])
  .describe("Entity type for custom attributes");

const attachmentEntitySchema = z
  .enum(["user_story", "task", "issue", "epic", "wiki"])
  .describe("Entity type for attachments");

const server = new McpServer({
  name: "taiga-mcp",
  version: PACKAGE_VERSION
});

installToolLogging(server);

server.tool("taiga_list_projects", {}, async () => {
  try {
    return jsonResult(await listProjects());
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool(
  "taiga_get_project",
  {
    projectSlug: z
      .string()
      .describe(
        "Project slug. Example: taiga_get_project projectSlug=mcp-test"
      )
  },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await getProjectDetail(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Project lifecycle ---

server.tool("taiga_list_project_templates", {}, async () => {
  try {
    return jsonResult(await listProjectTemplates());
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool(
  "taiga_create_project",
  {
    name: z.string().describe("Project display name"),
    description: z.string().describe("Project description"),
    slug: z
      .string()
      .optional()
      .describe(
        "Preferred URL slug (Taiga may normalize from name if unsupported)"
      ),
    templateId: z.number().optional().describe("Project template id from taiga_list_project_templates"),
    isPrivate: z.boolean().optional().describe("Private project (default false)"),
    isEpicsActivated: z.boolean().optional(),
    isIssuesActivated: z.boolean().optional(),
    isWikiActivated: z.boolean().optional(),
    isKanbanActivated: z.boolean().optional(),
    isBacklogActivated: z.boolean().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await createProject({
          name: args.name,
          description: args.description,
          slug: args.slug,
          templateId: args.templateId,
          isPrivate: args.isPrivate,
          isEpicsActivated: args.isEpicsActivated,
          isIssuesActivated: args.isIssuesActivated,
          isWikiActivated: args.isWikiActivated,
          isKanbanActivated: args.isKanbanActivated,
          isBacklogActivated: args.isBacklogActivated
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_project",
  {
    projectSlug: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    isEpicsActivated: z.boolean().optional(),
    isIssuesActivated: z.boolean().optional(),
    isWikiActivated: z.boolean().optional(),
    isKanbanActivated: z.boolean().optional(),
    isBacklogActivated: z.boolean().optional(),
    isPrivate: z.boolean().optional()
  },
  async (args) => {
    try {
      const { projectSlug, ...fields } = args;
      return jsonResult(await updateProject(projectSlug, fields));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_duplicate_project",
  {
    projectSlug: z.string().describe("Source project slug to clone"),
    name: z.string(),
    description: z.string(),
    isPrivate: z.boolean().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await duplicateProject(args.projectSlug, {
          name: args.name,
          description: args.description,
          isPrivate: args.isPrivate
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_project",
  {
    projectSlug: z.string(),
    confirm: z.literal(true).describe("Must be true to delete project")
  },
  async (args) => {
    try {
      if (args.confirm !== true) return toolError("Set confirm=true to delete.");
      await deleteProject(args.projectSlug);
      return toolText(`Deleted project ${args.projectSlug}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_user_stories",
  {
    projectSlug: z.string().describe("Taiga project slug"),
    ...listFilterFields
  },
  async (args) => {
    try {
      return jsonResult(
        await listUserStories(args.projectSlug, buildListQuery(args))
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_search",
  {
    projectSlug: z.string().describe("Taiga project slug"),
    text: z.string().describe("Search text e.g. T00042 or thread id")
  },
  async ({ projectSlug, text }) => {
    try {
      return jsonResult(await searchProject(projectSlug, text));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_milestones",
  { projectSlug: z.string().describe("Taiga project slug") },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listMilestones(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_milestone",
  {
    projectSlug: z.string().describe("Taiga project slug"),
    name: z.string().describe("Milestone display name"),
    slug: z
      .string()
      .describe("Milestone slug e.g. P1-A-Data-Identity"),
    estimatedStart: z.string().describe("ISO date YYYY-MM-DD"),
    estimatedFinish: z.string().describe("ISO date YYYY-MM-DD"),
    order: z.number().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await createMilestone(args.projectSlug, {
          name: args.name,
          slug: args.slug,
          estimatedStart: args.estimatedStart,
          estimatedFinish: args.estimatedFinish,
          order: args.order
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_milestone",
  {
    ...milestoneRefFields,
    name: z.string().optional(),
    estimatedStart: z.string().optional(),
    estimatedFinish: z.string().optional(),
    closed: z
      .boolean()
      .optional()
      .describe("Close milestone for gate M1.x")
  },
  async (args) => {
    try {
      assertMilestoneRefValid(args);
      return jsonResult(
        await updateMilestone(
          {
            milestoneId: args.milestoneId,
            projectSlug: args.projectSlug,
            milestoneSlug: args.milestoneSlug
          },
          {
            name: args.name,
            estimatedStart: args.estimatedStart,
            estimatedFinish: args.estimatedFinish,
            closed: args.closed
          }
        )
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_statuses",
  {
    projectSlug: z.string(),
    entityType: statusEntityTypeSchema
  },
  async ({ projectSlug, entityType }) => {
    try {
      return jsonResult(
        await listStatuses(projectSlug, entityType as StatusEntityType)
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_members",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listMembers(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_points",
  { projectSlug: z.string().describe("List story point scale for project") },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listPoints(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Issue metadata and team ---

server.tool(
  "taiga_list_issue_types",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listIssueTypes(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_priorities",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listPriorities(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_severities",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listSeverities(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_milestone",
  { ...milestoneRefFields },
  async (args) => {
    try {
      assertMilestoneRefValid(args);
      if (args.milestoneId != null) {
        return jsonResult(await getMilestoneById(args.milestoneId));
      }
      return jsonResult(
        await getMilestone(args.projectSlug!, args.milestoneSlug!)
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_roles",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listRoles(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_invite_member",
  {
    projectSlug: z.string(),
    username: z.string().describe("Taiga username or email"),
    roleId: z.number().optional(),
    roleName: z.string().optional().describe("Role label e.g. Product Owner")
  },
  async (args) => {
    try {
      return jsonResult(
        await inviteMember(args.projectSlug, {
          username: args.username,
          roleId: args.roleId,
          roleName: args.roleName
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_tasks",
  {
    projectSlug: z.string(),
    userStoryId: z.number().optional().describe("Filter by parent story id"),
    ...listFilterFields
  },
  async (args) => {
    try {
      const q = buildListQuery(args);
      if (args.userStoryId != null) q.userStoryId = args.userStoryId;
      return jsonResult(await listTasks(args.projectSlug, q));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_issues",
  {
    projectSlug: z.string(),
    ...listFilterFields
  },
  async (args) => {
    try {
      return jsonResult(await listIssues(args.projectSlug, buildListQuery(args)));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_epics",
  {
    projectSlug: z.string(),
    ...listFilterFields
  },
  async (args) => {
    try {
      return jsonResult(await listEpics(args.projectSlug, buildListQuery(args)));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_story",
  {
    ...storyRefFields,
    includeHistory: z.boolean().optional()
  },
  async (args) => {
    try {
      assertStoryRefValid(args);
      return jsonResult(
        await fetchStoryBundle(
          {
            storyId: args.storyId,
            projectSlug: args.projectSlug,
            storyRef: args.storyRef
          },
          args.includeHistory ?? false
        )
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool("taiga_get_story_history", storyRefFields, async (args) => {
  try {
    assertStoryRefValid(args);
    const story = await resolveStory(args);
    const history = trimHistory(await getStoryHistory(story.id));
    return jsonResult({ story_id: story.id, ref: story.ref, history });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_get_task", taskRefFields, async (args) => {
  try {
    assertTaskRefValid(args);
    return jsonResult(trimTaskDetail(await resolveTask(args)));
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_get_task_history", taskRefFields, async (args) => {
  try {
    assertTaskRefValid(args);
    const task = await resolveTask(args);
    const history = trimHistory(await getTaskHistory(task.id));
    return jsonResult({ task_id: task.id, ref: task.ref, history });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_get_issue", issueRefFields, async (args) => {
  try {
    assertIssueRefValid(args);
    return jsonResult(trimIssueDetail(await resolveIssue(args)));
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_get_issue_history", issueRefFields, async (args) => {
  try {
    assertIssueRefValid(args);
    const issue = await resolveIssue(args);
    const history = trimHistory(await getIssueHistory(issue.id));
    return jsonResult({ issue_id: issue.id, ref: issue.ref, history });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_get_epic", epicRefFields, async (args) => {
  try {
    assertEpicRefValid(args);
    return jsonResult(trimEpicDetail(await resolveEpic(args)));
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool(
  "taiga_create_story",
  {
    projectSlug: z.string(),
    subject: z.string().describe("e.g. T00042 — Implement auth"),
    description: z.string().optional(),
    ...createStoryFieldsShape
  },
  async (args) => {
    try {
      const story = await createUserStory(
        args.projectSlug,
        args.subject,
        args.description,
        { ...pickCreateOptions(args), epicId: args.epicId }
      );
      return jsonResult({
        id: story.id,
        ref: story.ref,
        subject: story.subject,
        version: story.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_task",
  {
    projectSlug: z.string(),
    subject: z.string(),
    description: z.string().optional(),
    userStoryId: z.number().optional(),
    ...createOptionalFieldsShape
  },
  async (args) => {
    try {
      const task = await createTask(args.projectSlug, args.subject, {
        description: args.description,
        userStoryId: args.userStoryId,
        ...pickCreateOptions(args)
      });
      return jsonResult({
        id: task.id,
        ref: task.ref,
        subject: task.subject,
        version: task.version,
        user_story: task.user_story ?? null
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_issue",
  {
    projectSlug: z.string(),
    subject: z.string(),
    description: z.string().optional(),
    ...createOptionalFieldsShape
  },
  async (args) => {
    try {
      const issue = await createIssue(
        args.projectSlug,
        args.subject,
        args.description,
        pickCreateOptions(args)
      );
      return jsonResult({
        id: issue.id,
        ref: issue.ref,
        subject: issue.subject,
        version: issue.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_epic",
  {
    projectSlug: z.string(),
    subject: z.string().describe("e.g. [M05-E03] Epic title"),
    description: z.string().optional(),
    ...createOptionalFieldsShape
  },
  async (args) => {
    try {
      const epic = await createEpic(
        args.projectSlug,
        args.subject,
        args.description,
        pickCreateOptions(args)
      );
      return jsonResult({
        id: epic.id,
        ref: epic.ref,
        subject: epic.subject,
        version: epic.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_link_story_to_epic",
  {
    epicId: z.number(),
    storyId: z.number().describe("User story internal id")
  },
  async ({ epicId, storyId }) => {
    try {
      await linkStoryToEpic(epicId, storyId);
      return toolText(`Linked user story ${storyId} to epic ${epicId}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_unlink_story_from_epic",
  {
    epicId: z.number(),
    storyId: z.number()
  },
  async ({ epicId, storyId }) => {
    try {
      await unlinkStoryFromEpic(epicId, storyId);
      return toolText(`Unlinked user story ${storyId} from epic ${epicId}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_bulk_sync_tasks_csv",
  {
    projectSlug: z.string().describe("Required Taiga project slug"),
    csvPath: z
      .string()
      .describe("Absolute or workspace path to plan/L5/tasks.csv"),
    dryRun: z
      .boolean()
      .optional()
      .describe("If true, validate only — no creates"),
    delayMs: z.number().optional().describe("Delay between rows (default 200)"),
    milestoneSlugMap: z
      .string()
      .optional()
      .describe('JSON map subphase→slug e.g. {"A":"P1-A-Data-Identity"}')
  },
  async (args) => {
    try {
      let map: Record<string, string> | undefined;
      if (args.milestoneSlugMap) {
        map = parseJsonParam(args.milestoneSlugMap, milestoneSlugMapSchema);
      }
      return jsonResult(
        await bulkSyncTasksCsv({
          projectSlug: args.projectSlug,
          csvPath: args.csvPath,
          dryRun: args.dryRun ?? false,
          delayMs: args.delayMs,
          milestoneSlugMap: map
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_story_backlog_order",
  {
    projectSlug: z.string(),
    orders: z
      .string()
      .describe(
        'JSON array [{\"storyRef\":1,\"order\":10}] or storyId+order'
      )
  },
  async ({ projectSlug, orders }) => {
    try {
      const parsed = parseJsonParam(orders, storyOrdersSchema);
      await updateStoryBacklogOrder(
        projectSlug,
        parsed.map((e) => ({
          storyRef: e.storyRef,
          storyId: e.storyId,
          order: e.order,
          projectSlug
        }))
      );
      return toolText("Backlog order updated.");
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_story_sprint_order",
  {
    projectSlug: z.string(),
    orders: z.string().describe("JSON array of {storyRef|storyId, order}")
  },
  async ({ projectSlug, orders }) => {
    try {
      const parsed = parseJsonParam(orders, storyOrdersSchema);
      await updateStorySprintOrder(
        projectSlug,
        parsed.map((e) => ({
          storyRef: e.storyRef,
          storyId: e.storyId,
          order: e.order,
          projectSlug
        }))
      );
      return toolText("Sprint order updated.");
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_kanban_board",
  {
    projectSlug: z.string(),
    includeClosed: z
      .boolean()
      .optional()
      .describe("Include closed user stories (default false)"),
    swimlaneId: z
      .number()
      .optional()
      .describe("Filter cards to a single swimlane id")
  },
  async ({ projectSlug, includeClosed, swimlaneId }) => {
    try {
      return jsonResult(
        await getKanbanBoard(projectSlug, { includeClosed, swimlaneId })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_story_kanban_order",
  {
    projectSlug: z.string(),
    orders: z
      .string()
      .describe('JSON array [{\"storyRef\":1,\"order\":10}] or storyId+order')
  },
  async ({ projectSlug, orders }) => {
    try {
      const parsed = parseJsonParam(orders, storyOrdersSchema);
      await updateStoryKanbanOrder(
        projectSlug,
        parsed.map((e) => ({
          storyRef: e.storyRef,
          storyId: e.storyId,
          order: e.order,
          projectSlug
        }))
      );
      return toolText("Kanban order updated.");
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_move_story_on_kanban",
  {
    ...storyRefFields,
    projectSlug: z.string(),
    statusName: storyUpdateFieldsShape.statusName,
    statusId: storyUpdateFieldsShape.statusId,
    swimlaneId: storyUpdateFieldsShape.swimlaneId,
    swimlaneName: storyUpdateFieldsShape.swimlaneName,
    kanbanOrder: z
      .number()
      .optional()
      .describe("New kanban_order within the status column")
  },
  async (args) => {
    try {
      assertStoryRefValid(args);
      if (
        args.statusName == null &&
        args.statusId == null &&
        args.swimlaneId == null &&
        args.swimlaneName == null &&
        args.kanbanOrder == null
      ) {
        return toolError(
          "Provide at least one of statusName, statusId, swimlaneId, swimlaneName, or kanbanOrder."
        );
      }
      return jsonResult(
        await moveStoryOnKanban({
          projectSlug: args.projectSlug,
          storyId: args.storyId,
          storyRef: args.storyRef,
          statusName: args.statusName,
          statusId: args.statusId,
          swimlaneId: args.swimlaneId,
          swimlaneName: args.swimlaneName,
          kanbanOrder: args.kanbanOrder
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_user_story_status",
  {
    projectSlug: z.string(),
    name: z.string().describe("Column name e.g. Review"),
    color: z
      .string()
      .optional()
      .describe("HEX color e.g. #AAAAAA"),
    order: z.number().optional().describe("Column order on board"),
    wipLimit: z
      .number()
      .optional()
      .describe("Max cards allowed in this column"),
    isClosed: z.boolean().optional().describe("Closed/archived column")
  },
  async (args) => {
    try {
      return jsonResult(
        await createUserStoryStatus(args.projectSlug, {
          name: args.name,
          color: args.color,
          order: args.order,
          wipLimit: args.wipLimit,
          isClosed: args.isClosed
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_user_story_status",
  {
    projectSlug: z.string(),
    statusId: z.number().optional(),
    statusName: z.string().optional(),
    name: z.string().optional(),
    color: z.string().optional(),
    order: z.number().optional(),
    wipLimit: z.number().optional(),
    isClosed: z.boolean().optional()
  },
  async (args) => {
    try {
      if (args.statusId == null && args.statusName == null) {
        return toolError("Provide statusId or statusName.");
      }
      return jsonResult(
        await updateUserStoryStatus(args.projectSlug, {
          statusId: args.statusId,
          statusName: args.statusName,
          name: args.name,
          color: args.color,
          order: args.order,
          wipLimit: args.wipLimit,
          isClosed: args.isClosed
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_user_story_status",
  {
    projectSlug: z.string(),
    statusId: z.number().describe("User story status (column) id")
  },
  async ({ projectSlug, statusId }) => {
    try {
      await deleteUserStoryStatus(projectSlug, statusId);
      return toolText(`User story status ${statusId} deleted.`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_reorder_user_story_statuses",
  {
    projectSlug: z.string(),
    orders: z
      .string()
      .describe('JSON array [{\"statusId\":1,\"order\":10}]')
  },
  async ({ projectSlug, orders }) => {
    try {
      const parsed = parseJsonParam(orders, statusOrdersSchema);
      await reorderUserStoryStatuses(projectSlug, parsed);
      return toolText("User story status order updated.");
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_swimlanes",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listSwimlanes(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_swimlane",
  {
    projectSlug: z.string(),
    name: z.string(),
    order: z.number().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await createSwimlane(args.projectSlug, {
          name: args.name,
          order: args.order
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_swimlane",
  {
    projectSlug: z.string(),
    swimlaneId: z.number(),
    name: z.string().optional(),
    order: z.number().optional()
  },
  async (args) => {
    try {
      if (args.name == null && args.order == null) {
        return toolError("Provide at least one of name or order.");
      }
      return jsonResult(
        await updateSwimlane(args.projectSlug, args.swimlaneId, {
          name: args.name,
          order: args.order
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_swimlane",
  {
    projectSlug: z.string(),
    swimlaneId: z.number(),
    moveToSwimlaneId: z
      .number()
      .optional()
      .describe("Move stories to this swimlane before delete")
  },
  async ({ projectSlug, swimlaneId, moveToSwimlaneId }) => {
    try {
      await deleteSwimlane(projectSlug, swimlaneId, moveToSwimlaneId);
      return toolText(`Swimlane ${swimlaneId} deleted.`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_set_story_blocked_by",
  {
    projectSlug: z.string(),
    storyRef: z.number().optional(),
    taskRef: z.number().optional(),
    storyId: z.number().optional(),
    taskId: z.number().optional(),
    blockedByThreadId: z
      .string()
      .describe("Thread id of blocker e.g. T00041"),
    blockTask: z
      .boolean()
      .optional()
      .describe("If true, block task instead of story")
  },
  async (args) => {
    try {
      const note = args.blockedByThreadId;
      if (args.blockTask || args.taskRef != null || args.taskId != null) {
        const updated = await updateTask(
          {
            taskId: args.taskId,
            taskRef: args.taskRef,
            projectSlug: args.projectSlug
          },
          { isBlocked: true, blockedNote: note }
        );
        return jsonResult({ ref: updated.ref, id: updated.id, blocked: true });
      }
      const updated = await updateStory(
        {
          storyId: args.storyId,
          storyRef: args.storyRef,
          projectSlug: args.projectSlug
        },
        { isBlocked: true, blockedNote: note }
      );
      return jsonResult({ ref: updated.ref, id: updated.id, blocked: true });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_comment_on_story",
  { ...storyRefFields, comment: z.string() },
  async (args) => {
    try {
      assertStoryRefValid(args);
      const story = await resolveStory(args);
      await addStoryComment(story.id, args.comment);
      return toolText(
        `Comment added to Taiga user story #${story.ref} (id ${story.id})`
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_comment_on_task",
  { ...taskRefFields, comment: z.string() },
  async (args) => {
    try {
      assertTaskRefValid(args);
      const task = await resolveTask(args);
      await addTaskComment(task.id, args.comment);
      return toolText(`Comment added to Taiga task #${task.ref} (id ${task.id})`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_comment_on_issue",
  { ...issueRefFields, comment: z.string() },
  async (args) => {
    try {
      assertIssueRefValid(args);
      const issue = await resolveIssue(args);
      await addIssueComment(issue.id, args.comment);
      return toolText(
        `Comment added to Taiga issue #${issue.ref} (id ${issue.id})`
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_comment_on_epic",
  { ...epicRefFields, comment: z.string() },
  async (args) => {
    try {
      assertEpicRefValid(args);
      const epic = await resolveEpic(args);
      await addEpicComment(epic.id, args.comment);
      return toolText(`Comment added to Taiga epic #${epic.ref} (id ${epic.id})`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_story",
  { ...storyRefFields, ...storyUpdateFieldsShape },
  async (args) => {
    try {
      assertStoryRefValid(args);
      assertStoryUpdateValid(args);
      const updated = await updateStory(
        {
          storyId: args.storyId,
          projectSlug: args.projectSlug,
          storyRef: args.storyRef
        },
        pickCommonUpdate(args) as StoryUpdateFields
      );
      return jsonResult({
        id: updated.id,
        ref: updated.ref,
        subject: updated.subject,
        status: updated.status_extra_info?.name ?? null,
        milestone: updated.milestone_slug ?? updated.milestone_name ?? null,
        is_closed:
          updated.is_closed ?? updated.status_extra_info?.is_closed ?? false,
        kanban_order: updated.kanban_order ?? null,
        swimlane_id: updated.swimlane ?? null,
        version: updated.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_task",
  { ...taskRefFields, ...taskUpdateFieldsShape },
  async (args) => {
    try {
      assertTaskRefValid(args);
      assertTaskUpdateValid(args);
      const updated = await updateTask(
        {
          taskId: args.taskId,
          projectSlug: args.projectSlug,
          taskRef: args.taskRef
        },
        pickCommonUpdate(args) as TaskUpdateFields
      );
      return jsonResult({
        id: updated.id,
        ref: updated.ref,
        subject: updated.subject,
        status: updated.status_extra_info?.name ?? null,
        is_closed: updated.is_closed,
        version: updated.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_issue",
  { ...issueRefFields, ...issueUpdateFieldsShape },
  async (args) => {
    try {
      assertIssueRefValid(args);
      assertIssueUpdateValid(args);
      const updated = await updateIssue(
        {
          issueId: args.issueId,
          projectSlug: args.projectSlug,
          issueRef: args.issueRef
        },
        pickCommonUpdate(args) as IssueUpdateFields
      );
      return jsonResult({
        id: updated.id,
        ref: updated.ref,
        subject: updated.subject,
        status: updated.status_extra_info?.name ?? null,
        is_closed:
          updated.is_closed ?? updated.status_extra_info?.is_closed ?? false,
        version: updated.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_epic",
  { ...epicRefFields, ...epicUpdateFieldsShape },
  async (args) => {
    try {
      assertEpicRefValid(args);
      assertEpicUpdateValid(args);
      const updated = await updateEpic(
        {
          epicId: args.epicId,
          projectSlug: args.projectSlug,
          epicRef: args.epicRef
        },
        pickCommonUpdate(args) as EpicUpdateFields
      );
      return jsonResult({
        id: updated.id,
        ref: updated.ref,
        subject: updated.subject,
        status: updated.status_extra_info?.name ?? null,
        version: updated.version
      });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool("taiga_archive_story", storyRefFields, async (args) => {
  try {
    assertStoryRefValid(args);
    const s = await archiveStory(args);
    return jsonResult({ id: s.id, ref: s.ref, archived: true });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_archive_task", taskRefFields, async (args) => {
  try {
    assertTaskRefValid(args);
    const t = await archiveTask(args);
    return jsonResult({ id: t.id, ref: t.ref, archived: true });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_archive_epic", epicRefFields, async (args) => {
  try {
    assertEpicRefValid(args);
    const e = await archiveEpic(args);
    return jsonResult({ id: e.id, ref: e.ref, archived: true });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool("taiga_archive_issue", issueRefFields, async (args) => {
  try {
    assertIssueRefValid(args);
    const i = await archiveIssue(args);
    return jsonResult({ id: i.id, ref: i.ref, archived: true });
  } catch (err) {
    return toolError(formatTaigaError(err));
  }
});

server.tool(
  "taiga_delete_story",
  {
    ...storyRefFields,
    confirm: z.literal(true).describe("Must be true to delete")
  },
  async (args) => {
    try {
      assertStoryRefValid(args);
      if (args.confirm !== true) {
        return toolError("Set confirm=true to delete.");
      }
      const story = await resolveStory(args);
      await deleteUserStory(story.id);
      return toolText(`Deleted user story #${story.ref}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_task",
  {
    ...taskRefFields,
    confirm: z.literal(true)
  },
  async (args) => {
    try {
      assertTaskRefValid(args);
      if (args.confirm !== true) return toolError("Set confirm=true to delete.");
      const task = await resolveTask(args);
      await deleteTask(task.id);
      return toolText(`Deleted task #${task.ref}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_epic",
  {
    ...epicRefFields,
    confirm: z.literal(true)
  },
  async (args) => {
    try {
      assertEpicRefValid(args);
      if (args.confirm !== true) return toolError("Set confirm=true to delete.");
      const epic = await resolveEpic(args);
      await deleteEpic(epic.id);
      return toolText(`Deleted epic #${epic.ref}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_issue",
  {
    ...issueRefFields,
    confirm: z.literal(true)
  },
  async (args) => {
    try {
      assertIssueRefValid(args);
      if (args.confirm !== true) return toolError("Set confirm=true to delete.");
      const issue = await resolveIssue(args);
      await deleteIssue(issue.id);
      return toolText(`Deleted issue #${issue.ref}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Project tags and stats ---

server.tool(
  "taiga_list_project_tags",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listProjectTags(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_project_tag",
  {
    projectSlug: z.string(),
    tag: z.string(),
    color: z.string().optional().describe("HEX color e.g. #FF0000")
  },
  async (args) => {
    try {
      return jsonResult(
        await createProjectTag(args.projectSlug, args.tag, args.color)
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_edit_project_tag",
  {
    projectSlug: z.string(),
    fromTag: z.string(),
    toTag: z.string(),
    color: z.string().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await editProjectTag(args.projectSlug, args.fromTag, args.toTag, args.color)
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_project_tag",
  { projectSlug: z.string(), tag: z.string() },
  async ({ projectSlug, tag }) => {
    try {
      await deleteProjectTag(projectSlug, tag);
      return toolText(`Deleted tag ${tag}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_project_stats",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await getProjectStats(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_project_issue_stats",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await getProjectIssueStats(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Custom attributes ---

server.tool(
  "taiga_list_custom_attributes",
  {
    projectSlug: z.string(),
    entityType: customAttributeEntitySchema
  },
  async ({ projectSlug, entityType }) => {
    try {
      return jsonResult(await listCustomAttributes(projectSlug, entityType));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_custom_attribute_values",
  {
    projectSlug: z.string(),
    entityType: customAttributeEntitySchema,
    ...storyRefOnly,
    ...taskRefOnly,
    ...issueRefOnly,
    ...epicRefOnly
  },
  async (args) => {
    try {
      assertCustomAttributeRefValid(args.entityType, args);
      return jsonResult(
        await getCustomAttributeValues(args.projectSlug, args.entityType, {
          projectSlug: args.projectSlug,
          storyId: args.storyId,
          storyRef: args.storyRef,
          taskId: args.taskId,
          taskRef: args.taskRef,
          issueId: args.issueId,
          issueRef: args.issueRef,
          epicId: args.epicId,
          epicRef: args.epicRef
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_set_custom_attribute_values",
  {
    projectSlug: z.string(),
    entityType: customAttributeEntitySchema,
    values: z.string().describe("JSON object of attribute id/name to value"),
    ...storyRefOnly,
    ...taskRefOnly,
    ...issueRefOnly,
    ...epicRefOnly
  },
  async (args) => {
    try {
      assertCustomAttributeRefValid(args.entityType, args);
      const values = parseJsonParam(args.values, z.record(z.unknown()));
      return jsonResult(
        await setCustomAttributeValues(
          args.projectSlug,
          args.entityType,
          {
            projectSlug: args.projectSlug,
            storyId: args.storyId,
            storyRef: args.storyRef,
            taskId: args.taskId,
            taskRef: args.taskRef,
            issueId: args.issueId,
            issueRef: args.issueRef,
            epicId: args.epicId,
            epicRef: args.epicRef
          },
          values
        )
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Wiki ---

server.tool(
  "taiga_list_wiki_pages",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listWikiPages(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_wiki_page",
  {
    projectSlug: z.string(),
    wikiSlug: z.string().describe("Wiki page slug")
  },
  async ({ projectSlug, wikiSlug }) => {
    try {
      return jsonResult(await getWikiPage(projectSlug, wikiSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_wiki_page",
  {
    projectSlug: z.string(),
    subject: z.string(),
    content: z.string().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await createWikiPage(args.projectSlug, args.subject, args.content)
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_wiki_page",
  {
    projectSlug: z.string(),
    wikiSlug: z.string(),
    subject: z.string().optional(),
    content: z.string().optional()
  },
  async (args) => {
    try {
      return jsonResult(
        await updateWikiPage(args.projectSlug, args.wikiSlug, {
          subject: args.subject,
          content: args.content
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_wiki_page",
  { projectSlug: z.string(), wikiSlug: z.string() },
  async ({ projectSlug, wikiSlug }) => {
    try {
      await deleteWikiPage(projectSlug, wikiSlug);
      return toolText(`Deleted wiki page ${wikiSlug}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Attachments ---

server.tool(
  "taiga_list_attachments",
  {
    projectSlug: z.string(),
    entityType: attachmentEntitySchema,
    ...storyRefOnly,
    ...taskRefOnly,
    ...issueRefOnly,
    ...epicRefOnly,
    wikiId: z.number().optional().describe("Wiki page id (wiki entityType only)")
  },
  async (args) => {
    try {
      assertAttachmentRefValid(args.entityType, args);
      return jsonResult(
        await listAttachments(args.projectSlug, args.entityType, {
          projectSlug: args.projectSlug,
          storyId: args.storyId,
          storyRef: args.storyRef,
          taskId: args.taskId,
          taskRef: args.taskRef,
          issueId: args.issueId,
          issueRef: args.issueRef,
          epicId: args.epicId,
          epicRef: args.epicRef,
          wikiId: args.wikiId
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_upload_attachment",
  {
    projectSlug: z.string(),
    entityType: attachmentEntitySchema,
    filePath: z.string().describe("Absolute path to file on host"),
    ...storyRefOnly,
    ...taskRefOnly,
    ...issueRefOnly,
    ...epicRefOnly,
    wikiId: z.number().optional()
  },
  async (args) => {
    try {
      assertAttachmentRefValid(args.entityType, args);
      return jsonResult(
        await uploadAttachment(
          args.projectSlug,
          args.entityType,
          args.filePath,
          {
            projectSlug: args.projectSlug,
            storyId: args.storyId,
            storyRef: args.storyRef,
            taskId: args.taskId,
            taskRef: args.taskRef,
            issueId: args.issueId,
            issueRef: args.issueRef,
            epicId: args.epicId,
            epicRef: args.epicRef,
            wikiId: args.wikiId
          }
        )
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_attachment",
  {
    entityType: attachmentEntitySchema,
    attachmentId: z.number()
  },
  async ({ entityType, attachmentId }) => {
    try {
      await deleteAttachment(entityType, attachmentId);
      return toolText(`Deleted attachment ${attachmentId}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

// --- Webhooks ---

server.tool(
  "taiga_list_webhooks",
  { projectSlug: z.string() },
  async ({ projectSlug }) => {
    try {
      return jsonResult(await listWebhooks(projectSlug));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_webhook",
  {
    projectSlug: z.string(),
    name: z.string(),
    url: z.string().describe("Webhook callback URL"),
    key: z.string().optional().describe("Optional signing key")
  },
  async (args) => {
    try {
      return jsonResult(
        await createWebhook(args.projectSlug, {
          name: args.name,
          url: args.url,
          key: args.key
        })
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_update_webhook",
  {
    webhookId: z.number(),
    name: z.string().optional(),
    url: z.string().optional(),
    key: z.string().optional(),
    active: z.boolean().optional()
  },
  async (args) => {
    try {
      const { webhookId, ...fields } = args;
      return jsonResult(await updateWebhook(webhookId, fields));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_delete_webhook",
  {
    webhookId: z.number(),
    confirm: z.literal(true)
  },
  async (args) => {
    try {
      if (args.confirm !== true) return toolError("Set confirm=true to delete.");
      await deleteWebhook(args.webhookId);
      return toolText(`Deleted webhook ${args.webhookId}`);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_test_webhook",
  { webhookId: z.number() },
  async ({ webhookId }) => {
    try {
      return jsonResult(await testWebhook(webhookId));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

try {
  await ensureAuthReady();
  const mode = getAuthMode();
  if (mode) {
    logAuthReady({
      mode,
      username: getLoggedInUsername() ?? undefined
    });
  }
  logReady({
    version: PACKAGE_VERSION,
    apiHost: getApiBaseUrl(),
    toolCount: getRegisteredToolCount()
  });
} catch (err) {
  logConfigError(formatTaigaError(err));
  process.exit(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);
