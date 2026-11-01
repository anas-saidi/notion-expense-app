// Manual recovery only. Never contacts Neon without explicit opt-in.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
if (!process.argv.includes('--allow-postgres-read')) {
 console.log('No PostgreSQL connection attempted. After free access returns, stop the app and run with --allow-postgres-read. No source data is changed.'); process.exit(0);
}
try { const r=await fetch('http://127.0.0.1:3001',{signal:AbortSignal.timeout(1500)}); if(r.status)throw new Error('Stop the app before importing legacy records.'); } catch(error) { if(error.message.startsWith('Stop the app'))throw error; }
const env=await readFile('.env.local','utf8');
const connectionString=process.env.LEGACY_DATABASE_URL??process.env.DATABASE_URL??env.split('\n').find(line=>line.startsWith('# Legacy recovery only; inactive: DATABASE_URL='))?.split('DATABASE_URL=').slice(1).join('DATABASE_URL=').replace(/^['"]|['"]$/g,'');
if(!connectionString||!process.env.NOTION_FINANCE_RECORDS_DB||!process.env.NOTION_TOKEN)throw new Error('Legacy connection and Notion Finance Records configuration are required.');
const { Pool }=await import('pg'); const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:5000});
const db=process.env.NOTION_FINANCE_RECORDS_DB,token=process.env.NOTION_TOKEN;
let last=0;
async function notion(path,method='GET',body){await new Promise(resolve=>setTimeout(resolve,Math.max(0,last+400-Date.now())));last=Date.now();const r=await fetch('https://api.notion.com/v1'+path,{method,headers:{Authorization:'Bearer '+token,'Notion-Version':'2022-06-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw new Error(`Notion ${r.status}: ${d.message}; inspect records before retrying uncertain creates.`);return d;}
const text=p=>(p?.rich_text??[]).map(t=>t.plain_text??t.text?.content??'').join('');
function rt(value){const chunks=[];for(let start=0;start<value.length;){let end=Math.min(start+1800,value.length);if(end<value.length&&/[\uD800-\uDBFF]/.test(value[end-1]))end--;chunks.push({text:{content:value.slice(start,end)}});start=end;}if(chunks.length>90)throw new Error('A legacy record exceeds Notion limits; refusing truncation.');return{rich_text:chunks};}
async function pages(scope,kind,key){let results=[],cursor;do{const d=await notion(`/databases/${db}/query`,'POST',{filter:{and:[{property:'Scope',rich_text:{equals:scope}},{property:'Kind',select:{equals:kind}},{property:'Key',rich_text:{equals:key}}]},page_size:100,...(cursor?{start_cursor:cursor}:{})});results.push(...d.results);cursor=d.has_more?d.next_cursor:null;}while(cursor);return results;}
function head(rows){if(!rows.length)return null;const replaced=new Set(rows.map(p=>text(p.properties.Replaces)).filter(Boolean)),heads=rows.filter(p=>!replaced.has(text(p.properties.Version)));if(heads.length!==1)throw new Error('Conflicting Notion revisions require review before import.');return heads[0];}
async function append(scope,kind,key,payload,state='active',replaces=null,version=randomUUID()){
 return notion('/pages','POST',{parent:{database_id:db},properties:{Name:{title:[{text:{content:`${kind}: ${key}`}}]},Scope:rt(scope),Kind:{select:{name:kind}},Key:rt(key),Version:rt(version),Replaces:rt(replaces??''),State:{select:{name:state}},Payload:rt(JSON.stringify(payload))}});
}
async function archive(scope,kind,key,payload){if(!(await pages(scope,kind,key)).length)await append(scope,kind,key,payload);}
const client=await pool.connect();let data;
try{
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const read=async(table)=>{try{return(await client.query('SELECT * FROM '+table)).rows;}catch(error){throw new Error(`Could not read ${table}: ${error.message}. No records were deleted or changed.`);}};
 // These are the authoritative tables; do not silently treat a missing table as empty.
 data={agreements:await read('finance_contribution_agreements'),history:await read('finance_contribution_agreement_history'),checks:await read('finance_balance_checks'),operations:await read('finance_mcp_operations')};
 await client.query('COMMIT');
}finally{client.release();await pool.end();}
for(const row of data.history)await archive(row.scope,'legacy-agreement',`${row.month}:${row.version}`,row);
for(const row of data.agreements){await archive(row.scope,'legacy-agreement',`${row.month}:${row.version}:current`,row);if(!(await pages(row.scope,'agreement',row.month)).length)await append(row.scope,'agreement',row.month,row.payload,'active',null,row.payload.version);}
for(const row of data.checks){await archive(row.scope,'legacy-balance-check',`${row.account_id}:${row.payload.version}`,row);const current=head(await pages(row.scope,'balance-check',row.account_id));if(!row.closed&&(!current||current.properties.State.select.name==='review'))await append(row.scope,'balance-check',row.account_id,row.payload,'active',current?text(current.properties.Version):null,row.payload.version);}
for(const row of data.operations){await archive(row.scope,'legacy-operation',row.request_id,row);const current=head(await pages(row.scope,'operation',row.request_id));if(current){const p=JSON.parse(text(current.properties.Payload));if(p.fingerprint!==row.fingerprint)throw new Error('A legacy operation conflicts with a Notion receipt. Review it before continuing.');if(current.properties.State.select.name==='completed'||row.state!=='completed')continue;}
 await append(row.scope,'operation',row.request_id,{fingerprint:row.fingerprint,result:row.result,createdAt:row.created_at,finishedAt:row.finished_at,source:'legacy-postgresql'},row.state==='completed'?'completed':'pending',current?text(current.properties.Version):null);
}
console.log(JSON.stringify({importedSourceCounts:{agreements:data.agreements.length,revisions:data.history.length,checks:data.checks.length,operations:data.operations.length},sourceChanged:false,note:'Post-cutover Notion agreements were preserved. Legacy histories are archived separately. Keep the operation cutover guard until these counts and receipts have been reviewed.'}));
