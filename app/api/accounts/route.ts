import { NextRequest, NextResponse } from "next/server";
import { notionFetchJson } from "@/lib/notion-api";

const ACCOUNTS_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";

type NotionProperty = { name: string; type: string };

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const pickByTypeAndAliases = (props: NotionProperty[], type: string, aliases: string[]) => {
  const sameType = props.filter((prop) => prop.type === type);
  for (const alias of aliases) {
    const found = sameType.find((prop) => norm(prop.name) === norm(alias));
    if (found) return found.name;
  }
  return sameType[0]?.name;
};

const readNumber = (prop: any) =>
  prop?.formula?.number ?? prop?.number ?? prop?.rollup?.number ?? null;

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  try {
    const { data: database } = await notionFetchJson<any>(token, `/databases/${ACCOUNTS_DB}`);
    const props = Object.entries(database.properties ?? {}).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type,
    }));

    const nameKey = pickByTypeAndAliases(props, "title", ["Name", "Account"]);
    const typeKey = pickByTypeAndAliases(props, "select", ["Account Type", "Type"]);
    const disabledKey = pickByTypeAndAliases(props, "checkbox", ["Disabled", "Inactive", "Archived"]);
    const balanceKey = pickByTypeAndAliases(props, "formula", ["Current Balance", "Balance", "Ledger Balance"])
      ?? pickByTypeAndAliases(props, "number", ["Current Balance", "Balance", "Ledger Balance"])
      ?? pickByTypeAndAliases(props, "rollup", ["Current Balance", "Balance", "Ledger Balance"]);
    const readyKey = pickByTypeAndAliases(props, "formula", ["Ready to Assign", "Ready To Assign", "Available to Assign"])
      ?? pickByTypeAndAliases(props, "number", ["Ready to Assign", "Ready To Assign", "Available to Assign"])
      ?? pickByTypeAndAliases(props, "rollup", ["Ready to Assign", "Ready To Assign", "Available to Assign"]);
    const jointDueKey = pickByTypeAndAliases(props, "formula", ["Joint Due #", "Joint Due", "Joint due", "Joint owed", "Joint Owed"])
      ?? pickByTypeAndAliases(props, "number", ["Joint Due #", "Joint Due", "Joint due", "Joint owed", "Joint Owed"])
      ?? pickByTypeAndAliases(props, "rollup", ["Joint Due #", "Joint Due", "Joint due", "Joint owed", "Joint Owed"]);
      const contributionPercentKey = pickByTypeAndAliases(props, "number", ["Contribution ( percent )", "Contribution %", "Contribution Percent"]);

    const queryBody: Record<string, unknown> = {
      page_size: 50,
    };

    if (disabledKey) {
      queryBody.filter = {
        property: disabledKey,
        checkbox: { equals: false },
      };
    }

    if (nameKey) {
      queryBody.sorts = [{ property: nameKey, direction: "ascending" }];
    }

    const { data } = await notionFetchJson<any>(token, `/databases/${ACCOUNTS_DB}/query`, {
      method: "POST",
      body: queryBody,
      cache: "no-store",
    });

    const accounts = (data.results ?? []).map((page: any) => {
      const properties = page.properties ?? {};
      const nameProp = nameKey ? properties[nameKey] : null;
      const typeProp = typeKey ? properties[typeKey] : null;
      const balanceProp = balanceKey ? properties[balanceKey] : null;
      const readyProp = readyKey ? properties[readyKey] : null;
      const jointDueProp = jointDueKey ? properties[jointDueKey] : null;
        const contributionPercentProp = contributionPercentKey ? properties[contributionPercentKey] : null;

      return {
        id: page.id,
        label: nameProp?.title?.[0]?.plain_text ?? "Unnamed",
        icon: page.icon?.emoji ?? "🏦",
        type: typeProp?.select?.name ?? null,
        balance: readNumber(balanceProp),
        readyToAssign: readNumber(readyProp),
        jointDue: readNumber(jointDueProp),
          contributionPercent: contributionPercentProp?.number ?? null,
      };
    });

    return NextResponse.json({ accounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
