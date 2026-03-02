# Moxie MCP Server

An MCP (Model Context Protocol) server that connects AI assistants like Claude to your [Moxie CRM](https://www.withmoxie.com/) workspace. Manage clients, invoices, projects, tickets, and more through natural language.

## What It Can Do

| Category | Tools |
|----------|-------|
| **Clients** | List, search, create clients |
| **Contacts** | Search, create contacts for clients |
| **Projects** | Search, create projects with fee schedules |
| **Tasks** | Create tasks with subtasks, priorities, assignees |
| **Invoices** | Search payable invoices, create invoices, apply payments |
| **Expenses** | Create expense records |
| **Time Tracking** | Log time entries to projects/tasks |
| **Tickets** | List, create, and comment on support tickets |
| **Opportunities** | Create pipeline opportunities, list stages |
| **Calendar** | Create or update calendar events |
| **Templates** | List email templates, invoice templates, forms |
| **Files** | Attach files from URL to any entity |
| **Deliverables** | Approve deliverables/tasks |

**30 tools total** covering the full Moxie public API.

## Prerequisites

- Node.js 18+
- A Moxie workspace with API access enabled
- Your Moxie API key and base URL

## Getting Your API Credentials

1. Log into your Moxie workspace
2. Go to **Workspace Settings > Connected Apps > Integrations**
3. Copy your **API Key**
4. Note your **Base URL** (e.g., `https://pod00.withmoxie.dev`)

## Installation

```bash
git clone https://github.com/theloniuser/moxie-mcp-server.git
cd moxie-mcp-server
npm install
```

## Configuration

### Claude Desktop / Claude Code

Add to your Claude config (`~/.claude.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "moxie": {
      "command": "node",
      "args": ["/path/to/moxie-mcp-server/moxie-mcp-server.js"],
      "env": {
        "MOXIE_BASE_URL": "https://pod00.withmoxie.dev",
        "MOXIE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MOXIE_BASE_URL` | Yes | Your Moxie workspace URL (e.g., `https://pod00.withmoxie.dev`) |
| `MOXIE_API_KEY` | Yes | API key from Workspace Settings |

You can also use a `.env` file for Docker-based setups.

## Usage Examples

Once configured, ask Claude things like:

- "Search for all Blue Ribbon clients"
- "Create an invoice for Acme Corp with 2 line items"
- "Log 3 hours to the Website Redesign project"
- "Create a high-priority ticket for client support"
- "What invoices are outstanding for this client?"
- "Add a calendar event for the project kickoff meeting"

## Running Standalone

```bash
# Set environment variables
export MOXIE_BASE_URL="https://pod00.withmoxie.dev"
export MOXIE_API_KEY="your-api-key"

# Run the server
npm start
```

## Known Limitations

- **Invoice search returns only unpaid/payable invoices** — this is a Moxie API limitation, not a server limitation. There is no public API endpoint for retrieving paid/archived invoices.
- Client name filters require exact matches for create operations (search is fuzzy).

## License

MIT
