/** Provision a separate localhost-only account demo without changing the existing workspace. */
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,existsSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {initAccounts,hashPassword} from '../server/auth.ts';
const root=resolve('.'),dir=join(root,'.data/accounts-local');mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
const envFile=join(dir,'accounts.env'),accessFile=join(dir,'ACCESS.txt');
if(!existsSync(envFile))writeFileSync(envFile,`NODE_ENV=production\nHOST=127.0.0.1\nPORT=8790\nAUTH_MODE=accounts\nDATA_DIR=${dir}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nMODEL_URL=http://127.0.0.1:8791\n`,{mode:0o600});
const db=new DatabaseSync(join(dir,'silksense.sqlite'));initAccounts(db);
if(!db.prepare('SELECT id FROM users WHERE username=?').get('operator')){
 const password=randomBytes(18).toString('base64url'),id=randomUUID();
 db.exec('BEGIN');try{db.prepare('INSERT INTO users(id,username,password_hash,role) VALUES(?,?,?,?)').run(id,'operator',await hashPassword(password),'admin');db.prepare('INSERT INTO user_farms VALUES(?,?)').run(id,'F-001');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 writeFileSync(accessFile,`SilkSense account workspace (localhost only)\nURL: http://127.0.0.1:8790/\nUsername: operator\nPassword: ${password}\nAssigned farm: F-001\n\nThis credential file is local and owner-readable only. Do not publish it.\nManage accounts using DATA_DIR=${dir} npm run user -- ...\n`,{mode:0o600});
}
db.close();const units=join(homedir(),'.config/systemd/user');mkdirSync(units,{recursive:true});
const unit=join(units,'silksense-accounts.service');if(!existsSync(unit))writeFileSync(unit,`[Unit]\nDescription=SilkSense localhost account workspace\nAfter=network.target\n\n[Service]\nWorkingDirectory=${root}\nEnvironmentFile=${envFile}\nExecStart=${process.execPath} --experimental-strip-types server/index.ts\nRestart=on-failure\nRestartSec=3\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`);
execFileSync('systemctl',['--user','daemon-reload']);execFileSync('systemctl',['--user','enable','--now','silksense-accounts.service'],{stdio:'pipe'});
console.log('Local account workspace: http://127.0.0.1:8790/');console.log('Credentials file: '+accessFile);
