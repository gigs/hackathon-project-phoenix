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
            labels: { name: { in: ["flagged", "flag"] } }
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

export interface LinearInsightProject {
  slugId: string;
  name: string;
  url: string;
  state: string;
  health: string | null;
  /** SlugIds of initiatives this project rolls up to, if any of them were configured. */
  initiativeSlugIds: string[];
  statusUpdates: LinearInsightStatusUpdate[];
  flaggedIssues: LinearInsightFlaggedIssue[];
}

export interface LinearInsightInitiative {
  slugId: string;
  name: string;
  url: string;
  status: string | null;
  /** SlugIds of the configured projects that roll up to this initiative. */
  projectSlugIds: string[];
}

export interface LinearInsightContext {
  initiatives: LinearInsightInitiative[];
  projects: LinearInsightProject[];
  /** Projects in `linear_projects` that don't roll up to any configured initiative. */
  unaffiliatedProjectSlugIds: string[];
}

interface InitiativeNode {
  id: string;
  slugId: string;
  name: string;
  url: string;
  status: string | null;
  projects: { nodes: { slugId: string }[] };
}

interface ProjectInsightNode {
  id: string;
  slugId: string;
  name: string;
  url: string;
  state: string;
  health: string | null;
  projectUpdates: {
    nodes: {
      id: string;
      body: string;
      createdAt: string;
      health: string | null;
      url: string;
      user: { name: string } | null;
    }[];
  };
}

interface FlaggedInsightIssueNode {
  identifier: string;
  title: string;
  state: { name: string };
  url: string;
  assignee: { name: string } | null;
  project: { slugId: string } | null;
}

async function fetchInitiativeInsight(
  slugId: string,
  noCache: boolean,
): Promise<InitiativeNode | null> {
  const cacheKey = `insight-initiative-${slugId}`;
  if (!noCache) {
    const cached = readCache<InitiativeNode>("linear", cacheKey);
    if (cached) return cached;
  }

  try {
    const data = await graphql<{ initiatives: { nodes: InitiativeNode[] } }>(
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
    const node = data.initiatives.nodes[0] ?? null;
    if (node) writeCache("linear", cacheKey, node);
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
): Promise<ProjectInsightNode | null> {
  const cacheKey = `insight-project-${slugId}`;
  if (!noCache) {
    const cached = readCache<ProjectInsightNode>("linear", cacheKey);
    if (cached) return cached;
  }

  try {
    const data = await graphql<{ projects: { nodes: ProjectInsightNode[] } }>(
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
              projectUpdates(first: 25, orderBy: updatedAt) {
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
        }
      `,
      { slugId },
    );
    const node = data.projects.nodes[0] ?? null;
    if (node) writeCache("linear", cacheKey, node);
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
    const data = await graphql<{ issues: { nodes: FlaggedInsightIssueNode[] } }>(
      `
        query($projectIds: [ID!]!) {
          issues(
            filter: {
              project: { id: { in: $projectIds } }
              labels: { name: { in: ["flagged", "flag"] } }
            }
            first: 100
          ) {
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
      { projectIds },
    );
    writeCache("linear", cacheKey, data.issues.nodes);
    return data.issues.nodes;
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
    const cutoff = Date.now() - opts.lookbackDays * 24 * 60 * 60 * 1000;

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
      initiatives.push({
        slugId: node.slugId,
        name: node.name,
        url: node.url,
        status: node.status,
        projectSlugIds: configuredMembers,
      });
      for (const s of configuredMembers) {
        const existing = projectToInitiatives.get(s) ?? [];
        if (!existing.includes(node.slugId)) existing.push(node.slugId);
        projectToInitiatives.set(s, existing);
      }
    }

    const validProjectIds: string[] = [];
    const projectMeta: { node: ProjectInsightNode; initiativeSlugIds: string[] }[] = [];
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
      const updatesInWindow = node.projectUpdates.nodes
        .filter((u) => {
          const ts = Date.parse(u.createdAt);
          return Number.isFinite(ts) && ts >= cutoff;
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((u): LinearInsightStatusUpdate => ({
          id: u.id,
          url: u.url,
          createdAt: u.createdAt,
          health: u.health,
          author: u.user?.name ?? null,
          body: (u.body ?? "").trim(),
        }));

      return {
        slugId: node.slugId,
        name: node.name,
        url: node.url,
        state: node.state,
        health: node.health,
        initiativeSlugIds,
        statusUpdates: updatesInWindow,
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
