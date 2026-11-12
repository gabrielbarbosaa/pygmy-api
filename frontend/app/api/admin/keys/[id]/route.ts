import { NextRequest, NextResponse } from "next/server";
import { ID_RE, callAdmin, guard } from "../../../../../lib/adminProxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = guard(req, true);
  if (denied) return denied;
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const payload: { name?: string; enabled?: boolean } = {};
  if (typeof body?.name === "string") payload.name = body.name;
  if (typeof body?.enabled === "boolean") payload.enabled = body.enabled;
  return callAdmin(`/keys/${id}`, "PATCH", payload);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = guard(req, true);
  if (denied) return denied;
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  return callAdmin(`/keys/${id}`, "DELETE");
}
