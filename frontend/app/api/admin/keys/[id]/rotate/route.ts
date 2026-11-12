import { NextRequest, NextResponse } from "next/server";
import { ID_RE, callAdmin, guard } from "../../../../../../lib/adminProxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(req, true);
  if (denied) return denied;
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  return callAdmin(`/keys/${id}/rotate`, "POST");
}
