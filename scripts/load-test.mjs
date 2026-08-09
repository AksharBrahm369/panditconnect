import { performance } from "node:perf_hooks";

const base=(process.env.LOAD_TEST_BASE_URL||process.env.E2E_BASE_URL||"https://panditconnect-weld.vercel.app").replace(/\/$/,"");
if(!base.startsWith("https://"))throw new Error("LOAD_TEST_BASE_URL must use HTTPS");
const concurrency=Math.max(1,Math.min(Number(process.env.LOAD_TEST_CONCURRENCY)||10,100));
const requests=Math.max(concurrency,Math.min(Number(process.env.LOAD_TEST_REQUESTS)||100,10_000));
const paths=["/api/health/live","/","/privacy","/terms","/manifest.webmanifest"];
const results=[];let cursor=0;
async function worker(){while(cursor<requests){const index=cursor++;const started=performance.now();try{const response=await fetch(`${base}${paths[index%paths.length]}`,{redirect:"manual",signal:AbortSignal.timeout(15_000)});results.push({ms:performance.now()-started,ok:response.status<500,status:response.status});}catch{results.push({ms:performance.now()-started,ok:false,status:0});}}}
await Promise.all(Array.from({length:concurrency},worker));
const durations=results.map(item=>item.ms).sort((a,b)=>a-b);const percentile=p=>Math.round(durations[Math.min(durations.length-1,Math.floor(durations.length*p))]);const failures=results.filter(item=>!item.ok).length;
const report={base,requests,concurrency,failures,errorRate:Number((failures/requests).toFixed(4)),p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99)};
console.log(JSON.stringify(report,null,2));if(report.errorRate>.01||report.p95Ms>3000)process.exitCode=1;
