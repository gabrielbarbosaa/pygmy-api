import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "./session";

const BACKEND = () => process.env.BACKEND_URL ?? "http://api:8000";

export const ID_RE = /^[a-z0-9]{1,16}$/;

/** Returns an error response if the caller is not a logged-in admin. */
export function guard(req: NextRequest, mutating: boolean): NextResponse | null {
  if (!verifySession(req.cookies.get(COOKIE)?.value)) {
    return NextResponse.json({ detail: "Não autorizado" }, { status: 401 });
  }
  if (mutating) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ detail: "Origem inválida" }, { status: 403 });
    }
  }
  return null;
}

export async function callAdmin(
  path: string,
  method: string,
  body?: unknown
): Promise<NextResponse> {
  try {
    const res = await fetch(`${BACKEND()}/admin${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": process.env.PYGMY_ADMIN_KEY ?? "",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Serviço indisponível." }, { status: 502 });
  }
}
