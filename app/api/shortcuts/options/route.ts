import { NextRequest, NextResponse } from "next/server";
import { requireBearerToken } from "@/lib/shortcut-auth";
import {
  getShortcutOptionsSnapshot,
  shortcutOptionsAgeSeconds,
  shortcutCacheTtlSeconds,
} from "@/lib/shortcut-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, "SHORTCUT_API_TOKEN", "Shortcut API");
  if (!auth.ok) return auth.response;

  try {
    const snapshot = await getShortcutOptionsSnapshot();
    return NextResponse.json(
      {
        categories: snapshot.options.categories,
        accounts: snapshot.options.accounts,
        cache: {
          updatedAt: snapshot.updatedAt,
          ageSeconds: shortcutOptionsAgeSeconds(snapshot.updatedAt),
          stale: snapshot.stale,
          ttlSeconds: shortcutCacheTtlSeconds(),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Shortcut-Options-Stale": snapshot.stale ? "true" : "false",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Shortcut options are temporarily unavailable." },
      { status: 503 },
    );
  }
}
