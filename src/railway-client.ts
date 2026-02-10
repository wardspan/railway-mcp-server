/**
 * Railway GraphQL API Client
 * Wraps Railway's public GraphQL API at backboard.railway.com/graphql/v2
 */

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

export class RailwayClient {
  private token: string;
  public label: string;

  constructor(token: string, label?: string) {
    this.token = token;
    this.label = label || "default";
  }

  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Railway API error (${response.status}): ${text}`
      );
    }

    const json = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`
      );
    }

    return json.data as T;
  }

  // ─── Teams ─────────────────────────────────────────────────

  async listTeams() {
    return this.query(`
      query {
        me {
          teams {
            edges {
              node {
                id
                name
                avatar
                createdAt
              }
            }
          }
        }
      }
    `);
  }

  // ─── Projects ──────────────────────────────────────────────

  async listPersonalProjects() {
    return this.query(`
      query {
        me {
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                updatedAt
                environments {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
                services {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);
  }

  async listTeamProjects(teamId: string) {
    return this.query(
      `
      query ($teamId: String!) {
        team(id: $teamId) {
          id
          name
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                updatedAt
                environments {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
                services {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
      { teamId }
    );
  }

  async listAllProjects() {
    // First get teams, then fetch all projects in parallel
    const teamsResult = await this.listTeams() as any;
    const teams = teamsResult?.me?.teams?.edges?.map((e: any) => e.node) || [];

    const personalResult = await this.listPersonalProjects() as any;
    const personalProjects =
      personalResult?.me?.projects?.edges?.map((e: any) => e.node) || [];

    const teamResults = await Promise.all(
      teams.map(async (team: any) => {
        const result = await this.listTeamProjects(team.id) as any;
        return {
          teamId: team.id,
          teamName: team.name,
          projects:
            result?.team?.projects?.edges?.map((e: any) => e.node) || [],
        };
      })
    );

    return {
      personal: personalProjects,
      teams: teamResults,
    };
  }

  async getProject(projectId: string) {
    return this.query(
      `
      query ($id: String!) {
        project(id: $id) {
          id
          name
          description
          createdAt
          updatedAt
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
          services {
            edges {
              node {
                id
                name
                icon
              }
            }
          }
        }
      }
    `,
      { id: projectId }
    );
  }

  async createProject(name: string, description?: string) {
    return this.query(
      `
      mutation ($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
        }
      }
    `,
      { input: { name, description } }
    );
  }

  async deleteProject(projectId: string) {
    return this.query(
      `
      mutation ($id: String!) {
        projectDelete(id: $id)
      }
    `,
      { id: projectId }
    );
  }

  // ─── Services ──────────────────────────────────────────────

  async listServices(projectId: string) {
    return this.query(
      `
      query ($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                icon
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `,
      { projectId }
    );
  }

  async createService(
    projectId: string,
    name: string,
    source?: { repo?: string; image?: string }
  ) {
    return this.query(
      `
      mutation ($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `,
      { input: { projectId, name, source } }
    );
  }

  async deleteService(serviceId: string) {
    return this.query(
      `
      mutation ($id: String!) {
        serviceDelete(id: $id)
      }
    `,
      { id: serviceId }
    );
  }

  // ─── Deployments ───────────────────────────────────────────

  async listDeployments(
    projectId: string,
    serviceId: string,
    environmentId: string
  ) {
    return this.query(
      `
      query ($input: DeploymentListInput!) {
        deployments(input: $input) {
          edges {
            node {
              id
              status
              createdAt
              updatedAt
              staticUrl
              meta
            }
          }
        }
      }
    `,
      {
        input: { projectId, serviceId, environmentId },
      }
    );
  }

  async getDeployment(deploymentId: string) {
    return this.query(
      `
      query ($id: String!) {
        deployment(id: $id) {
          id
          status
          createdAt
          updatedAt
          staticUrl
          meta
          canRedeploy
        }
      }
    `,
      { id: deploymentId }
    );
  }

  async redeploy(
    serviceId: string,
    environmentId: string
  ) {
    return this.query(
      `
      mutation ($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(
          serviceId: $serviceId
          environmentId: $environmentId
        )
      }
    `,
      { serviceId, environmentId }
    );
  }

  async deployService(
    serviceId: string,
    environmentId: string
  ) {
    return this.query(
      `
      mutation ($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeployV2(
          serviceId: $serviceId
          environmentId: $environmentId
        ) {
          id
          status
        }
      }
    `,
      { serviceId, environmentId }
    );
  }

  async removeDeployment(deploymentId: string) {
    return this.query(
      `
      mutation ($id: String!) {
        deploymentRemove(id: $id)
      }
    `,
      { id: deploymentId }
    );
  }

  async restartDeployment(deploymentId: string) {
    return this.query(
      `
      mutation ($id: String!) {
        deploymentRestart(id: $id)
      }
    `,
      { id: deploymentId }
    );
  }

  // ─── Environments ──────────────────────────────────────────

  async listEnvironments(projectId: string) {
    return this.query(
      `
      query ($projectId: String!) {
        project(id: $projectId) {
          environments {
            edges {
              node {
                id
                name
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `,
      { projectId }
    );
  }

  async createEnvironment(projectId: string, name: string) {
    return this.query(
      `
      mutation ($input: EnvironmentCreateInput!) {
        environmentCreate(input: $input) {
          id
          name
        }
      }
    `,
      { input: { projectId, name } }
    );
  }

  async deleteEnvironment(environmentId: string) {
    return this.query(
      `
      mutation ($id: String!) {
        environmentDelete(id: $id)
      }
    `,
      { id: environmentId }
    );
  }

  // ─── Variables ─────────────────────────────────────────────

  async getVariables(
    projectId: string,
    environmentId: string,
    serviceId?: string
  ) {
    return this.query(
      `
      query ($projectId: String!, $environmentId: String!, $serviceId: String) {
        variables(
          projectId: $projectId
          environmentId: $environmentId
          serviceId: $serviceId
        )
      }
    `,
      { projectId, environmentId, serviceId }
    );
  }

  async upsertVariables(
    projectId: string,
    environmentId: string,
    serviceId: string,
    variables: Record<string, string>
  ) {
    return this.query(
      `
      mutation ($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `,
      {
        input: { projectId, environmentId, serviceId, variables },
      }
    );
  }

  async deleteVariable(
    projectId: string,
    environmentId: string,
    serviceId: string,
    name: string
  ) {
    return this.query(
      `
      mutation ($input: VariableDeleteInput!) {
        variableDelete(input: $input)
      }
    `,
      {
        input: { projectId, environmentId, serviceId, name },
      }
    );
  }

  // ─── Domains ───────────────────────────────────────────────

  async createServiceDomain(
    serviceId: string,
    environmentId: string
  ) {
    return this.query(
      `
      mutation ($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) {
          id
          domain
          serviceId
        }
      }
    `,
      {
        input: { serviceId, environmentId },
      }
    );
  }

  async createCustomDomain(
    serviceId: string,
    environmentId: string,
    domain: string
  ) {
    return this.query(
      `
      mutation ($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status {
            dnsRecords {
              requiredValue
              currentValue
              status
            }
          }
        }
      }
    `,
      {
        input: { serviceId, environmentId, domain },
      }
    );
  }

  async deleteServiceDomain(
    environmentId: string,
    serviceId: string
  ) {
    return this.query(
      `
      mutation ($environmentId: String!, $serviceId: String!) {
        serviceDomainDelete(
          environmentId: $environmentId
          serviceId: $serviceId
        )
      }
    `,
      { environmentId, serviceId }
    );
  }

  // ─── Logs ──────────────────────────────────────────────────

  async getDeploymentLogs(
    deploymentId: string,
    limit: number = 100
  ) {
    return this.query(
      `
      query ($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          message
          severity
        }
      }
    `,
      { deploymentId, limit }
    );
  }

  async getBuildLogs(deploymentId: string) {
    return this.query(
      `
      query ($deploymentId: String!) {
        buildLogs(deploymentId: $deploymentId) {
          timestamp
          message
        }
      }
    `,
      { deploymentId }
    );
  }

  // ─── Volumes ───────────────────────────────────────────────

  async createVolume(
    projectId: string,
    environmentId: string,
    serviceId: string,
    mountPath: string
  ) {
    return this.query(
      `
      mutation ($input: VolumeCreateInput!) {
        volumeCreate(input: $input) {
          id
          name
        }
      }
    `,
      {
        input: { projectId, environmentId, serviceId, mountPath },
      }
    );
  }

  // ─── Introspect ────────────────────────────────────────────

  async introspect() {
    return this.query(`
      query {
        __schema {
          queryType { name }
          mutationType { name }
          types {
            name
            kind
            fields {
              name
              description
              args {
                name
                type { name kind }
              }
            }
          }
        }
      }
    `);
  }

  // ─── Raw Query (escape hatch) ──────────────────────────────

  async rawQuery(query: string, variables?: string) {
    const vars = variables ? JSON.parse(variables) : undefined;
    return this.query(query, vars);
  }

  // ─── Workspace Info ────────────────────────────────────────

  async getTokenWorkspace(): Promise<string> {
    const result = (await this.query(`
      query {
        me {
          name
          email
          teams {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `)) as any;
    const teams = result?.me?.teams?.edges?.map((e: any) => e.node) || [];
    const teamNames = teams.map((t: any) => t.name).join(", ");
    return `${result?.me?.name || "Unknown"} (teams: ${teamNames || "none"})`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MultiRailwayClient — merges results across workspace tokens
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class MultiRailwayClient {
  public clients: RailwayClient[];

  constructor(tokens: { token: string; label: string }[]) {
    this.clients = tokens.map((t) => new RailwayClient(t.token, t.label));
  }

  /** Try a query against each client until one succeeds (for ID-based lookups) */
  private async tryEach<T>(fn: (client: RailwayClient) => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (const client of this.clients) {
      try {
        return await fn(client);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError || new Error("No clients available");
  }

  /** Run a query against all clients and collect results */
  private async fromAll<T>(fn: (client: RailwayClient) => Promise<T>): Promise<{ workspace: string; data: T }[]> {
    const results = await Promise.allSettled(
      this.clients.map(async (client) => ({
        workspace: client.label,
        data: await fn(client),
      }))
    );
    const fulfilled: { workspace: string; data: T }[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        fulfilled.push(r.value as { workspace: string; data: T });
      }
    }
    return fulfilled;
  }

  // ─── Teams ─────────────────────────────────────────────────

  async listTeams() {
    const results = await this.fromAll((c) => c.listTeams());
    return results;
  }

  // ─── Projects (merged across all workspaces) ───────────────

  async listAllProjects() {
    const results = await this.fromAll((c) => c.listPersonalProjects());
    const personalByWorkspace = results.map((r) => ({
      workspace: r.workspace,
      projects: (r.data as any)?.me?.projects?.edges?.map((e: any) => e.node) || [],
    }));
    return { workspaces: personalByWorkspace };
  }

  async listPersonalProjects() {
    return this.listAllProjects();
  }

  async listTeamProjects(teamId: string) {
    return this.tryEach((c) => c.listTeamProjects(teamId));
  }

  // ─── Single-resource lookups (try each token) ──────────────

  async getProject(projectId: string) {
    return this.tryEach((c) => c.getProject(projectId));
  }

  async createProject(name: string, description?: string) {
    // Use the first client by default; user can specify workspace
    return this.clients[0].createProject(name, description);
  }

  async deleteProject(projectId: string) {
    return this.tryEach((c) => c.deleteProject(projectId));
  }

  async listServices(projectId: string) {
    return this.tryEach((c) => c.listServices(projectId));
  }

  async createService(projectId: string, name: string, source?: { repo?: string; image?: string }) {
    return this.tryEach((c) => c.createService(projectId, name, source));
  }

  async deleteService(serviceId: string) {
    return this.tryEach((c) => c.deleteService(serviceId));
  }

  async listDeployments(projectId: string, serviceId: string, environmentId: string) {
    return this.tryEach((c) => c.listDeployments(projectId, serviceId, environmentId));
  }

  async getDeployment(deploymentId: string) {
    return this.tryEach((c) => c.getDeployment(deploymentId));
  }

  async redeploy(serviceId: string, environmentId: string) {
    return this.tryEach((c) => c.redeploy(serviceId, environmentId));
  }

  async deployService(serviceId: string, environmentId: string) {
    return this.tryEach((c) => c.deployService(serviceId, environmentId));
  }

  async removeDeployment(deploymentId: string) {
    return this.tryEach((c) => c.removeDeployment(deploymentId));
  }

  async restartDeployment(deploymentId: string) {
    return this.tryEach((c) => c.restartDeployment(deploymentId));
  }

  async listEnvironments(projectId: string) {
    return this.tryEach((c) => c.listEnvironments(projectId));
  }

  async createEnvironment(projectId: string, name: string) {
    return this.tryEach((c) => c.createEnvironment(projectId, name));
  }

  async deleteEnvironment(environmentId: string) {
    return this.tryEach((c) => c.deleteEnvironment(environmentId));
  }

  async getVariables(projectId: string, environmentId: string, serviceId?: string) {
    return this.tryEach((c) => c.getVariables(projectId, environmentId, serviceId));
  }

  async upsertVariables(projectId: string, environmentId: string, serviceId: string, variables: Record<string, string>) {
    return this.tryEach((c) => c.upsertVariables(projectId, environmentId, serviceId, variables));
  }

  async deleteVariable(projectId: string, environmentId: string, serviceId: string, name: string) {
    return this.tryEach((c) => c.deleteVariable(projectId, environmentId, serviceId, name));
  }

  async createServiceDomain(serviceId: string, environmentId: string) {
    return this.tryEach((c) => c.createServiceDomain(serviceId, environmentId));
  }

  async createCustomDomain(serviceId: string, environmentId: string, domain: string) {
    return this.tryEach((c) => c.createCustomDomain(serviceId, environmentId, domain));
  }

  async deleteServiceDomain(environmentId: string, serviceId: string) {
    return this.tryEach((c) => c.deleteServiceDomain(environmentId, serviceId));
  }

  async getDeploymentLogs(deploymentId: string, limit: number = 100) {
    return this.tryEach((c) => c.getDeploymentLogs(deploymentId, limit));
  }

  async getBuildLogs(deploymentId: string) {
    return this.tryEach((c) => c.getBuildLogs(deploymentId));
  }

  async createVolume(projectId: string, environmentId: string, serviceId: string, mountPath: string) {
    return this.tryEach((c) => c.createVolume(projectId, environmentId, serviceId, mountPath));
  }

  async introspect() {
    return this.clients[0].introspect();
  }

  async rawQuery(query: string, variables?: string) {
    return this.clients[0].rawQuery(query, variables);
  }
}
