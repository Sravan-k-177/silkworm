import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {initAccounts,hashPassword} from '../server/auth.ts';
const dir=mkdtempSync('.data/auth-e2e-');process.env.DATA_DIR=dir;process.env.AUTH_MODE='accounts';process.env.SESSION_SECRET='automated-test-only-secret-not-for-deployment';process.env.PORT='8793';process.env.NODE_ENV='production';
const db=new DatabaseSync(join(dir,'silksense.sqlite'));initAccounts(db);
const hash=await hashPassword('Test-only-password-2026');
for(const [id,role,farms] of [['alice','field',['F-A']],['bob','field',['F-B']],['officer','supervisor',['F-A','F-B']]] as const){db.prepare('INSERT INTO users(id,username,password_hash,role) VALUES(?,?,?,?)').run(id,id,hash,role);for(const farm of farms)db.prepare('INSERT INTO user_farms VALUES(?,?)').run(id,farm);}
db.close();await import('../server/index.ts');
