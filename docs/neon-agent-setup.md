# Neon agent tooling setup

Completed 2026-11-02 in the isolated `codex/notion-supabase-migration` checkout, based on main `4cf53db`.

## Installed and verified

- Fetched and read the official overview at `https://neon.com/.well-known/agent-skills/neon/SKILL.md`.
- Existing CLI `neonctl` / `neon` 8.16.1 was already installed and authenticated through the OS keyring. Reused it; no additional CLI installation or login was performed for this setup request.
- Checked project and global skill status. Neither scope had Neon skills. Installed only `neon` and `neon-postgres` into `.agents/skills/` through `neonctl skills -s neon -s neon-postgres --agent codex -y`. The installer created `skills-lock.json` with upstream source hashes. Both report up to date.
- The existing project is `notion-expense-app` (`rapid-bread-15770178`). Reused it; did not provision a new database, branch, auth provider or other service.
- No Neon MCP server was registered. First tried a project-local `.codex/config.toml`; the active Codex CLI did not load it. Added a user-level server named `Neon`, pinned to the existing finance project and read-only: `https://mcp.neon.tech/mcp?readonly=true&projectId=rapid-bread-15770178`. Removed the duplicate project-local entry created during this attempt.
- Backed up the pre-existing user configuration to `/Users/anassaidi/.codex/backups/neon-setup-2026-11-02/config.toml.before-neon` with restrictive permissions. Verified all parsed configuration values are unchanged except for the added Neon entry. Restored an empty node_repl args list omitted by the CLI serializer.
- Completed MCP OAuth with `codex mcp login Neon --scopes read --oauth-client-registration dcr`. The default client registration flow failed with `Invalid redirect URI`; dynamic registration succeeded. No API key was placed in project files.
- Added a proven-use entry for Neon CLI/skills to the shared Development Tools resource note.

## Scope and remaining work

Skills are available on the next turn when working in this checkout; reload the session if the newly configured MCP tools are not yet exposed. `codex mcp get Neon` verifies the registered endpoint; MCP OAuth success is separate from database availability. This setup does not resolve the source database quota or establish that SQL recovery can complete.

No `.env` values, existing `DATABASE_URL`, database schema, application dependencies, live deployment, remote billing settings or financial records were modified by this tooling setup. The untracked financial coordinator module was started earlier for the broader migration and is not part of these setup changes. Source recovery and the Notion/Supabase migration remain in progress.
