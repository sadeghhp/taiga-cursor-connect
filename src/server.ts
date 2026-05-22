import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatTaigaError } from "./errors.js";
import {
  addIssueComment,
  addStoryComment,
  addTaskComment,
  createIssue,
  createTask,
  createUserStory,
  fetchStoryBundle,
  getIssueHistory,
  getStoryHistory,
  getTaskHistory,
  listProjects,
  listUserStories,
  resolveIssue,
  resolveStory,
  resolveTask,
  searchProject,
  trimHistory,
  trimIssueDetail,
  trimTaskDetail,
  updateIssue,
  updateStory,
  updateTask,
  type CommonUpdateFields,
  type IssueUpdateFields,
  type StoryUpdateFields,
  type TaskUpdateFields
} from "./taiga-client.js";
import {
  assertIssueRefValid,
  assertIssueUpdateValid,
  assertStoryRefValid,
  assertStoryUpdateValid,
  assertTaskRefValid,
  assertTaskUpdateValid,
  issueRefFields,
  issueUpdateFieldsShape,
  parseTagsParam,
  storyRefFields,
  taskRefFields,
  taskUpdateFieldsShape,
  updateFieldsShape
} from "./schemas.js";

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
  tags?: string;
  isBlocked?: boolean;
  blockedNote?: string;
  milestoneSlug?: string;
  milestoneId?: number;
}): CommonUpdateFields & { milestoneSlug?: string; milestoneId?: number } {
  return {
    statusName: args.statusName,
    statusId: args.statusId,
    isClosed: args.isClosed,
    subject: args.subject,
    description: args.description,
    assignedToId: args.assignedToId,
    tags: parseTagsParam(args.tags),
    isBlocked: args.isBlocked,
    blockedNote: args.blockedNote,
    milestoneSlug: args.milestoneSlug,
    milestoneId: args.milestoneId
  };
}

const server = new McpServer({
  name: "taiga-mcp",
  version: "0.3.0"
});

server.tool(
  "taiga_list_projects",
  {},
  async () => {
    try {
      return jsonResult(await listProjects());
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_list_user_stories",
  {
    projectSlug: z.string().describe("Taiga project slug"),
    milestoneId: z
      .number()
      .optional()
      .describe("Filter by sprint/milestone internal id")
  },
  async ({ projectSlug, milestoneId }) => {
    try {
      return jsonResult(await listUserStories(projectSlug, milestoneId));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_search",
  {
    projectSlug: z.string().describe("Taiga project slug"),
    text: z.string().describe("Search text")
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
  "taiga_get_story",
  {
    ...storyRefFields,
    includeHistory: z
      .boolean()
      .optional()
      .describe("Include trimmed activity history (default false)")
  },
  async (args) => {
    try {
      assertStoryRefValid(args);
      const result = await fetchStoryBundle(
        {
          storyId: args.storyId,
          projectSlug: args.projectSlug,
          storyRef: args.storyRef
        },
        args.includeHistory ?? false
      );
      return jsonResult(result);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_story_history",
  storyRefFields,
  async (args) => {
    try {
      assertStoryRefValid(args);
      const story = await resolveStory(args);
      const history = trimHistory(await getStoryHistory(story.id));
      return jsonResult({ story_id: story.id, ref: story.ref, history });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_task",
  taskRefFields,
  async (args) => {
    try {
      assertTaskRefValid(args);
      const task = await resolveTask(args);
      return jsonResult(trimTaskDetail(task));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_task_history",
  taskRefFields,
  async (args) => {
    try {
      assertTaskRefValid(args);
      const task = await resolveTask(args);
      const history = trimHistory(await getTaskHistory(task.id));
      return jsonResult({ task_id: task.id, ref: task.ref, history });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_issue",
  issueRefFields,
  async (args) => {
    try {
      assertIssueRefValid(args);
      const issue = await resolveIssue(args);
      return jsonResult(trimIssueDetail(issue));
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_issue_history",
  issueRefFields,
  async (args) => {
    try {
      assertIssueRefValid(args);
      const issue = await resolveIssue(args);
      const history = trimHistory(await getIssueHistory(issue.id));
      return jsonResult({ issue_id: issue.id, ref: issue.ref, history });
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_create_story",
  {
    projectSlug: z.string().describe("Taiga project slug"),
    subject: z.string().describe("Story title"),
    description: z.string().optional().describe("Story description")
  },
  async ({ projectSlug, subject, description }) => {
    try {
      const story = await createUserStory(projectSlug, subject, description);
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
    projectSlug: z.string().describe("Taiga project slug"),
    subject: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    userStoryId: z
      .number()
      .optional()
      .describe("Parent user story internal id")
  },
  async ({ projectSlug, subject, description, userStoryId }) => {
    try {
      const task = await createTask(projectSlug, subject, {
        description,
        userStoryId
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
    projectSlug: z.string().describe("Taiga project slug"),
    subject: z.string().describe("Issue title"),
    description: z.string().optional().describe("Issue description")
  },
  async ({ projectSlug, subject, description }) => {
    try {
      const issue = await createIssue(projectSlug, subject, description);
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
  "taiga_comment_on_story",
  {
    ...storyRefFields,
    comment: z.string().describe("Comment text to add to the story")
  },
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
  {
    ...taskRefFields,
    comment: z.string().describe("Comment text to add to the task")
  },
  async (args) => {
    try {
      assertTaskRefValid(args);
      const task = await resolveTask(args);
      await addTaskComment(task.id, args.comment);
      return toolText(
        `Comment added to Taiga task #${task.ref} (id ${task.id})`
      );
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_comment_on_issue",
  {
    ...issueRefFields,
    comment: z.string().describe("Comment text to add to the issue")
  },
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
  "taiga_update_story",
  {
    ...storyRefFields,
    ...updateFieldsShape
  },
  async (args) => {
    try {
      assertStoryRefValid(args);
      assertStoryUpdateValid(args);
      const fields = pickCommonUpdate(args) as StoryUpdateFields;
      const updated = await updateStory(
        {
          storyId: args.storyId,
          projectSlug: args.projectSlug,
          storyRef: args.storyRef
        },
        fields
      );
      return jsonResult({
        id: updated.id,
        ref: updated.ref,
        subject: updated.subject,
        status: updated.status_extra_info?.name ?? null,
        milestone: updated.milestone_slug ?? updated.milestone_name ?? null,
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
  "taiga_update_task",
  {
    ...taskRefFields,
    ...taskUpdateFieldsShape
  },
  async (args) => {
    try {
      assertTaskRefValid(args);
      assertTaskUpdateValid(args);
      const fields = pickCommonUpdate(args) as TaskUpdateFields;
      const updated = await updateTask(
        {
          taskId: args.taskId,
          projectSlug: args.projectSlug,
          taskRef: args.taskRef
        },
        fields
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
  {
    ...issueRefFields,
    ...issueUpdateFieldsShape
  },
  async (args) => {
    try {
      assertIssueRefValid(args);
      assertIssueUpdateValid(args);
      const fields = pickCommonUpdate(args) as IssueUpdateFields;
      const updated = await updateIssue(
        {
          issueId: args.issueId,
          projectSlug: args.projectSlug,
          issueRef: args.issueRef
        },
        fields
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

const transport = new StdioServerTransport();
await server.connect(transport);
