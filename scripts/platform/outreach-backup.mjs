import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { outreachPath } from '../../src/admin/server/outreach-store.mjs';

const path=outreachPath();
if(!existsSync(path))throw new Error('No outreach database exists yet. Open Marketing > New Clients first.');
const directory=resolve('backups');mkdirSync(directory,{recursive:true});
const target=resolve(directory,`outreach-${new Date().toISOString().replaceAll(':','-')}.sqlite`);
const db=new DatabaseSync(path);
try {db.exec('PRAGMA busy_timeout=5000');db.prepare('VACUUM INTO ?').run(target);}
finally {db.close();}
console.log(`Consistent outreach backup saved: ${target}`);
console.log('Gmail tokens remain encrypted. Store the encryption key separately; it is needed to restore connections.');
