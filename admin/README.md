# Preserved private storage

The Next.js application now runs from the workspace root. Dashboard source is in
`../src/admin/`, public website source is in `../src/website/`, and routes are in
`../src/app/`. Run `npm run dev` from the workspace root, then open `/admin` or `/home`.

This directory retains `.data/` so existing SQLite records, Marketing JSON,
inquiries and their local backups stay at the same paths. These files are private
and ignored by Git. Do not delete this directory or copy its records into source.

`package.json` is a compatibility shim for older `npm --prefix admin run ...`
commands. It forwards to the root package; there is no separate app or dependency
installation here. Server configuration is now in root `.env.local`.
