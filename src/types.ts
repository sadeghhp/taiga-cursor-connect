export interface TaigaExtraInfo {
  name?: string;
  full_name?: string;
  full_name_display?: string;
}

export interface TaigaProject {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_epics_activated?: boolean;
  is_issues_activated?: boolean;
  is_wiki_activated?: boolean;
  total_milestones?: number | null;
  total_story_points?: number | null;
}

export interface ProjectDetailSummary {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  is_epics_activated: boolean;
  is_issues_activated: boolean;
  is_wiki_activated: boolean;
  total_milestones: number | null;
  total_story_points: number | null;
}

export interface TaigaEpicRef {
  id: number;
  ref: number;
  subject: string;
}

export interface TaigaUserStory {
  id: number;
  ref: number;
  subject: string;
  description: string;
  version: number;
  project?: number;
  status?: number;
  status_extra_info?: TaigaExtraInfo & { is_closed?: boolean };
  assigned_to_extra_info?: TaigaExtraInfo | null;
  milestone_slug?: string | null;
  milestone_name?: string | null;
  tags?: Array<string | [string, string | null]>;
  points?: Record<string, number>;
  is_blocked?: boolean;
  blocked_note?: string;
  due_date?: string | null;
  total_comments?: number;
  epics?: TaigaEpicRef[];
  is_closed?: boolean;
}

export interface TaigaTask {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  version: number;
  is_closed: boolean;
  status?: number;
  status_extra_info?: TaigaExtraInfo;
  assigned_to_extra_info?: TaigaExtraInfo | null;
  user_story?: number | null;
  project?: number;
  tags?: string[];
  blocked_note?: string;
  is_blocked?: boolean;
}

export interface TaigaStatus {
  id: number;
  name: string;
  is_closed?: boolean;
  project?: number;
}

export interface TaigaHistoryUser {
  name?: string;
  username?: string;
  pk?: number;
}

export interface TaigaHistoryEntry {
  id: string;
  type: number;
  created_at?: string;
  comment?: string;
  comment_html?: string;
  diff?: Record<string, unknown>;
  values_diff?: Record<string, unknown>;
  user?: TaigaHistoryUser;
  key?: string;
}

export interface TaigaSearchHit {
  id: number;
  ref: number;
  subject: string;
  status?: number;
}

export interface TaigaSearchResults {
  count?: number;
  user_stories?: TaigaSearchHit[];
  tasks?: TaigaSearchHit[];
  epics?: TaigaSearchHit[];
  issues?: TaigaSearchHit[];
}

export interface TaigaPoint {
  id: number;
  name: string;
  value: number | null;
}

export interface TaigaMilestone {
  id: number;
  name: string;
  slug: string;
  version?: number;
  closed?: boolean;
  estimated_start?: string | null;
  estimated_finish?: string | null;
}

export interface TaigaMembership {
  id: number;
  user: number;
  user_email?: string;
  user_full_name?: string;
  role_name?: string;
}

export interface TaigaEpic {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  version: number;
  project?: number;
  status_extra_info?: TaigaExtraInfo & { is_closed?: boolean };
  assigned_to_extra_info?: TaigaExtraInfo | null;
  is_closed?: boolean;
  tags?: Array<string | [string, string | null]>;
}

export interface UserStoryListItem {
  id: number;
  ref: number;
  subject: string;
  status_extra_info?: TaigaExtraInfo;
  milestone_name?: string | null;
  is_closed?: boolean;
}

export interface StoryRefInput {
  storyId?: number;
  projectSlug?: string;
  storyRef?: number;
}

export interface TaskRefInput {
  taskId?: number;
  projectSlug?: string;
  taskRef?: number;
}

export interface IssueRefInput {
  issueId?: number;
  projectSlug?: string;
  issueRef?: number;
}

export interface EpicRefInput {
  epicId?: number;
  projectSlug?: string;
  epicRef?: number;
}

export interface MilestoneRefInput {
  milestoneId?: number;
  projectSlug?: string;
  milestoneSlug?: string;
}

export interface ListQuery {
  milestoneId?: number;
  statusName?: string;
  tags?: string[];
  epicId?: number;
  userStoryId?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  paginated: boolean;
}

export interface EpicListSummary {
  id: number;
  ref: number;
  subject: string;
  status: string | null;
  is_closed: boolean;
}

export interface TaigaRole {
  id: number;
  name: string;
  computable?: boolean;
}

export interface PointSummary {
  id: number;
  name: string;
  value: number | null;
}

export interface TaigaIssue {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  version: number;
  project?: number;
  status_extra_info?: TaigaExtraInfo & { is_closed?: boolean };
  assigned_to_extra_info?: TaigaExtraInfo | null;
  milestone_slug?: string | null;
  milestone_name?: string | null;
  tags?: Array<string | [string, string | null]>;
  is_blocked?: boolean;
  blocked_note?: string;
  is_closed?: boolean;
  priority?: number;
  severity?: number;
  type?: number;
}

export interface IssueSummary {
  id: number;
  ref: number;
  subject: string;
  description: string | null;
  status: string | null;
  assigned_to: string | null;
  milestone: string | null;
  version: number;
  tags: string[];
  is_blocked: boolean;
  blocked_note: string | null;
  is_closed: boolean;
  priority: number | null;
  severity: number | null;
}

export interface ProjectSummary {
  id: number;
  slug: string;
  name: string;
}

export interface EpicSummary {
  id: number;
  ref: number;
  subject: string;
}

export interface TaskSummary {
  id: number;
  ref: number;
  subject: string;
  description: string | null;
  status: string | null;
  assigned_to: string | null;
  is_closed: boolean;
  version: number;
  blocked_note: string | null;
  tags: string[];
}

export interface StorySummary {
  id: number;
  ref: number;
  subject: string;
  description: string;
  status: string | null;
  assigned_to: string | null;
  milestone: string | null;
  version: number;
  tags: string[];
  points: Record<string, number> | null;
  points_by_role: Record<string, number> | null;
  is_blocked: boolean;
  blocked_note: string | null;
  due_date: string | null;
  total_comments: number | null;
  epics: EpicSummary[];
  is_closed: boolean;
  tasks: TaskSummary[];
  history?: HistoryEntrySummary[];
}

export interface HistoryEntrySummary {
  id: string;
  type: number;
  created_at: string | null;
  user: string | null;
  comment: string | null;
  changes: Record<string, unknown> | null;
}

export interface SearchResultSummary {
  type: "user_story" | "task" | "epic" | "issue";
  id: number;
  ref: number;
  subject: string;
}

export interface UserStoryListSummary {
  id: number;
  ref: number;
  subject: string;
  status: string | null;
  milestone: string | null;
  is_closed: boolean;
}

export interface MilestoneSummary {
  id: number;
  name: string;
  slug: string;
  closed: boolean;
  estimated_start: string | null;
  estimated_finish: string | null;
}

export interface StatusSummary {
  id: number;
  name: string;
  is_closed: boolean;
}

export interface MemberSummary {
  user_id: number;
  full_name: string | null;
  username: string | null;
  role: string | null;
}

export interface TaskListSummary {
  id: number;
  ref: number;
  subject: string;
  status: string | null;
  is_closed: boolean;
  user_story: number | null;
}

export interface IssueListSummary {
  id: number;
  ref: number;
  subject: string;
  status: string | null;
  is_closed: boolean;
}

export interface EpicDetailSummary {
  id: number;
  ref: number;
  subject: string;
  description: string | null;
  status: string | null;
  assigned_to: string | null;
  is_closed: boolean;
  version: number;
  tags: string[];
}
