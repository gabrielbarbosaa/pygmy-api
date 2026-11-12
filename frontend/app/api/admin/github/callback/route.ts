import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE,
  SESSION_MAX_AGE,
  allowedGithubUsers,
  appUrl,
  githubEnabled,
  signSession,
} from "../../../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = appUrl(req);
  const back = (error: string) => {
    const res = NextResponse.redirect(`${base}/admin?error=${error}`);
    res.cookies.set("pygmy_oauth", "", { path: "/api/admin/github", maxAge: 0 });
    return res;
  };
  if (!githubEnabled()) return back("config");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const saved = req.cookies.get("pygmy_oauth")?.value ?? "";
  if (
    !code ||
    !saved ||
    saved.length !== state.length ||
    !crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(state))
  ) {
    return back("state");
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${base}/api/admin/github/callback`,
      }),
      cache: "no-store",
    });
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return back("failed");

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "pygmy-admin",
      },
      cache: "no-store",
    });
    if (!userRes.ok) return back("failed");
    const login = String(((await userRes.json()) as { login?: string }).login ?? "").toLowerCase();

    if (!login || !allowedGithubUsers().includes(login)) return back("denied");

    const res = NextResponse.redirect(`${base}/admin`);
    res.cookies.set(COOKIE, signSession(login), {
      httpOnly: true,
      sameSite: "lax",
      secure: base.startsWith("https"),
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    res.cookies.set("pygmy_oauth", "", { path: "/api/admin/github", maxAge: 0 });
    return res;
  } catch {
    return back("failed");
  }
}
