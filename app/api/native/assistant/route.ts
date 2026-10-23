import { NextRequest } from "next/server";
import { authenticateNative } from "../../../../lib/native/auth";
import { POST as assistant } from "../../ai/route";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const auth = authenticateNative(request); if (auth) return auth;
  return assistant(request);
}
