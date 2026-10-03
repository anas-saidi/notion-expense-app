import { notionFetchJson, queryDatabaseAll, readDatabaseSchema } from "./notion-api";
import { assertExpenseFitsBudget } from "./notion-transactions";
import { billToday, deriveOccurrences, isCalendarDate, isPeriod, normalizedId, parseBillMetadata, nextPeriod, type BillSchedule, type BillPayment, type BillMetadata } from "./bills";

export const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const CATEGORIES_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const ACCOUNTS_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
export function billError(message: string, status = 400) { return Object.assign(new Error(message), { status }); }
const richText = (prop: any) => (prop?.rich_text ?? []).map((item: any) => item.plain_text ?? item.text?.content ?? "").join("");
export function textProperty(content: string) {
  const chunks = content.match(/[\s\S]{1,2000}/g) ?? [];
  if (chunks.length > 100) throw billError("This bill has too many exceptions to save", 409);
  return { rich_text: chunks.map(chunk => ({ text: { content: chunk } })) };
}
export async function billSchema(token: string) {
  const schema = await readDatabaseSchema(token, TRANSACTIONS_DB);
  const props = schema.properties ?? {};
  const dueDate = Object.keys(props).find(name => name.toLowerCase() === "due date" && props[name].type === "date");
  const required = { Repeat: "select", Bill: "relation", "Bill period": "rich_text", "Bill metadata": "rich_text" };
  if (!dueDate || Object.entries(required).some(([name, type]) => props[name]?.type !== type) ||
      !props.Type?.select?.options?.some((o: any) => o.name === "Due") || normalizedId(props.Bill.relation?.database_id ?? "") !== normalizedId(TRANSACTIONS_DB)) {
    throw billError("Transactions needs Type: Due, Due Date, Repeat, Bill (relation to Transactions), Bill period, and Bill metadata", 409);
  }
  return { dueDate };
}
export function mapBillSchedule(page: any, dueDate: string): BillSchedule {
  const props = page.properties;
  if (props.Date?.date || props.Account?.relation?.length) throw billError(`Bill “${props.Name?.title?.[0]?.plain_text ?? page.id}” must have an empty payment Date and Account in Notion`, 409);
  let metadata: BillMetadata;
  try { metadata = parseBillMetadata(richText(props["Bill metadata"])); }
  catch { throw billError(`Bill “${props.Name?.title?.[0]?.plain_text ?? page.id}” has invalid metadata. Fix it before loading bills.`, 409); }
  return { id: page.id, name: (props.Name?.title ?? []).map((t: any) => t.plain_text ?? t.text?.content ?? "").join(""),
    amount: props.Amount?.number, categoryId: props.Category?.relation?.[0]?.id ?? "", dueDate: props[dueDate]?.date?.start?.slice(0, 10) ?? "",
    repeat: props.Repeat?.select?.name ?? "None", metadata };
}
export function mapBillPayment(page: any): BillPayment {
  const p = page.properties;
  const period = richText(p["Bill period"]); const date = p.Date?.date?.start?.slice(0, 10);
  if (p.Bill?.relation?.length !== 1 || !isPeriod(period) || !isCalendarDate(date) || !Number.isFinite(p.Amount?.number) || p.Amount.number <= 0 || !p.Category?.relation?.[0]?.id || !p.Account?.relation?.[0]?.id) throw billError("A bill payment has incomplete or invalid properties in Notion", 409);
  return { id: page.id, name: (p.Name?.title ?? []).map((t: any) => t.plain_text ?? t.text?.content ?? "").join(""), billId: p.Bill.relation[0].id, period, date, amount: p.Amount.number, categoryId: p.Category.relation[0].id, accountId: p.Account.relation[0].id };
}
export async function readBills(token: string) {
  // One paginated query covers schedules and their payments; metadata and
  // rows are independent, so neither waits on the other network response.
  const [schema, pages] = await Promise.all([
    billSchema(token),
    queryDatabaseAll(token, TRANSACTIONS_DB, { filter: { or: [
      { property: "Type", select: { equals: "Due" } },
      { and: [{ property: "Type", select: { equals: "Expense" } }, { property: "Bill", relation: { is_not_empty: true } }] },
    ] } }),
  ]);
  const schedules = pages.filter(p => p.properties?.Type?.select?.name === "Due");
  const payments = pages.filter(p => p.properties?.Type?.select?.name === "Expense");
  const data = { schedules: schedules.map(p => mapBillSchedule(p, schema.dueDate)), payments: payments.map(mapBillPayment), today: billToday() };
  deriveOccurrences(data.schedules, data.payments, data.today, data.today.slice(0, 7));
  return data;
}
async function relatedPage(token: string, id: unknown, database: string) {
  if (typeof id !== "string" || !/^[a-f0-9-]{32,36}$/i.test(id)) throw billError("Choose a valid category or account");
  const { data: page } = await notionFetchJson<any>(token, `/pages/${id}`);
  if (normalizedId(page.parent?.database_id ?? "") !== normalizedId(database) || page.archived || page.in_trash) throw billError("Choose a record from the configured database");
  return page;
}
export async function readSchedule(token: string, id: string) {
  const schema = await billSchema(token); const page = await relatedPage(token, id, TRANSACTIONS_DB);
  if (page.properties.Type?.select?.name !== "Due") throw billError("This record is not a bill schedule");
  const schedule = mapBillSchedule(page, schema.dueDate);
  deriveOccurrences([schedule], [], billToday(), schedule.dueDate.slice(0, 7));
  return { page, schedule, schema };
}
export async function validateBillDraft(token: string, draft: any) {
  if (typeof draft.name !== "string" || !draft.name.trim() || draft.name.length > 200 || !Number.isFinite(draft.amount) || draft.amount <= 0 || !isCalendarDate(draft.dueDate) || !["None", "Monthly", "Yearly"].includes(draft.repeat)) throw billError("Provide a name, positive amount, valid due date, and repeat interval");
  const category = await relatedPage(token, draft.categoryId, CATEGORIES_DB);
  if (category.properties.Archived?.checkbox || category.properties.Snooze?.checkbox) throw billError("Choose an active category");
  if (draft.accountId) {
    const account = await relatedPage(token, draft.accountId, ACCOUNTS_DB);
    if (account.properties.Disabled?.checkbox) throw billError("Choose an active account");
  }
}
export async function createBill(token: string, draft: any) {
  const schema = await billSchema(token); await validateBillDraft(token, draft);
  const { data } = await notionFetchJson<any>(token, "/pages", { method: "POST", body: { parent: { database_id: TRANSACTIONS_DB }, properties: {
    Name: { title: [{ text: { content: draft.name.trim() } }] }, Amount: { number: draft.amount }, Category: { relation: [{ id: draft.categoryId }] },
    Type: { select: { name: "Due" } }, [schema.dueDate]: { date: { start: draft.dueDate } }, Repeat: { select: { name: draft.repeat } },
    "Bill metadata": textProperty(JSON.stringify({ v: 1, ...(draft.accountId ? { account: draft.accountId } : {}) })),
    Date: { date: null }, Account: { relation: [] },
  } } });
  return mapBillSchedule(data, schema.dueDate);
}
async function occurrenceFor(token: string, billId: string, period: string) {
  if (!isPeriod(period)) throw billError("Invalid bill period");
  const data = await readBills(token);
  const schedule = data.schedules.find(s => normalizedId(s.id) === normalizedId(billId));
  const occurrence = deriveOccurrences(schedule ? [schedule] : [], data.payments.filter(p => normalizedId(p.billId) === normalizedId(billId)), data.today, period).find(o => o.period === period);
  if (!schedule || !occurrence) throw billError("This bill occurrence no longer exists", 409);
  return { schedule, occurrence };
}
async function performPayment(token: string, draft: any) {
  const { schedule, occurrence } = await occurrenceFor(token, draft.billId, draft.period);
  if (occurrence.state === "Paid" || occurrence.state === "Skipped") throw billError("This occurrence is already paid or skipped. Refresh bills.", 409);
  await validateBillDraft(token, { ...draft, name: schedule.name, dueDate: draft.date, repeat: "None", categoryId: occurrence.categoryId });
  await assertExpenseFitsBudget(token, { categoryId: occurrence.categoryId, amount: draft.amount });
  const properties = { Name: { title: [{ text: { content: schedule.name } }] }, Type: { select: { name: "Expense" } },
    Amount: { number: draft.amount }, Category: { relation: [{ id: occurrence.categoryId }] }, Account: { relation: [{ id: draft.accountId }] },
    Date: { date: { start: draft.date } }, Bill: { relation: [{ id: schedule.id }] }, "Bill period": textProperty(draft.period) };
  if (!draft.accountId) throw billError("Choose a payment account");
  try {
    const { data } = await notionFetchJson<any>(token, "/pages", { method: "POST", body: { parent: { database_id: TRANSACTIONS_DB }, properties } });
    return mapBillPayment(data);
  } catch (error: any) {
    // Resolve ambiguous creates through their stable bill + period identity; never blindly retry.
    if (!error.status || error.status >= 500) {
      const matches = await queryDatabaseAll(token, TRANSACTIONS_DB, { filter: { and: [
        { property: "Type", select: { equals: "Expense" } }, { property: "Bill", relation: { contains: schedule.id } },
        { property: "Bill period", rich_text: { equals: draft.period } },
      ] } });
      if (matches.length) return mapBillPayment(matches[0]);
      throw billError("Payment could not be confirmed. Refresh bills before recording it again.", 503);
    }
    throw error;
  }
}
async function performUpdate(token: string, action: any) {
  const { schedule, occurrence } = await occurrenceFor(token, action.billId, action.period);
  if (["skip", "restore", "edit"].includes(action.action) && occurrence.state === "Paid") throw billError("Edit or undo the payment before changing this occurrence", 409);
  if (action.action === "edit") await validateBillDraft(token, action);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { page, schedule: fresh, schema } = await readSchedule(token, schedule.id);
    const metadata = structuredClone(fresh.metadata);
    const properties: Record<string, unknown> = {};
    if (action.action === "skip") metadata.skipped = Array.from(new Set([...(metadata.skipped ?? []), action.period]));
    else if (action.action === "restore") metadata.skipped = (metadata.skipped ?? []).filter(p => p !== action.period);
    else if (action.action === "stop") metadata.end = metadata.end && metadata.end < action.period ? metadata.end : action.period;
    else if (action.action === "edit" && action.target === "occurrence") {
      metadata.overrides = { ...metadata.overrides, [action.period]: { amount: action.amount, categoryId: action.categoryId, due: action.dueDate } };
    } else if (action.action === "edit" && action.target === "future") {
      // Previous expectations survive future edits, including older overdue occurrences.
      const until = nextPeriod(action.period, -1);
      const prior = [...(metadata.revisions ?? [])].sort((a, b) => a.until.localeCompare(b.until)).find(r => r.until >= until);
      metadata.revisions = [...(metadata.revisions ?? []).filter(r => r.until < until), { amount: prior?.amount ?? fresh.amount, categoryId: prior?.categoryId ?? fresh.categoryId, until }];
      if (action.name.trim() !== fresh.name) properties.Name = { title: [{ text: { content: action.name.trim() } }] };
      properties.Amount = { number: action.amount }; properties.Category = { relation: [{ id: action.categoryId }] };
      // Recurrence anchor and repeat are immutable once created: changing either can erase periods.
      if (action.repeat !== fresh.repeat || action.dueDate !== occurrence.dueDate) throw billError("Edit the due date for this occurrence only. To change recurrence, stop this bill and add a new schedule.", 409);
      metadata.account = action.accountId || undefined;
    } else throw billError("Unknown bill action");
    properties["Bill metadata"] = textProperty(JSON.stringify(metadata));
    const { data: latest } = await notionFetchJson<any>(token, `/pages/${fresh.id}`);
    if (latest.last_edited_time !== page.last_edited_time) {
      if (attempt === 0) continue;
      throw billError("Someone just changed this bill. Refresh and try again.", 409);
    }
    const { data } = await notionFetchJson<any>(token, `/pages/${fresh.id}`, { method: "PATCH", body: { properties } });
    return mapBillSchedule(data, schema.dueDate);
  }
}
export async function undoBillPayment(token: string, id: string) {
  const page = await relatedPage(token, id, TRANSACTIONS_DB);
  if (page.properties.Type?.select?.name !== "Expense") throw billError("This record is not a bill payment");
  mapBillPayment(page);
  await notionFetchJson(token, `/pages/${id}`, { method: "PATCH", body: { archived: true } });
}

// Serialize operations for a schedule in this process; cross-instance duplicate payments remain visible.
const operations = new Map<string, Promise<unknown>>();
async function serialBillOperation<T>(token: string, id: string, operation: () => Promise<T>) {
  const key = `${token}:${normalizedId(id)}`;
  const previous = operations.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  operations.set(key, next);
  try { return await next; } finally { if (operations.get(key) === next) operations.delete(key); }
}
export function payBill(token: string, draft: any) {
  if (typeof draft.billId !== "string") throw billError("Missing bill id");
  return serialBillOperation(token, draft.billId, () => performPayment(token, draft));
}
export function updateBill(token: string, action: any) {
  return serialBillOperation(token, action.billId, () => performUpdate(token, action));
}
export function deleteBill(token: string, id: string) {
  return serialBillOperation(token, id, async () => {
    await readSchedule(token, id);
    await notionFetchJson(token, `/pages/${id}`, { method: "PATCH", body: { archived: true } });
  });
}

/** Keep the first paid expense and its future due occurrences in Transactions. */
export async function createRecurringExpense(token: string, draft: any) {
  if (!["Monthly", "Yearly"].includes(draft.repeat)) throw billError("Choose monthly or yearly recurrence");
  const billDraft = { ...draft, dueDate: draft.date };
  await validateBillDraft(token, billDraft);
  // Check funding before writing the schedule, so budget failures leave no due bill.
  if (!draft.billId) await assertExpenseFitsBudget(token, { categoryId: draft.categoryId, amount: draft.amount });
  const schedule = draft.billId ? (await readSchedule(token, draft.billId)).schedule : await createBill(token, billDraft);
  if (schedule.name !== draft.name.trim() || schedule.amount !== draft.amount || normalizedId(schedule.categoryId) !== normalizedId(draft.categoryId) || schedule.dueDate !== draft.date || schedule.repeat !== draft.repeat) throw billError("The saved schedule differs from this expense. Finish it from Bills before creating another expense.", 409);
  try {
    // A response may have been lost after payment succeeded. Recover it without another write.
    const data = await readBills(token);
    const existing = data.payments.find(payment => normalizedId(payment.billId) === normalizedId(schedule.id) && payment.period === draft.date.slice(0, 7));
    if (existing) {
      if (existing.amount !== draft.amount || existing.date !== draft.date || normalizedId(existing.accountId) !== normalizedId(draft.accountId)) throw billError("A payment already exists with different details. Review it in Bills.", 409);
      return existing;
    }
    return await payBill(token, { billId: schedule.id, period: draft.date.slice(0, 7), amount: draft.amount, accountId: draft.accountId, date: draft.date });
  } catch (error: any) {
    throw Object.assign(billError(`The recurring bill was saved, but its payment could not be confirmed. Retry or finish it from Bills. ${error.message}`, error.status ?? 503), { billId: schedule.id });
  }
}
