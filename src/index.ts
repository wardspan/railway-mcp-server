#!/usr/bin/env node

/**
 * Railway MCP Server
 * Provides full Railway.app management via the Model Context Protocol.
 *
 * Set RAILWAY_API_TOKEN env var before running.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MultiRailwayClient } from "./railway-client.js";

// ─── Bootstrap ───────────────────────────────────────────────
// Supports multiple workspace tokens:
//   RAILWAY_API_TOKEN          — single token (backwards compat)
//   RAILWAY_API_TOKENS         — comma-separated list of tokens
//   RAILWAY_TOKEN_<LABEL>      — named tokens (e.g. RAILWAY_TOKEN_ALTGREEN, RAILWAY_TOKEN_PERSONAL)

function loadTokens(): { token: string; label: string }[] {
  const tokens: { token: string; label: string }[] = [];

  // Check for named tokens: RAILWAY_TOKEN_*
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("RAILWAY_TOKEN_") && value) {
      const label = key.replace("RAILWAY_TOKEN_", "").toLowerCase().replace(/_/g, " ");
      tokens.push({ token: value, label });
    }
  }

  // Check for comma-separated tokens
  if (tokens.length === 0 && process.env.RAILWAY_API_TOKENS) {
    const parts = process.env.RAILWAY_API_TOKENS.split(",").map((t) => t.trim()).filter(Boolean);
    parts.forEach((t, i) => tokens.push({ token: t, label: `workspace-${i + 1}` }));
  }

  // Fall back to single token
  if (tokens.length === 0 && process.env.RAILWAY_API_TOKEN) {
    tokens.push({ token: process.env.RAILWAY_API_TOKEN, label: "default" });
  }

  return tokens;
}

const tokens = loadTokens();
if (tokens.length === 0) {
  console.error(
    "ERROR: No Railway API tokens found.\n" +
      "Set one or more of:\n" +
      "  RAILWAY_API_TOKEN          — single token\n" +
      "  RAILWAY_API_TOKENS         — comma-separated tokens\n" +
      "  RAILWAY_TOKEN_<LABEL>      — named tokens (e.g. RAILWAY_TOKEN_ALTGREEN)\n" +
      "Get tokens at https://railway.com/account/tokens"
  );
  process.exit(1);
}

console.error(`Railway MCP: loaded ${tokens.length} workspace token(s): ${tokens.map((t) => t.label).join(", ")}`);
const railway = new MultiRailwayClient(tokens);

const server = new McpServer({
  name: "railway",
  version: "1.0.0",
});

// ─── Helper ──────────────────────────────────────────────────

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function err(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TEAMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "list_teams",
  "List all teams/organizations you belong to",
  {},
  async () => {
    try {
      return ok(await railway.listTeams());
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PROJECTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "list_projects",
  "List ALL Railway projects — both personal and from all teams/orgs. Returns projects grouped by personal vs each team.",
  {},
  async () => {
    try {
      return ok(await railway.listAllProjects());
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "list_personal_projects",
  "List only your personal Railway projects",
  {},
  async () => {
    try {
      return ok(await railway.listPersonalProjects());
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "list_team_projects",
  "List projects for a specific team/organization",
  {
    teamId: z.string().describe("The team ID"),
  },
  async ({ teamId }) => {
    try {
      return ok(await railway.listTeamProjects(teamId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_project",
  "Get details of a specific Railway project",
  {
    projectId: z.string().describe("The Railway project ID"),
  },
  async ({ projectId }) => {
    try {
      return ok(await railway.getProject(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_project",
  "Create a new Railway project",
  {
    name: z.string().describe("Name for the new project"),
    description: z
      .string()
      .optional()
      .describe("Optional project description"),
  },
  async ({ name, description }) => {
    try {
      return ok(await railway.createProject(name, description));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "delete_project",
  "Delete a Railway project (irreversible!)",
  {
    projectId: z.string().describe("The project ID to delete"),
  },
  async ({ projectId }) => {
    try {
      return ok(await railway.deleteProject(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SERVICES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "list_services",
  "List all services in a Railway project",
  {
    projectId: z.string().describe("The project ID"),
  },
  async ({ projectId }) => {
    try {
      return ok(await railway.listServices(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_service",
  "Create a new service in a project (from GitHub repo or Docker image)",
  {
    projectId: z.string().describe("The project ID"),
    name: z.string().describe("Name for the new service"),
    repo: z
      .string()
      .optional()
      .describe("GitHub repo in 'owner/repo' format (e.g. 'user/my-app')"),
    image: z
      .string()
      .optional()
      .describe("Docker image (e.g. 'redis:7-alpine', 'postgres:16')"),
  },
  async ({ projectId, name, repo, image }) => {
    try {
      const source: { repo?: string; image?: string } = {};
      if (repo) source.repo = repo;
      if (image) source.image = image;
      return ok(
        await railway.createService(
          projectId,
          name,
          Object.keys(source).length > 0 ? source : undefined
        )
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "delete_service",
  "Delete a service from a project",
  {
    serviceId: z.string().describe("The service ID to delete"),
  },
  async ({ serviceId }) => {
    try {
      return ok(await railway.deleteService(serviceId));
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DEPLOYMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "list_deployments",
  "List deployments for a service in an environment",
  {
    projectId: z.string().describe("The project ID"),
    serviceId: z.string().describe("The service ID"),
    environmentId: z.string().describe("The environment ID"),
  },
  async ({ projectId, serviceId, environmentId }) => {
    try {
      return ok(
        await railway.listDeployments(projectId, serviceId, environmentId)
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_deployment",
  "Get details of a specific deployment",
  {
    deploymentId: z.string().describe("The deployment ID"),
  },
  async ({ deploymentId }) => {
    try {
      return ok(await railway.getDeployment(deploymentId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "deploy_service",
  "Trigger a new deployment for a service",
  {
    serviceId: z.string().describe("The service ID to deploy"),
    environmentId: z.string().describe("The environment ID to deploy to"),
  },
  async ({ serviceId, environmentId }) => {
    try {
      return ok(await railway.deployService(serviceId, environmentId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "redeploy_service",
  "Redeploy the latest deployment of a service",
  {
    serviceId: z.string().describe("The service ID to redeploy"),
    environmentId: z.string().describe("The environment ID"),
  },
  async ({ serviceId, environmentId }) => {
    try {
      return ok(await railway.redeploy(serviceId, environmentId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "restart_deployment",
  "Restart a specific deployment",
  {
    deploymentId: z.string().describe("The deployment ID to restart"),
  },
  async ({ deploymentId }) => {
    try {
      return ok(await railway.restartDeployment(deploymentId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "remove_deployment",
  "Remove/cancel a specific deployment",
  {
    deploymentId: z.string().describe("The deployment ID to remove"),
  },
  async ({ deploymentId }) => {
    try {
      return ok(await railway.removeDeployment(deploymentId));
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ENVIRONMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "list_environments",
  "List all environments in a project",
  {
    projectId: z.string().describe("The project ID"),
  },
  async ({ projectId }) => {
    try {
      return ok(await railway.listEnvironments(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_environment",
  "Create a new environment in a project",
  {
    projectId: z.string().describe("The project ID"),
    name: z.string().describe("Name for the new environment (e.g. 'staging')"),
  },
  async ({ projectId, name }) => {
    try {
      return ok(await railway.createEnvironment(projectId, name));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "delete_environment",
  "Delete an environment from a project",
  {
    environmentId: z.string().describe("The environment ID to delete"),
  },
  async ({ environmentId }) => {
    try {
      return ok(await railway.deleteEnvironment(environmentId));
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  VARIABLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "get_variables",
  "Get environment variables for a service",
  {
    projectId: z.string().describe("The project ID"),
    environmentId: z.string().describe("The environment ID"),
    serviceId: z
      .string()
      .optional()
      .describe("The service ID (omit for shared/project-level variables)"),
  },
  async ({ projectId, environmentId, serviceId }) => {
    try {
      return ok(
        await railway.getVariables(projectId, environmentId, serviceId)
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "set_variables",
  "Set one or more environment variables (upsert)",
  {
    projectId: z.string().describe("The project ID"),
    environmentId: z.string().describe("The environment ID"),
    serviceId: z.string().describe("The service ID"),
    variables: z
      .string()
      .describe(
        'JSON object of key-value pairs, e.g. {"PORT":"3000","NODE_ENV":"production"}'
      ),
  },
  async ({ projectId, environmentId, serviceId, variables }) => {
    try {
      const vars = JSON.parse(variables);
      return ok(
        await railway.upsertVariables(
          projectId,
          environmentId,
          serviceId,
          vars
        )
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "delete_variable",
  "Delete a single environment variable",
  {
    projectId: z.string().describe("The project ID"),
    environmentId: z.string().describe("The environment ID"),
    serviceId: z.string().describe("The service ID"),
    name: z.string().describe("The variable name to delete"),
  },
  async ({ projectId, environmentId, serviceId, name }) => {
    try {
      return ok(
        await railway.deleteVariable(projectId, environmentId, serviceId, name)
      );
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DOMAINS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "create_service_domain",
  "Generate a Railway-provided domain (*.up.railway.app) for a service",
  {
    serviceId: z.string().describe("The service ID"),
    environmentId: z.string().describe("The environment ID"),
  },
  async ({ serviceId, environmentId }) => {
    try {
      return ok(
        await railway.createServiceDomain(serviceId, environmentId)
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_custom_domain",
  "Attach a custom domain to a service",
  {
    serviceId: z.string().describe("The service ID"),
    environmentId: z.string().describe("The environment ID"),
    domain: z.string().describe("The custom domain (e.g. 'api.example.com')"),
  },
  async ({ serviceId, environmentId, domain }) => {
    try {
      return ok(
        await railway.createCustomDomain(serviceId, environmentId, domain)
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "delete_service_domain",
  "Remove the Railway-provided domain from a service",
  {
    serviceId: z.string().describe("The service ID"),
    environmentId: z.string().describe("The environment ID"),
  },
  async ({ serviceId, environmentId }) => {
    try {
      return ok(
        await railway.deleteServiceDomain(environmentId, serviceId)
      );
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LOGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "get_deployment_logs",
  "Get runtime/application logs for a deployment",
  {
    deploymentId: z.string().describe("The deployment ID"),
    limit: z
      .number()
      .optional()
      .default(100)
      .describe("Max number of log lines (default 100)"),
  },
  async ({ deploymentId, limit }) => {
    try {
      return ok(await railway.getDeploymentLogs(deploymentId, limit));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_build_logs",
  "Get build logs for a deployment",
  {
    deploymentId: z.string().describe("The deployment ID"),
  },
  async ({ deploymentId }) => {
    try {
      return ok(await railway.getBuildLogs(deploymentId));
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  VOLUMES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "create_volume",
  "Create a persistent volume attached to a service",
  {
    projectId: z.string().describe("The project ID"),
    environmentId: z.string().describe("The environment ID"),
    serviceId: z.string().describe("The service ID to attach the volume to"),
    mountPath: z.string().describe("Mount path inside the container (e.g. '/data')"),
  },
  async ({ projectId, environmentId, serviceId, mountPath }) => {
    try {
      return ok(
        await railway.createVolume(
          projectId,
          environmentId,
          serviceId,
          mountPath
        )
      );
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RAW QUERY (escape hatch)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "raw_graphql",
  "Execute an arbitrary GraphQL query/mutation against Railway's API. Use this for operations not covered by other tools.",
  {
    query: z
      .string()
      .describe("The full GraphQL query or mutation string"),
    variables: z
      .string()
      .optional()
      .describe("JSON string of variables (e.g. '{\"id\": \"abc123\"}')"),
  },
  async ({ query, variables }) => {
    try {
      return ok(await railway.rawQuery(query, variables));
    } catch (e) {
      return err(e);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INTROSPECT (schema discovery)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "introspect_schema",
  "Fetch the full Railway GraphQL schema. Useful for discovering available operations beyond the built-in tools.",
  {},
  async () => {
    try {
      return ok(await railway.introspect());
    } catch (e) {
      return err(e);
    }
  }
);

// ─── Start Server ────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error("Failed to start Railway MCP server:", error);
  process.exit(1);
});
