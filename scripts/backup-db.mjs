import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const connection=process.env.DIRECT_URL||process.env.DATABASE_URL;
const rawKey=process.env.BACKUP_ENCRYPTION_KEY?.trim();
if(!connection)throw new Error("DIRECT_URL or DATABASE_URL is required");
if(!rawKey)throw new Error("BACKUP_ENCRYPTION_KEY is required");
const key=Buffer.from(rawKey,"base64");
if(key.length!==32)throw new Error("BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
const directory=path.resolve(process.env.BACKUP_DIRECTORY||".backups");
await mkdir(directory,{recursive:true});
const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
const output=path.join(directory,`panditconnect-${stamp}.dump.enc`);
const iv=randomBytes(12);
const cipher=createCipheriv("aes-256-gcm",key,iv);
const file=await open(output,"w",0o600);
await file.write(Buffer.concat([Buffer.from("PIMBACKUP1"),iv]));
const dump=spawn("pg_dump",["--format=custom","--no-owner","--no-privileges","--schema=pim_v2",connection],{stdio:["ignore","pipe","pipe"]});
let stderr="";dump.stderr.on("data",chunk=>stderr+=chunk.toString());
const completion=new Promise((resolve,reject)=>{dump.once("error",reject);dump.once("close",resolve);});
try{await pipeline(dump.stdout,cipher,file.createWriteStream({start:22,autoClose:false}));const exit=await completion;if(exit!==0)throw new Error(`pg_dump failed: ${stderr.slice(0,500)}`);const size=(await file.stat()).size;await file.write(cipher.getAuthTag(),0,16,size);}
finally{await file.close().catch(()=>undefined);}
console.log(JSON.stringify({success:true,file:output,encrypted:true,schema:"pim_v2"}));
