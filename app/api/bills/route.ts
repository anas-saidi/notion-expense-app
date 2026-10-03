import { withMirrorReads, withMirrorMutation } from "../../../lib/mirror/routes";
import { NextRequest, NextResponse } from "next/server";
import { createBill, deleteBill, payBill, readBills, undoBillPayment, updateBill } from "@/lib/notion-bills";

export const dynamic = "force-dynamic";
async function handle(operation: (token: string) => Promise<unknown>) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  try { return NextResponse.json(await operation(token)); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Could not update bills" }, { status: error.status ?? 500 }); }
}
async function handleGET() { return handle(readBills); }
async function handlePOST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !["create", "pay"].includes(body.action)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return handle(async token => ({ success: true, ...(body.action === "pay" ? { payment: await payBill(token, body) } : { schedule: await createBill(token, body) }) }));
}
async function handlePATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.billId !== "string") return NextResponse.json({ error: "Invalid bill request" }, { status: 400 });
  return handle(async token => ({ success: true, schedule: await updateBill(token, body) }));
}
async function handleDELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.billId === "string") return handle(async token => { await deleteBill(token, body.billId); return { success: true }; });
  if (typeof body?.paymentId !== "string") return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  return handle(async token => { await undoBillPayment(token, body.paymentId); return { success: true }; });
}

export const GET = withMirrorReads(handleGET);

export const POST = withMirrorMutation(handlePOST);

export const PATCH = withMirrorMutation(handlePATCH);

export const DELETE = withMirrorMutation(handleDELETE);

// Background imports need the same bounded lifetime as explicit sync.
export const maxDuration = 240;
