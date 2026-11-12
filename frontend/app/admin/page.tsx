import "./admin.css";
import type { Metadata } from "next";
import Dashboard from "../../components/admin/Dashboard";
import Login from "../../components/admin/Login";
import Logo from "../../components/Logo";
import { adminEnabled, getAdmin } from "../../lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "pygmy · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const bg = (
    <div className="bg-ambient" aria-hidden="true">
      <div className="orb orb-1" /><div className="orb orb-2" />
    </div>
  );

  if (!adminEnabled()) {
    return (
      <>
        {bg}
        <main className="login-wrap">
          <div className="login glass">
            <Logo size={44} />
            <h1>Admin desativado</h1>
            <p>
              Defina <code>PYGMY_ADMIN_KEY</code>, <code>GITHUB_CLIENT_ID</code>,{" "}
              <code>GITHUB_CLIENT_SECRET</code> e <code>ADMIN_GITHUB_USERS</code> no .env e reinicie.
            </p>
          </div>
        </main>
      </>
    );
  }

  const user = await getAdmin();
  const { error } = await searchParams;
  return (
    <>
      {bg}
      {user ? (
        <Dashboard user={user} />
      ) : (
        <Login error={error} />
      )}
    </>
  );
}
