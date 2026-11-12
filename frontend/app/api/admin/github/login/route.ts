import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { appUrl, githubEnabled } from "../../../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = appUrl(req);
  if (!githubEnabled()) return NextResponse.redirect(`${base}/admin?error=config`);

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${base}/api/admin/github/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");

  const res = NextResponse.redirect(url);
  res.cookies.set("pygmy_oauth", state, {
    httpOnly: true,
    sameSite: "lax", // must survive the cross-site redirect back from GitHub
    secure: base.startsWith("https"),
    path: "/api/admin/github",
    maxAge: 600,
  });
  return res;
}
