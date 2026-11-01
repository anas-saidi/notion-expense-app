import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
const token = process.env.NOTION_TOKEN;
if (!token) throw new Error('NOTION_TOKEN is required');
const apply = process.argv.includes('--apply');
let last = 0;
async function request(path, method = 'GET', body) {
  await new Promise(resolve => setTimeout(resolve, Math.max(0, last + 400 - Date.now()))); last = Date.now();
  const response = await fetch('https://api.notion.com/v1' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.message ?? 'Notion request failed'}. Do not repeat uncertain creates; inspect Notion first.`);
  return data;
}
const ids = {
  accounts: process.env.NOTION_ACCOUNTS_DB ?? '1926a2be-8922-8014-bb54-d9f5e9d1234b',
  categories: process.env.NOTION_CATEGORIES_DB ?? '1926a2be-8922-8029-9b90-c7d8bb55fabd',
  transactions: process.env.NOTION_TRANSACTIONS_DB ?? '1926a2be-8922-80be-968a-efa6e6dace95',
  funds: process.env.NOTION_FUNDS_DB ?? '1936a2be-8922-8058-990d-c549172f1d45',
  pending: process.env.NOTION_PENDING_DB ?? 'd2db101b-faec-467d-8c57-eee6d8780311',
};
const scope = createHash('sha256').update(token).update(JSON.stringify(Object.values(ids).map(id => id.replaceAll('-', '').toLowerCase()))).digest('hex');
const source = await request('/databases/' + ids.transactions);
let parent = source.parent;
for (let step = 0; parent?.type === 'block_id' && step < 12; step++) parent = (await request('/blocks/' + parent.block_id)).parent;
if (parent?.type !== 'page_id') throw new Error('Could not find the finance parent page. Nothing created.');
const properties = {
  Name: { title: {} }, Scope: { rich_text: {} }, Kind: { select: { options: ['agreement','balance-check','operation','recovery','checkpoint','legacy-agreement','legacy-balance-check','legacy-operation'].map(name => ({ name })) } },
  Key: { rich_text: {} }, Version: { rich_text: {} }, Replaces: { rich_text: {} }, Payload: { rich_text: {} },
  State: { select: { options: ['active','closed','pending','completed','review'].map(name => ({ name })) } },
  'Anas agreed': { number: { format: 'number' } }, 'Salma agreed': { number: { format: 'number' } }, 'Actual balance': { number: { format: 'number' } },
};
console.log(JSON.stringify({ apply, parentPage: parent.page_id, create: 'Finance Records', recordKinds: ['agreement revisions','balance check revisions','operation receipts','recovery checkpoint'], seedFinancialData: false }));
if (!apply) process.exit(0);
let databaseId = process.env.NOTION_FINANCE_RECORDS_DB;
if (!databaseId) {
  const search = await request('/search', 'POST', { query: 'Finance Records', filter: { value: 'database', property: 'object' }, page_size: 100 });
  const matching = search.results.filter(row => row.parent?.page_id?.replaceAll('-','') === parent.page_id.replaceAll('-','') && row.title?.map(t => t.plain_text ?? t.text?.content ?? '').join('') === 'Finance Records');
  if (matching.length > 1) throw new Error('More than one matching Finance Records database. Select one explicitly.');
  databaseId = matching[0]?.id;
}
if (!databaseId) databaseId = (await request('/databases', 'POST', { parent: { type: 'page_id', page_id: parent.page_id }, title: [{ type: 'text', text: { content: 'Finance Records' } }], properties })).id;
const schema = await request('/databases/' + databaseId);
for (const key of Object.keys(properties)) if (!schema.properties?.[key]) throw new Error(`Finance Records is missing ${key}; no configuration changed.`);
const cutover = process.env.NOTION_OPERATIONS_CUTOVER ?? new Date().toISOString();
const record = { source: 'PostgreSQL unavailable due to quota', cutover, legacyRevisionHistory: 'not yet recoverable', legacyOperationReceipts: 'not yet recoverable', agreementRecovery: 'requires explicit source data', balanceRecovery: 'counts require confirmation before being treated as current' };
const rt = content => ({ rich_text: content ? [{ type: 'text', text: { content } }] : [] });
const existing = await request(`/databases/${databaseId}/query`, 'POST', { filter: { and: [{ property: 'Scope', rich_text: { equals: scope } }, { property: 'Kind', select: { equals: 'checkpoint' } }] } });
if (!existing.results.length) await request('/pages', 'POST', { parent: { database_id: databaseId }, properties: { Name: { title: [{ text: { content: 'Recovery checkpoint' } }] }, Scope: rt(scope), Kind: { select: { name: 'checkpoint' } }, Key: rt('postgres-cutover'), Version: rt(randomUUID()), Replaces: rt(''), State: { select: { name: 'review' } }, Payload: rt(JSON.stringify(record)) } });
let env = await readFile('.env.local', 'utf8');
const set = (key, value) => { env = env.split('\n').filter(line => !line.startsWith(key + '=')).join('\n').trimEnd() + `\n${key}=${value}\n`; };
set('NOTION_FINANCE_RECORDS_DB', databaseId); set('NOTION_SINGLE_WRITER','true'); set('NOTION_OPERATIONS_CUTOVER',cutover); set('FINANCE_NOTION_ONLY','true');
await writeFile('.env.local',env,{mode:0o600});
console.log(JSON.stringify({ databaseId, url: schema.url, configured: true, legacyRecoveryPending: true }));
