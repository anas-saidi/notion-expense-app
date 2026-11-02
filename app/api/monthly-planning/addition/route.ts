import { NextRequest, NextResponse } from "next/server";
import { withMirrorMutation } from "../../../../lib/mirror/routes";
import { withSavingsFundingLock } from "../../../../lib/savings-funding-lock";
import { contributionStore } from "../../../../lib/contribution-store";
import { contributionScope } from "../../../../lib/contribution-scope";
import { addToPlan } from "../../../../lib/plan-addition";
import { notionFetchJson, queryDatabaseAll } from "../../../../lib/notion-api";
import { mapCategoryPage } from "../../../../lib/notion-category-record";
import { normalizeId } from "../../../../lib/savings-funding";
import { isSavingsCategory } from "../../../components/wallet-utils";
import { getCategoryScope, scopeFromAccountLabel } from "../../../components/app-utils";
import { billToday } from "../../../../lib/bills";

const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";
const CAT_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const ACC_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
const fail = (message: string): never => { throw Object.assign(new Error(message), { status: 409 }); };
async function handlePOST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "Finance connection unavailable." }, { status: 503 });
  const input = await req.json().catch(() => null);
  if (!input || typeof input.month !== "string" || input.month < billToday().slice(0, 7)) return NextResponse.json({ error: "Choose the current or a future planning month." }, { status: 400 });
  try {
    const agreement = await withSavingsFundingLock(`plan-addition:${contributionScope(token)}:${input.month}`, async () => {
      const scope = contributionScope(token), store = contributionStore();
      return addToPlan(input, {
        load: async () => (await store.list(scope)).find(a => a.month === input.month),
        save: (current, targets, additions) => store.save(scope, input.month, targets, current.shares, current.version, additions),
        validateCategory: async id => {
          const { data: page } = await notionFetchJson<any>(token, `/pages/${id}`);
          if (page.archived || page.in_trash || normalizeId(page.parent?.database_id) !== normalizeId(CAT_DB)) fail("Choose an active Joint budget category.");
          const category = mapCategoryPage(page);
          if (isSavingsCategory(category) || category.archived || category.snoozed || !category.defaultAccount) fail("Choose an active Joint budget category with a holding account.");
          const { data: account } = await notionFetchJson<any>(token, `/pages/${category.defaultAccount}`);
          const title: any = Object.values(account.properties ?? {}).find((p: any) => p.type === "title");
          const label = (title?.title ?? []).map((p: any) => p.plain_text ?? p.text?.content ?? "").join("");
          if ((getCategoryScope(category) ?? scopeFromAccountLabel(label)) !== "joint" || account.archived || account.in_trash || normalizeId(account.parent?.database_id) !== normalizeId(ACC_DB) || /saving/i.test(label) || scopeFromAccountLabel(label) !== "joint") fail("Plan additions require a Joint holding account.");
          return category.defaultAccount!;
        },
        findFund: async (id, draft, accountId) => {
          const rows = await queryDatabaseAll<any>(token, FUNDS_DB, { filter: { property: "Name", title: { equals: `Plan addition ${id}` } } });
          if (rows.length > 1) fail("Duplicate plan additions need review before continuing.");
          const row = rows[0];
          if (row && (row.properties.Planned?.number !== draft.amount || row.properties.Date?.date?.start?.slice(0, 7) !== draft.month || normalizeId(row.properties.Category?.relation?.[0]?.id) !== normalizeId(draft.categoryId) || normalizeId(row.properties["🏦 Accounts"]?.relation?.[0]?.id) !== normalizeId(accountId) || row.properties.Reverse?.checkbox)) fail("The saved allocation changed. Review it before continuing.");
          return row?.id ?? null;
        },
        createFund: async (draft, accountId) => {
          const { data } = await notionFetchJson<any>(token, "/pages", { method: "POST", retries: 0, body: { parent: { database_id: FUNDS_DB }, properties: {
            Name: { title: [{ text: { content: `Plan addition ${draft.operationId}` } }] }, Date: { date: { start: `${draft.month}-01` } },
            Planned: { number: draft.amount }, Category: { relation: [{ id: draft.categoryId }] }, "🏦 Accounts": { relation: [{ id: accountId }] }, "Assignment Type": { select: { name: "Additional" } }, Reverse: { checkbox: false },
          } } });
          return data.id;
        },
      });
    });
    return NextResponse.json({ agreement });
  } catch (error: any) { return NextResponse.json({ error: error.message ?? "Could not add to plan.", pending: Boolean(error.pending) }, { status: error.status ?? 503 }); }
}
export const POST = withMirrorMutation(handlePOST);
export const maxDuration = 240;
