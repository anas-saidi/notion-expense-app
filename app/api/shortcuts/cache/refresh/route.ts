import { NextRequest, NextResponse } from "next/server";
import { requireBearerToken } from "@/lib/shortcut-auth";
import { refreshShortcutOptionsCache } from "@/lib/shortcut-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, "CRON_SECRET", "Shortcut cache refresh");
  if (!auth.ok) return auth.response;

  try {
    const refreshed = await refreshShortcutOptionsCache();
    return NextResponse.json({
      success: true,
      updatedAt: refreshed.updatedAt,
      backend: refreshed.backend,
      counts: {
        categories: refreshed.options.categories.length,
        accounts: refreshed.options.accounts.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Shortcut options refresh failed." },
      { status: 502 },
    );
  }
}
