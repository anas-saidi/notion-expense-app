import { NextResponse } from "next/server";

// Auth is handled via internal Notion token — no OAuth needed.
export function GET() { return NextResponse.json({ error: "Not used" }, { status: 404 }); }
export function POST() { return NextResponse.json({ error: "Not used" }, { status: 404 }); }
