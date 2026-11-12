"use client";

import Logo from "../Logo";

const ERRORS: Record<string, string> = {
  denied: "Esta conta do GitHub não tem permissão de acesso.",
  state: "Sessão de login expirada. Tente novamente.",
  failed: "Não foi possível autenticar com o GitHub. Tente novamente.",
  config: "Login com GitHub não está configurado.",
};

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

export default function Login({ error }: { error?: string }) {
  const message = error ? (ERRORS[error] ?? "Falha no login.") : "";
  return (
    <main className="login-wrap">
      <div className="login glass">
        <Logo size={46} />
        <h1>Área administrativa</h1>
        <p>Acesso restrito. Entre com sua conta do GitHub para gerenciar as credenciais.</p>
        {message && <div className="form-error" role="alert">{message}</div>}
        <a className="btn btn-gh btn-block" href="/api/admin/github/login">
          <GithubMark /> Entrar com GitHub
        </a>
      </div>
    </main>
  );
}
