import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const inputFile=process.argv.find(arg=>arg.startsWith('--input='))?.slice(8);
if (!inputFile) throw new Error('Provide an explicit JSON file containing user-confirmed recovery data. No inferred financial defaults are used.');
const input=JSON.parse(await readFile(inputFile,'utf8'));
const token=process.env.NOTION_TOKEN, db=process.env.NOTION_FINANCE_RECORDS_DB;
if (!token||!db) throw new Error('Run setup-notion-records first');
let last=0;
async function request(path,method='GET',body) {
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,last+400-Date.now())));last=Date.now();
 const r=await fetch('https://api.notion.com/v1'+path,{method,headers:{Authorization:'Bearer '+token,'Notion-Version':'2022-06-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw new Error(`${r.status}: ${d.message}. Inspect Notion before retrying an uncertain create.`);return d;
}
const ids=[process.env.NOTION_ACCOUNTS_DB??'1926a2be-8922-8014-bb54-d9f5e9d1234b',process.env.NOTION_CATEGORIES_DB??'1926a2be-8922-8029-9b90-c7d8bb55fabd',process.env.NOTION_TRANSACTIONS_DB??'1926a2be-8922-80be-968a-efa6e6dace95',process.env.NOTION_FUNDS_DB??'1936a2be-8922-8058-990d-c549172f1d45',process.env.NOTION_PENDING_DB??'d2db101b-faec-467d-8c57-eee6d8780311'];
const scope=createHash('sha256').update(token).update(JSON.stringify(ids.map(id=>id.replaceAll('-','').toLowerCase()))).digest('hex');
const rt=value=>({rich_text:value?[{type:'text',text:{content:value}}]:[]});
const text=p=>(p?.rich_text??[]).map(x=>x.plain_text??x.text?.content??'').join('');
async function rows(kind,key) { const result=await request(`/databases/${db}/query`,'POST',{filter:{and:[{property:'Scope',rich_text:{equals:scope}},{property:'Kind',select:{equals:kind}},{property:'Key',rich_text:{equals:key}}]}});if(result.has_more)throw new Error('Recovery input needs paginated review; refusing a partial history.');return result.results; }
async function append(kind,key,payload,state='active',replaces=null,projections={}) {
 const version=payload.version??randomUUID();
 const d=await request('/pages','POST',{parent:{database_id:db},properties:{Name:{title:[{text:{content:`${kind}: ${key}`}}]},Scope:rt(scope),Kind:{select:{name:kind}},Key:rt(key),Version:rt(version),Replaces:rt(replaces??''),State:{select:{name:state}},Payload:rt(JSON.stringify(payload)),...projections}});return {id:d.id,version};
}
const checkpoints=await rows('checkpoint','postgres-cutover');
if(!checkpoints.length)throw new Error('Recovery checkpoint missing. Nothing was written.');
const oldVersions=new Set(checkpoints.map(p=>text(p.properties.Replaces)).filter(Boolean));
const heads=checkpoints.filter(p=>!oldVersions.has(text(p.properties.Version)));
if(heads.length!==1)throw new Error('Recovery checkpoint conflicts need review.');
const checkpoint=heads[0];
if(JSON.parse(text(checkpoint.properties.Payload)).recordsReady===true){console.log(JSON.stringify({alreadyRecovered:true,database:db}));process.exit(0);}
const response=await fetch('http://localhost:3001/api/accounts');const catalog=await response.json();if(!response.ok)throw new Error('Accounts are unavailable; cannot map the recovered records.');
const anas=catalog.accounts.find(a=>/hubb|anas/i.test(a.label)&&!/saving/i.test(a.label));
const salma=catalog.accounts.find(a=>/wife|salma/i.test(a.label)&&!/saving/i.test(a.label));
const joint=catalog.accounts.find(a=>/joined|joint/i.test(a.label)&&!/saving/i.test(a.label));
if(!joint||!anas||!salma)throw new Error('Household account mapping needs review.');
const shares={anas:anas.contributionPercent,salma:salma.contributionPercent};
if(!Number.isFinite(shares.anas)||!Number.isFinite(shares.salma)||Math.abs(shares.anas+shares.salma-1)>.000001)throw new Error('Account contribution shares need review.');
const now=new Date().toISOString(), receipts=[];
for(const seed of input.agreements??[]) {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(seed.month)||![seed.targets?.anas,seed.targets?.salma].every(n=>Number.isFinite(n)&&n>=0)||!seed.source)throw new Error('Explicit month, confirmed targets and provenance are required.');
 const existing=await rows('agreement',seed.month);
 if(existing.length){const payload=JSON.parse(text(existing[0].properties.Payload));if(JSON.stringify(payload.targets)!==JSON.stringify(seed.targets))throw new Error('An agreement already exists with different targets. Nothing overwritten.');continue;}
 const agreement={month:seed.month,original:seed.targets,targets:seed.targets,shares,confirmedAt:now,updatedAt:now,version:randomUUID(),recovery:{source:seed.source,recoveredAt:now,originalConfirmationTimestampUnknown:true,legacyRevisionHistoryPending:true}};
 receipts.push(await append('agreement',seed.month,agreement,'active',null,{'Anas agreed':{number:seed.targets.anas},'Salma agreed':{number:seed.targets.salma}}));
}
if(input.balanceReview) {
 const key=joint.id.replaceAll('-','').toLowerCase();const prior=await rows('balance-check',key);
 if(!prior.length)receipts.push(await append('balance-check',key,{accountId:key,actualBalance:input.balanceReview.actualBalance,reportedDay:input.balanceReview.reportedDay,source:input.balanceReview.source,transactionCutoffUnknown:true,requiresFreshCount:true,recoveredAt:now},'review',null,{'Actual balance':{number:input.balanceReview.actualBalance}}));
}
const previous=JSON.parse(text(checkpoint.properties.Payload));
receipts.push(await append('checkpoint','postgres-cutover',{...previous,recordsReady:true,knownAgreementsRecovered:(input.agreements??[]).map(a=>a.month),balanceRecovery:'preserved as review; fresh count required',legacyRevisionHistory:'unavailable; import when free database access returns',legacyOperationReceipts:'unavailable; pre-cutover queued requests blocked',recoveredAt:now},'active',text(checkpoint.properties.Version)));
let env=await readFile('.env.local','utf8');env=env.split('\n').map(line=>line.startsWith('DATABASE_URL=')?'# Legacy recovery only; inactive: '+line:line).filter(line=>!line.startsWith('FINANCE_NOTION_ONLY=')).join('\n');await writeFile('.env.local',env,{mode:0o600});
console.log(JSON.stringify({database:db,recordsRecovered:receipts.length,postgresActive:false,balanceNeedsConfirmation:!!input.balanceReview,legacyHistoryPending:true}));
