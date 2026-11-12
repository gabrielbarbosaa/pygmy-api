import { NextRequest, NextResponse } from "next/server";
import { callAdmin, guard } from "../../../../lib/adminProxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return guard(req, false) ?? callAdmin("/keys", "GET");
}

export async function POST(req: NextRequest) {
  const denied = guard(req, true);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  return callAdmin("/keys", "POST", { name: String(body?.name ?? "") });
}
