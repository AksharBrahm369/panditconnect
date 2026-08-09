import { createDecipheriv } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const source=process.argv[2];
const rawKey=process.env.BACKUP_ENCRYPTION_KEY?.trim();
if(!source)throw new Error("Usage: npm run backup:verify -- .backups/<file>.dump.enc");
if(!rawKey)throw new Error("BACKUP_ENCRYPTION_KEY is required");
const key=Buffer.from(rawKey,"base64");
if(key.length!==32)throw new Error("BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
const encrypted=await readFile(path.resolve(source));
if(encrypted.subarray(0,10).toString()!=="PIMBACKUP1")throw new Error("Invalid encrypted backup header");
const iv=encrypted.subarray(10,22),tag=encrypted.subarray(-16),payload=encrypted.subarray(22,-16);
const decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);
const plain=Buffer.concat([decipher.update(payload),decipher.final()]);
const temporary=await mkdtemp(path.join(os.tmpdir(),"pim-backup-"));
const dumpPath=path.join(temporary,"backup.dump");
try{await writeFile(dumpPath,plain,{mode:0o600});const child=spawn("pg_restore",["--list",dumpPath],{stdio:["ignore","pipe","pipe"]});let stdout="",stderr="";child.stdout.on("data",chunk=>stdout+=chunk);child.stderr.on("data",chunk=>stderr+=chunk);const exit=await new Promise(resolve=>child.on("close",resolve));if(exit!==0)throw new Error(`pg_restore verification failed: ${stderr.slice(0,500)}`);for(const table of ["users","bookings","pandit_profiles","sessions"])if(!stdout.includes(`pim_v2 ${table}`))throw new Error(`Backup is missing pim_v2.${table}`);console.log(JSON.stringify({success:true,verified:true,requiredTables:4}));}
finally{await rm(temporary,{recursive:true,force:true});}
