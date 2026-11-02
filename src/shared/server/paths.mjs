import { resolve } from 'node:path';

// Commands and Next.js now run from the workspace root. Keep existing records
// in place, including the old admin-relative meaning of configured local paths.
// Absolute configured paths retain their original meaning.
export function privateDataPath(filename, configured, workspace = process.cwd()) {
  return resolve(workspace, 'admin', configured || `.data/${filename}`);
}
