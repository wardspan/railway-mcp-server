# Railway MCP Server

A Model Context Protocol (MCP) server that gives Claude (and other MCP-compatible AI tools) full access to your Railway.app infrastructure. Deploy, manage services, check logs, configure environment variables — all through natural conversation.

Supports **multiple workspaces** — use one token per workspace and the server merges results across all of them.

## Quick Start

### 1. Get Railway API Tokens

Go to [railway.com/account/tokens](https://railway.com/account/tokens) and create a **workspace-scoped token** for each workspace you want to access. Tokens scoped to "No workspace" can only see account-level info, not projects.

### 2. Install & Build

```bash
cd railway-mcp-server
npm install
npm run build
```

### 3. Configure in Claude Desktop

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Multiple workspaces (recommended)

Use named env vars — one per workspace:

```json
{
  "mcpServers": {
    "railway": {
      "command": "node",
      "args": ["/FULL/PATH/TO/railway-mcp-server/build/index.js"],
      "env": {
        "RAILWAY_TOKEN_MYCOMPANY": "token-scoped-to-company-workspace",
        "RAILWAY_TOKEN_PERSONAL": "token-scoped-to-personal-workspace"
      }
    }
  }
}
```

The label after `RAILWAY_TOKEN_` becomes the workspace name in results (e.g. `mycompany`, `personal`).

#### Single workspace

If you only need one workspace, you can use the simpler format:

```json
{
  "mcpServers": {
    "railway": {
      "command": "node",
      "args": ["/FULL/PATH/TO/railway-mcp-server/build/index.js"],
      "env": {
        "RAILWAY_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

#### All token formats supported

| Env var | Behavior |
|---------|----------|
| `RAILWAY_TOKEN_<LABEL>` | Named tokens — one per workspace (recommended) |
| `RAILWAY_API_TOKENS` | Comma-separated list of tokens |
| `RAILWAY_API_TOKEN` | Single token (backwards compatible) |

### 4. Restart Claude Desktop

The Railway tools will appear automatically.

## Available Tools (30 total)

### Teams
| Tool | Description |
|------|-------------|
| `list_teams` | List all teams/organizations you belong to |

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | List ALL projects across all workspaces |
| `list_personal_projects` | List only your personal projects |
| `list_team_projects` | List projects for a specific team |
| `get_project` | Get project details (services, environments) |
| `create_project` | Create a new project |
| `delete_project` | Delete a project |

### Services
| Tool | Description |
|------|-------------|
| `list_services` | List services in a project |
| `create_service` | Create from GitHub repo or Docker image |
| `delete_service` | Remove a service |

### Deployments
| Tool | Description |
|------|-------------|
| `list_deployments` | List deployments for a service |
| `get_deployment` | Get deployment status and details |
| `deploy_service` | Trigger a new deployment |
| `redeploy_service` | Redeploy the latest version |
| `restart_deployment` | Restart a running deployment |
| `remove_deployment` | Cancel/remove a deployment |

### Environments
| Tool | Description |
|------|-------------|
| `list_environments` | List environments (production, staging, etc.) |
| `create_environment` | Create a new environment |
| `delete_environment` | Remove an environment |

### Variables
| Tool | Description |
|------|-------------|
| `get_variables` | Read environment variables |
| `set_variables` | Set one or more variables (upsert) |
| `delete_variable` | Delete a variable |

### Domains
| Tool | Description |
|------|-------------|
| `create_service_domain` | Generate a *.up.railway.app domain |
| `create_custom_domain` | Attach your own domain |
| `delete_service_domain` | Remove the Railway domain |

### Logs
| Tool | Description |
|------|-------------|
| `get_deployment_logs` | Runtime/application logs |
| `get_build_logs` | Build output logs |

### Volumes
| Tool | Description |
|------|-------------|
| `create_volume` | Create persistent storage for a service |

### Advanced
| Tool | Description |
|------|-------------|
| `raw_graphql` | Run any GraphQL query/mutation directly |
| `introspect_schema` | Discover all available API operations |

## How Multi-Workspace Works

When you configure multiple tokens, the server handles routing automatically:

- **Listing projects**: Queries all workspaces in parallel and merges results, labeled by workspace name.
- **ID-based lookups** (get project, deploy, check logs, etc.): Tries each token until one succeeds. Since Railway IDs are globally unique, it finds the right workspace automatically.
- **Create operations**: Uses the first configured token by default.

## Example Usage (in Claude)

> "List my Railway projects"

> "Deploy my-app service to production"

> "Show me the logs for the latest deployment of api-server"

> "Set DATABASE_URL on my backend service in staging"

> "Create a new project called 'my-saas' with a Postgres database"

## Development

```bash
npm run dev    # Watch mode — recompiles on changes
npm run build  # One-time build
npm start      # Run the server
```

## How It Works

This server communicates with Railway's [public GraphQL API](https://docs.railway.com/reference/public-api) at `backboard.railway.com/graphql/v2`. It runs locally on your machine via STDIO transport, so your API tokens never leave your computer.

The `raw_graphql` tool is an escape hatch — if Railway adds new API operations before this server is updated, you (or Claude) can still access them by writing the GraphQL directly.

## License

MIT
