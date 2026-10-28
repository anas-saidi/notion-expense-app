// Account balances must be read per request, never captured by the production build.
import { withMirrorReads } from "../../../lib/mirror/routes";
import { readAccountResponse } from "../../../lib/notion-accounts";
export const dynamic = "force-dynamic";
export const GET = withMirrorReads(readAccountResponse);
export const maxDuration = 240;
