# @doublehitgames/gdd-mcp

MCP server for [GDD Manager](https://gdd-app.vercel.app) — lets Claude (and other MCP-compatible AI assistants) read and write your game design documents.

This is the **stdio** transport, meant for local clients like **Claude Desktop** and **Claude Code**. It runs on your machine and talks to the GDD Manager REST API using a personal API key.

> **Prefer zero-setup?** If you use **claude.ai** or **Claude Desktop**, you can connect via the remote server with OAuth instead — no install, no key. Add a custom connector pointing to `https://gdd-app.vercel.app/api/mcp` and authorize with your account. Use this npm package only when you specifically want the local/stdio route (e.g. Claude Code, scripts, or working without a browser login).

## Requirements

- Node.js 18+
- A GDD Manager API key (`gdd_sk_...`) — generate one at <https://gdd-app.vercel.app/settings/api-keys>

## Claude Desktop

Add this to your `claude_desktop_config.json`:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gdd-manager": {
      "command": "npx",
      "args": ["-y", "@doublehitgames/gdd-mcp"],
      "env": {
        "GDD_API_KEY": "gdd_sk_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. In a new chat, try: *"List my GDD projects"*.

## Claude Code

```bash
claude mcp add gdd-manager -e GDD_API_KEY=gdd_sk_your_key_here -- npx -y @doublehitgames/gdd-mcp
```

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GDD_API_KEY` | yes | — | Your personal API key (`gdd_sk_...`). |
| `GDD_API_URL` | no | `https://gdd-app.vercel.app` | Base URL of the GDD Manager API (override for self-hosting). |

## What it exposes

- **Who you are** — `whoami` reports the account the key belongs to, how it authenticated, how many projects it owns versus how many were shared with it, and its effective limits.
- **Projects and sections** — full CRUD (list, read, create, update, delete), plus `batch_update_sections` for writing many pages in one request.
- **Rich descriptions** — write a page's description as BlockNote blocks (`contentBlocks`); `get_content_blocks_guide` explains the format on demand.
- **Flowcharts** — a page's diagram, through the `flowchart` field on the section write tools: the assistant describes the nodes and which one leads to which, and the server works out the layout. `get_section({ includeFlowchart: true })` reads back a flow it should edit rather than replace.
- **Page icons** — the project's Google Drive image library (`list_project_images`) plus `thumbImageUrl` on the section write tools, so the assistant can set a page's icon by itself.
- **Shared projects** — everything above works on projects other people invited you to, and every project row says whether you are its `owner`, an `editor` or a `viewer`. `list_project_members` names the team; `list_recent_activity` shows what changed lately, who changed it, and whether it came from the app or through the API.
- **Search** across your projects and sections.
- **Prompts** — ready-made flows like listing projects, viewing a project, and analyzing a GDD.

The key carries your own access and nothing more: the assistant sees exactly what your account sees — the projects you own plus the ones shared with you — and a project shared read-only stays read-only.

## Links

- GDD Manager: <https://gdd-app.vercel.app>
- Manage API keys: <https://gdd-app.vercel.app/settings/api-keys>

## License

MIT
