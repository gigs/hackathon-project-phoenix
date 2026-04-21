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
          }
        }
      }
    `, { slugId });

    const project = data.projects.nodes[0];
    if (!project) return null;

    const result: LinearProjectResult = {
      id: project.id,
      name: project.name,
      status: project.state,
      health: mapHealth(project.health),
      lead: project.lead?.name ?? null,
      issueCount: project.issues.nodes.length,
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
