import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  TaigaError,
  addStoryComment,
  addTaskComment,
  fetchStoryBundle,
  getStoryHistory,
  getTaskHistory,
  listProjects,
  listUserStories,
  resolveStory,
  resolveTask,
  searchProject,
  trimHistory,
  trimTaskDetail,
  updateStory,
  updateTask
} from "./taiga-client.js";
import {
  SchemaValidationError,
  assertStoryRefValid,
  assertStoryUpdateValid,
  assertTaskRefValid,
  assertTaskUpdateValid,
  storyRefFields,
  taskRefFields,
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

function formatTaigaError(err: unknown): string {
  if (err instanceof TaigaError || err instanceof SchemaValidationError) {
    const status = err instanceof TaigaError ? err.status : undefined;
    return status ? `${err.message} (HTTP ${status})` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

function jsonResult(data: unknown) {
  return toolText(JSON.stringify(data, null, 2));
}

const server = new McpServer({
  name: "taiga-mcp",
  version: "0.2.1"
});

server.tool(
  "taiga_list_projects",
  {},
  async () => {
    try {
      const projects = await listProjects();
      return jsonResult(projects);
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
      const stories = await listUserStories(projectSlug, milestoneId);
      return jsonResult(stories);
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
      const results = await searchProject(projectSlug, text);
      return jsonResult(results);
    } catch (err) {
      return toolError(formatTaigaError(err));
    }
  }
);

server.tool(
  "taiga_get_story",
  {
    projectSlug: z
      .string()
      .describe("Taiga project slug, e.g. admin-my-project or project-0"),
    storyRef: z.number().describe("User story ref number shown in UI as #42"),
    includeHistory: z
      .boolean()
      .optional()
      .describe("Include trimmed activity history (default false)")
  },
  async ({ projectSlug, storyRef, includeHistory }) => {
    try {
      const result = await fetchStoryBundle(
        projectSlug,
        storyRef,
        includeHistory ?? false
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
  "taiga_update_story",
  {
    ...storyRefFields,
    ...updateFieldsShape
  },
  async (args) => {
    try {
      assertStoryRefValid(args);
      assertStoryUpdateValid(args);
      const {
        storyId,
        projectSlug,
        storyRef,
        statusName,
        statusId,
        isClosed,
        subject,
        description,
        milestoneSlug,
        milestoneId
      } = args;
      const updated = await updateStory(
        { storyId, projectSlug, storyRef },
        {
          statusName,
          statusId,
          isClosed,
          subject,
          description,
          milestoneSlug,
          milestoneId
        }
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
    statusName: updateFieldsShape.statusName,
    statusId: updateFieldsShape.statusId,
    isClosed: updateFieldsShape.isClosed,
    subject: updateFieldsShape.subject,
    description: updateFieldsShape.description
  },
  async (args) => {
    try {
      assertTaskRefValid(args);
      assertTaskUpdateValid(args);
      const {
        taskId,
        projectSlug,
        taskRef,
        statusName,
        statusId,
        isClosed,
        subject,
        description
      } = args;
      const updated = await updateTask(
        { taskId, projectSlug, taskRef },
        { statusName, statusId, isClosed, subject, description }
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

const transport = new StdioServerTransport();
await server.connect(transport);
