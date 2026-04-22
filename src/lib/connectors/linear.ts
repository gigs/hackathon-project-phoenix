import { readCache, writeCache } from "../cache";
import type { ConnectorResult, HealthStatus, LinearIssue } from "../types";

const API_URL = "https://api.linear.app/graphql";

interface LinearProjectNode {
  id: string;
  slugId: string;
  name: string;
  state: string;
  health: string | null;
  lead: { name: string } | null;
  issues: { nodes: { id: string }[] };
  projectUpdates: {
    nodes: Array<{
      body: string;
      createdAt: string;
      url: string | null;
      user: { name: string } | null;
    }>;
  };
}

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  state: { name: string };
  priority: number;
  labels: { nodes: { name: string }[] };
  url: string;
  assignee: { name: string } | null;
  project: { slugId: string } | null;
}

export interface LinearProjectResult {
  id: string;
  name: string;
  status: string;
  health: HealthStatus;
  lead: string | null;
  issueCount: number;
  latestUpdate: {
    body: string;
    createdAt: string; // ISO
    author: string | null;
    url: string | null;
  } | null;
}

export interface LinearDataForCustomer {
  projects: Record<string, LinearProjectResult>;
  flaggedIssues: LinearIssue[];
}

function mapHealth(h: string | null): HealthStatus {
  switch (h) {
    case "onTrack":
      return "green";
    case "atRisk":
      return "yellow";
    case "offTrack":
      return "red";
    default:
      return "gray";
  }
}

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Linear GraphQL error: ${json.errors[0]?.message}`);
  }
  return json.data as T;
}

/** Relay pagination — fetch entire connection for insight exports (bounded by MAX_PAGES). */
const LINEAR_PAGE_SIZE = 100;
const LINEAR_MAX_PAGES = 100;

interface RelayPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

async function fetchProject(slugId: string, noCache: boolean): Promise<LinearProjectResult | null> {
  if (!noCache) {
    const cached = readCache<LinearProjectResult>("linear", slugId);
    if (cached) return cached;
  }

  try {
    // Use projects filter to find by slugId
    const data = await graphql<{
      projects: { nodes: LinearProjectNode[] };
    }>(`
      query($slugId: String!) {
        projects(filter: { slugId: { eq: $slugId } }, first: 1) {
          nodes {
            id
            slugId
            name
            state
            health
            lead { name }
            issues { nodes { id } }
            projectUpdates(first: 1, orderBy: updatedAt) {
              nodes {
                body
                createdAt
                url
                user { name }
              }
            }
          }
        }
      }
    `, { slugId });

    const project = data.projects.nodes[0];
    if (!project) return null;

    const latestUpdateNode = project.projectUpdates?.nodes?.[0] ?? null;
    const result: LinearProjectResult = {
      id: project.id,
      name: project.name,
      status: project.state,
      health: mapHealth(project.health),
      lead: project.lead?.name ?? null,
      issueCount: project.issues.nodes.length,
      latestUpdate: latestUpdateNode
        ? {
            body: latestUpdateNode.body,
            createdAt: latestUpdateNode.createdAt,
            author: latestUpdateNode.user?.name ?? null,
            url: latestUpdateNode.url ?? null,
          }
        : null,
    };

    writeCache("linear", slugId, result);
    return result;
  } catch (e) {
    console.warn(`  [linear] Failed to fetch project ${slugId}:`, (e as Error).message);
    return null;
  }
}

async function fetchFlaggedIssues(
  projectIds: string[],
  noCache: boolean,
): Promise<LinearIssue[]> {
  if (projectIds.length === 0) return [];

  const cacheKey = `flagged-${projectIds.sort().join(",")}`;
  if (!noCache) {
    const cached = readCache<LinearIssue[]>("linear", cacheKey);
    if (cached) return cached;
  }

  try {
    const data = await graphql<{
      issues: { nodes: LinearIssueNode[] };
    }>(`
      query($projectIds: [ID!]!) {
        issues(
          filter: {
            project: { id: { in: $projectIds } }
            labels: { name: { in: ["flagged", "flag", "State (of Implementations)"] } }
          }
          first: 50
        ) {
          nodes {
            id
            identifier
            title
            state { name }
            priority
            labels { nodes { name } }
            url
            assignee { name }
            project { slugId }
          }
        }
      }
    `, { projectIds });

    const issues: LinearIssue[] = data.issues.nodes.map((i) => ({
      id: i.identifier,
      title: i.title,
      status: i.state.name,
      priority: i.priority,
      labels: i.labels.nodes.map((l) => l.name),
      url: i.url,
      assignee: i.assignee?.name ?? null,
      market: null, // resolved later by matching project slugId to revenue line
    }));

    writeCache("linear", cacheKey, issues);
    return issues;
  } catch (e) {
    console.warn(`  [linear] Failed to fetch flagged issues:`, (e as Error).message);
    return [];
  }
}

export async function fetchLinearData(
  projectSlugs: string[],
  noCache: boolean,
): Promise<ConnectorResult<LinearDataForCustomer>> {
  try {
    const allSlugs = [...projectSlugs];
    const projectResults = await Promise.all(allSlugs.map((s) => fetchProject(s, noCache)));

    const projects: Record<string, LinearProjectResult> = {};
    const projectIds: string[] = [];
    allSlugs.forEach((slug, i) => {
      if (projectResults[i]) {
        projects[slug] = projectResults[i]!;
        projectIds.push(projectResults[i]!.id);
      }
    });

    const flaggedIssues = await fetchFlaggedIssues(projectIds, noCache);

    return {
      data: { projects, flaggedIssues },
      error: null,
      source: "linear",
    };
  } catch (e) {
    return {
      data: null,
      error: (e as Error).message,
      source: "linear",
    };
  }
}

// ---------------------------------------------------------------------------
// Insight context — used by `npm run fetch-overall-sentiment`.
//
// Distinct from `fetchLinearData` (the dashboard fetch): pulls richer per-project
// fields (URL, status update narratives) plus initiatives, so the prompt can
// surface the relational texture around mechanical project state changes.
// ---------------------------------------------------------------------------

export interface LinearInsightStatusUpdate {
  id: string;
  url: string;
  createdAt: string;
  health: string | null;
  author: string | null;
  body: string;
}

export interface LinearInsightFlaggedIssue {
  identifier: string;
  title: string;
  state: string;
  url: string;
  assignee: string | null;
  /** SlugId of the project this issue belongs to, when known. */
  projectSlugId: string | null;
}

export interface LinearInsightMilestone {
  id: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  status: string | null;
  sortOrder: number;
}

export interface LinearInsightProject {
  slugId: string;
  name: string;
  url: string;
  state: string;
  health: string | null;
  /** SlugIds of initiatives this project rolls up to, if any of them were configured. */
  initiativeSlugIds: string[];
  statusUpdates: LinearInsightStatusUpdate[];
  milestones: LinearInsightMilestone[];
  flaggedIssues: LinearInsightFlaggedIssue[];
}

/** Initiative-level weekly/biweekly narrative updates (distinct from project updates). */
export interface LinearInsightInitiativeUpdate {
  id: string;
  url: string;
  createdAt: string;
  health: string | null;
  author: string | null;
  body: string;
}

export interface LinearInsightInitiative {
  slugId: string;
  name: string;
  url: string;
  status: string | null;
  /** SlugIds of the configured projects that roll up to this initiative. */
  projectSlugIds: string[];
  initiativeUpdates: LinearInsightInitiativeUpdate[];
}

export interface LinearInsightContext {
  initiatives: LinearInsightInitiative[];
  projects: LinearInsightProject[];
  /** Projects in `linear_projects` that don't roll up to any configured initiative. */
  unaffiliatedProjectSlugIds: string[];
}

/** Raw initiative update rows from Linear GraphQL (paginated until exhausted). */
type InitiativeUpdateGql = {
  id: string;
  body: string;
  createdAt: string;
  health: string;
  url: string;
  user: { name: string };
};

type ProjectUpdateGql = {
  id: string;
  body: string;
  createdAt: string;
  health: string | null;
  url: string;
  user: { name: string } | null;
};

type ProjectMilestoneGql = {
  id: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  status: string | null;
  sortOrder: number;
};

interface InitiativeInsightApiNode {
  id: string;
  slugId: string;
  name: string;
  url: string;
  status: string | null;
  projects: { nodes: { slugId: string }[] };
  initiativeUpdates: { nodes: InitiativeUpdateGql[] };
}

interface ProjectInsightApiNode {
  id: string;
  slugId: string;
  name: string;
  url: string;
  state: string;
  health: string | null;
  projectUpdates: { nodes: ProjectUpdateGql[] };
  projectMilestones: { nodes: ProjectMilestoneGql[] };
}

interface FlaggedInsightIssueNode {
  identifier: string;
  title: string;
  state: { name: string };
  url: string;
  assignee: { name: string } | null;
  project: { slugId: string } | null;
}

async function paginateInitiativeUpdates(initiativeUuid: string): Promise<InitiativeUpdateGql[]> {
  const nodes: InitiativeUpdateGql[] = [];
  let after: string | null = null;
  for (let page = 0; page < LINEAR_MAX_PAGES; page++) {
    const data: {
      initiative: {
        initiativeUpdates: {
          pageInfo: RelayPageInfo;
          nodes: InitiativeUpdateGql[];
        };
      } | null;
    } = await graphql(
      `
        query($id: String!, $after: String, $first: Int!) {
          initiative(id: $id) {
            initiativeUpdates(first: $first, after: $after, orderBy: updatedAt) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                body
                createdAt
                health
                url
                user { name }
              }
            }
          }
        }
      `,
      { id: initiativeUuid, after, first: LINEAR_PAGE_SIZE },
    );
    const conn = data.initiative?.initiativeUpdates;
    if (!conn) break;
    nodes.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }
  return nodes;
}

async function paginateProjectUpdates(projectUuid: string): Promise<ProjectUpdateGql[]> {
  const nodes: ProjectUpdateGql[] = [];
  let after: string | null = null;
  for (let page = 0; page < LINEAR_MAX_PAGES; page++) {
    const data: {
      project: {
        projectUpdates: {
          pageInfo: RelayPageInfo;
          nodes: ProjectUpdateGql[];
        };
      } | null;
    } = await graphql(
      `
        query($id: String!, $after: String, $first: Int!) {
          project(id: $id) {
            projectUpdates(first: $first, after: $after, orderBy: updatedAt) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                body
                createdAt
                health
                url
                user { name }
              }
            }
          }
        }
      `,
      { id: projectUuid, after, first: LINEAR_PAGE_SIZE },
    );
    const conn = data.project?.projectUpdates;
    if (!conn) break;
    nodes.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }
  return nodes;
}

async function paginateProjectMilestones(projectUuid: string): Promise<ProjectMilestoneGql[]> {
  const nodes: ProjectMilestoneGql[] = [];
  let after: string | null = null;
  for (let page = 0; page < LINEAR_MAX_PAGES; page++) {
    const data: {
      project: {
        projectMilestones: {
          pageInfo: RelayPageInfo;
          nodes: ProjectMilestoneGql[];
        };
      } | null;
    } = await graphql(
      `
        query($id: String!, $after: String, $first: Int!) {
          project(id: $id) {
            projectMilestones(first: $first, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                name
                description
                targetDate
                status
                sortOrder
              }
            }
          }
        }
      `,
      { id: projectUuid, after, first: LINEAR_PAGE_SIZE },
    );
    const conn = data.project?.projectMilestones;
    if (!conn) break;
    nodes.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }
  return nodes;
}

async function fetchInitiativeInsight(
  slugId: string,
  noCache: boolean,
): Promise<InitiativeInsightApiNode | null> {
  const cacheKey = `insight-initiative-${slugId}`;
  if (!noCache) {
    const cached = readCache<InitiativeInsightApiNode>("linear", cacheKey);
    if (cached) return cached;
  }

  try {
    const data: {
      initiatives: {
        nodes: Pick<
          InitiativeInsightApiNode,
          "id" | "slugId" | "name" | "url" | "status" | "projects"
        >[];
      };
    } = await graphql(
      `
        query($slugId: String!) {
          initiatives(filter: { slugId: { eq: $slugId } }, first: 1) {
            nodes {
              id
              slugId
              name
              url
              status
              projects(first: 100) {
                nodes { slugId }
              }
            }
          }
        }
      `,
      { slugId },
    );
    const base = data.initiatives.nodes[0] ?? null;
    if (!base) return null;

    const updateNodes = await paginateInitiativeUpdates(base.id);
    const node: InitiativeInsightApiNode = {
      ...base,
      initiativeUpdates: { nodes: updateNodes },
    };
    writeCache("linear", cacheKey, node);
    return node;
  } catch (e) {
    console.warn(
      `  [linear] Failed to fetch initiative ${slugId}:`,
      (e as Error).message,
    );
    return null;
  }
}

async function fetchProjectInsight(
  slugId: string,
  noCache: boolean,
): Promise<ProjectInsightApiNode | null> {
  const cacheKey = `insight-project-${slugId}`;
  if (!noCache) {
    const cached = readCache<ProjectInsightApiNode>("linear", cacheKey);
    if (cached) return cached;
  }

  try {
    const data: {
      projects: {
        nodes: Pick<
          ProjectInsightApiNode,
          "id" | "slugId" | "name" | "url" | "state" | "health"
        >[];
      };
    } = await graphql(
      `
        query($slugId: String!) {
          projects(filter: { slugId: { eq: $slugId } }, first: 1) {
            nodes {
              id
              slugId
              name
              url
              state
              health
            }
          }
        }
      `,
      { slugId },
    );
    const base = data.projects.nodes[0] ?? null;
    if (!base) return null;

    const [updateNodes, milestoneNodes] = await Promise.all([
      paginateProjectUpdates(base.id),
      paginateProjectMilestones(base.id),
    ]);

    const node: ProjectInsightApiNode = {
      ...base,
      projectUpdates: { nodes: updateNodes },
      projectMilestones: { nodes: milestoneNodes },
    };
    writeCache("linear", cacheKey, node);
    return node;
  } catch (e) {
    console.warn(
      `  [linear] Failed to fetch project insight ${slugId}:`,
      (e as Error).message,
    );
    return null;
  }
}

async function fetchFlaggedIssuesForInsight(
  projectIds: string[],
  noCache: boolean,
): Promise<FlaggedInsightIssueNode[]> {
  if (projectIds.length === 0) return [];
  const cacheKey = `insight-flagged-${projectIds.slice().sort().join(",")}`;
  if (!noCache) {
    const cached = readCache<FlaggedInsightIssueNode[]>("linear", cacheKey);
    if (cached) return cached;
  }

  try {
    const nodes: FlaggedInsightIssueNode[] = [];
    let after: string | null = null;
    for (let page = 0; page < LINEAR_MAX_PAGES; page++) {
      const data: {
        issues: {
          pageInfo: RelayPageInfo;
          nodes: FlaggedInsightIssueNode[];
        };
      } = await graphql(
        `
          query($projectIds: [ID!]!, $after: String, $first: Int!) {
            issues(
              filter: {
                project: { id: { in: $projectIds } }
                labels: { name: { in: ["flagged", "flag", "State (of Implementations)"] } }
              }
              first: $first
              after: $after
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                identifier
                title
                state { name }
                url
                assignee { name }
                project { slugId }
              }
            }
          }
        `,
        { projectIds, after, first: LINEAR_PAGE_SIZE },
      );
      nodes.push(...data.issues.nodes);
      if (!data.issues.pageInfo.hasNextPage || !data.issues.pageInfo.endCursor) break;
      after = data.issues.pageInfo.endCursor;
    }
    writeCache("linear", cacheKey, nodes);
    return nodes;
  } catch (e) {
    console.warn(
      `  [linear] Failed to fetch flagged issues (insight):`,
      (e as Error).message,
    );
    return [];
  }
}

export interface LinearInsightFetchOptions {
  projectSlugs: string[];
  initiativeSlugs: string[];
  lookbackDays: number;
  noCache: boolean;
}

export async function fetchLinearInsightContext(
  opts: LinearInsightFetchOptions,
): Promise<ConnectorResult<LinearInsightContext>> {
  try {
    void opts.lookbackDays; // Slack/overall-sentiment metadata only; Linear export is not date-trimmed.

    const [initiativeNodes, projectNodes] = await Promise.all([
      Promise.all(opts.initiativeSlugs.map((s) => fetchInitiativeInsight(s, opts.noCache))),
      Promise.all(opts.projectSlugs.map((s) => fetchProjectInsight(s, opts.noCache))),
    ]);

    /* slug → list of configured initiatives it belongs to (intersection only — we
       deliberately ignore initiatives that weren't listed in customers/<slug>.json). */
    const projectToInitiatives = new Map<string, string[]>();
    const initiatives: LinearInsightInitiative[] = [];
    for (const node of initiativeNodes) {
      if (!node) continue;
      const memberSlugs = (node.projects.nodes ?? []).map((p) => p.slugId);
      const configuredMembers = memberSlugs.filter((s) => opts.projectSlugs.includes(s));
      const initiativeUpdatesAll = (node.initiativeUpdates?.nodes ?? [])
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((u): LinearInsightInitiativeUpdate => ({
          id: u.id,
          url: u.url,
          createdAt: u.createdAt,
          health: u.health ?? null,
          author: u.user?.name ?? null,
          body: (u.body ?? "").trim(),
        }));

      initiatives.push({
        slugId: node.slugId,
        name: node.name,
        url: node.url,
        status: node.status,
        projectSlugIds: configuredMembers,
        initiativeUpdates: initiativeUpdatesAll,
      });
      for (const s of configuredMembers) {
        const existing = projectToInitiatives.get(s) ?? [];
        if (!existing.includes(node.slugId)) existing.push(node.slugId);
        projectToInitiatives.set(s, existing);
      }
    }

    const validProjectIds: string[] = [];
    const projectMeta: { node: ProjectInsightApiNode; initiativeSlugIds: string[] }[] = [];
    for (const node of projectNodes) {
      if (!node) continue;
      validProjectIds.push(node.id);
      projectMeta.push({
        node,
        initiativeSlugIds: projectToInitiatives.get(node.slugId) ?? [],
      });
    }

    const flagged = await fetchFlaggedIssuesForInsight(validProjectIds, opts.noCache);
    const flaggedByProject = new Map<string, LinearInsightFlaggedIssue[]>();
    for (const issue of flagged) {
      const slugId = issue.project?.slugId ?? null;
      const row: LinearInsightFlaggedIssue = {
        identifier: issue.identifier,
        title: issue.title,
        state: issue.state.name,
        url: issue.url,
        assignee: issue.assignee?.name ?? null,
        projectSlugId: slugId,
      };
      const key = slugId ?? "__unknown__";
      const existing = flaggedByProject.get(key) ?? [];
      existing.push(row);
      flaggedByProject.set(key, existing);
    }

    const projects: LinearInsightProject[] = projectMeta.map(({ node, initiativeSlugIds }) => {
      const statusUpdatesAll = node.projectUpdates.nodes
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((u): LinearInsightStatusUpdate => ({
          id: u.id,
          url: u.url,
          createdAt: u.createdAt,
          health: u.health,
          author: u.user?.name ?? null,
          body: (u.body ?? "").trim(),
        }));

      const milestonesSorted = [...(node.projectMilestones?.nodes ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const milestones: LinearInsightMilestone[] = milestonesSorted.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description?.trim() ? m.description.trim() : null,
        targetDate: m.targetDate,
        status: m.status,
        sortOrder: m.sortOrder,
      }));

      return {
        slugId: node.slugId,
        name: node.name,
        url: node.url,
        state: node.state,
        health: node.health,
        initiativeSlugIds,
        statusUpdates: statusUpdatesAll,
        milestones,
        flaggedIssues: flaggedByProject.get(node.slugId) ?? [],
      };
    });

    const unaffiliated = projects
      .filter((p) => p.initiativeSlugIds.length === 0)
      .map((p) => p.slugId);

    return {
      data: {
        initiatives,
        projects,
        unaffiliatedProjectSlugIds: unaffiliated,
      },
      error: null,
      source: "linear",
    };
  } catch (e) {
    return { data: null, error: (e as Error).message, source: "linear" };
  }
}
