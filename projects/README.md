# Client projects

Each folder here is an independent website with its own Git repository,
dependencies, environment files, content storage and deployment. The root Git
repository ignores project subfolders; this index remains part of the workspace.

| Project | Folder | Start from the workspace root | Local port |
| --- | --- | --- | --- |
| Breeze | `projects/breeze-web/` | `npm run dev:breeze` | 3000 |
| Extreme Bike Team | `projects/extreme-bike-team/` | `npm run dev:extreme` | 3002 |

The business dashboard and enigma website remain in the root Next.js application,
started with `npm run dev` on port 3001.

Create another website with `npm run site:new -- --id client-name --name "Client Name"`.
The generator creates `projects/client-name-web/` and reserves a port using the
existing project manifests. Use `--dry-run` to inspect the destination first.
The generator does not initialize Git. Add `--register` only when actual business
client/site records should be created in the central dashboard.

Read each project's `AGENTS.md` before working on it. Keep Git operations inside
the intended project. Moving these local folders does not change their GitHub
remote URLs or the Root Directory setting of their independent Vercel projects.
