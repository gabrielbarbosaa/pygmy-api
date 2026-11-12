import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["request", "verify"]);

// Server-side proxy: the browser never sees the API key.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (!ALLOWED.has(action)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  const backend = process.env.BACKEND_URL ?? "http://api:8000";
  const key = process.env.PYGMY_API_KEY ?? "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "JSON inválido" }, { status: 400 });
  }
  // Only forward the fields we expect (never let the browser set app_name, etc.)
  const { email, code } = (body ?? {}) as { email?: string; code?: string };
  const payload = action === "request" ? { email } : { email, code };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  // Your reverse proxy should set X-Forwarded-For to the real client IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) headers["X-End-User-IP"] = ip;

  try {
    const res = await fetch(`${backend}/v1/otp/${action}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Serviço indisponível." }, { status: 502 });
  }
}
