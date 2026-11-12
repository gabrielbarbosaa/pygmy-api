"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../Icon";
import Logo from "../Logo";

type Daily = { date: string; sent: number; ok: number; fail: number };
type Key = {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  builtin: boolean;
  created: number | null;
  last_used: number | null;
  totals: { sent: number; ok: number; fail: number };
  daily: Daily[];
};

type Modal =
  | { type: "create" }
  | { type: "rename"; key: Key }
  | { type: "secret"; name: string; secret: string; rotated: boolean }
  | { type: "confirm"; title: string; body: string; label: string; danger?: boolean; run: () => Promise<void> };

async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Sessão expirada");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data?.detail;
    throw new Error(typeof d === "string" ? d : "Dados inválidos");
  }
  return data as T;
}

function ago(ts: number | null): string {
  if (!ts) return "nunca";
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "agora há pouco";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}
const fmtDate = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nf = (n: number) => n.toLocaleString("pt-BR");

function Spark({ daily }: { daily: Daily[] }) {
  const max = Math.max(1, ...daily.map((d) => d.sent + d.ok + d.fail));
  return (
    <div className="spark" aria-label="Uso nos últimos 14 dias">
      {daily.map((d) => {
        const total = d.sent + d.ok + d.fail;
        return (
          <i
            key={d.date}
            className={total ? "has" : ""}
            style={{ height: `${Math.max(8, (total / max) * 100)}%` }}
            title={`${d.date}: ${d.sent} enviados · ${d.ok} válidos · ${d.fail} falhas`}
          />
        );
      })}
    </div>
  );
}

export default function Dashboard({ user }: { user: string }) {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      setKeys((await api<{ keys: Key[] }>("/keys")).keys);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };

  const stats = useMemo(() => {
    const mine = (keys ?? []).filter((k) => !k.builtin);
    const all = keys ?? [];
    const today = all.reduce((a, k) => a + (k.daily.at(-1)?.sent ?? 0), 0);
    const ok = all.reduce((a, k) => a + k.daily.reduce((x, d) => x + d.ok, 0), 0);
    const fail = all.reduce((a, k) => a + k.daily.reduce((x, d) => x + d.fail, 0), 0);
    return {
      total: mine.length,
      active: mine.filter((k) => k.enabled).length,
      today,
      rate: ok + fail ? Math.round((ok / (ok + fail)) * 100) : null,
    };
  }, [keys]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  const toggle = async (k: Key) => {
    try {
      await api(`/keys/${k.id}`, "PATCH", { enabled: !k.enabled });
      notify(k.enabled ? "Credencial desativada" : "Credencial ativada");
      await load();
    } catch (e) { notify((e as Error).message); }
  };

  const askRotate = (k: Key) =>
    setModal({
      type: "confirm", title: "Girar chave?", label: "Girar chave", danger: true,
      body: `A chave atual de “${k.name}” deixará de funcionar imediatamente. Você receberá uma nova chave para atualizar no projeto.`,
      run: async () => {
        const r = await api<{ secret: string }>(`/keys/${k.id}/rotate`, "POST");
        setModal({ type: "secret", name: k.name, secret: r.secret, rotated: true });
        await load();
      },
    });

  const askDelete = (k: Key) =>
    setModal({
      type: "confirm", title: "Excluir credencial?", label: "Excluir", danger: true,
      body: `“${k.name}” será removida e o projeto que a usa perderá o acesso. Esta ação não pode ser desfeita.`,
      run: async () => {
        await api(`/keys/${k.id}`, "DELETE");
        setModal(null);
        notify("Credencial excluída");
        await load();
      },
    });

  return (
    <div className="admin">
      <header className="topbar">
        <div className="container topbar-in">
          <a href="/" className="brand"><Logo size={30} /> pygmy <span className="badge">admin</span></a>
          <div className="topbar-right">
            <span className="topbar-user">
              {user !== "admin" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={`https://github.com/${encodeURIComponent(user)}.png?size=52`} alt="" />
              )}
              {user}
            </span>
            <button className="btn btn-sm" onClick={logout}><Icon name="logout" /> Sair</button>
          </div>
        </div>
      </header>

      <main className="container admin-main">
        <div className="admin-title">
          <div>
            <h1>Credenciais</h1>
            <p>Uma chave por projeto. O segredo só aparece uma vez, na criação.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ type: "create" })}>
            <Icon name="plus" /> Nova credencial
          </button>
        </div>

        <section className="stat-row">
          <div className="stat glass"><Icon name="key" /><span>Credenciais</span><strong>{stats.total}</strong></div>
          <div className="stat glass"><Icon name="power" /><span>Ativas</span><strong>{stats.active}</strong></div>
          <div className="stat glass"><Icon name="mail" /><span>Códigos hoje</span><strong>{nf(stats.today)}</strong></div>
          <div className="stat glass"><Icon name="check" /><span>Validações ok (14d)</span><strong>{stats.rate === null ? "—" : `${stats.rate}%`}</strong></div>
        </section>

        {error && <div className="form-error">{error}</div>}
        {keys === null && !error && <div className="empty"><span className="spinner" /></div>}

        {keys && keys.filter((k) => !k.builtin).length === 0 && (
          <div className="empty glass">
            <Icon name="key" />
            <h3>Nenhuma credencial ainda</h3>
            <p>Crie a primeira para usar a API em um projeto.</p>
            <button className="btn btn-primary" onClick={() => setModal({ type: "create" })}><Icon name="plus" /> Nova credencial</button>
          </div>
        )}

        <div className="keys">
          {keys?.map((k) => (
            <article key={k.id} className={`key glass ${k.enabled ? "" : "is-off"}`}>
              <div className="key-main">
                <div className="key-name">
                  <h3>{k.name}</h3>
                  {k.builtin ? (
                    <span className="badge badge-info">Embutida · demo do site</span>
                  ) : k.enabled ? (
                    <span className="badge badge-ok"><span className="dot" /> Ativa</span>
                  ) : (
                    <span className="badge badge-off">Desativada</span>
                  )}
                </div>
                <div className="key-meta">
                  <code>{k.builtin ? "definida no .env (PYGMY_WEB_KEY)" : `${k.prefix}••••••••••••`}</code>
                  <span>Criada: {fmtDate(k.created)}</span>
                  <span>Último uso: {ago(k.last_used)}</span>
                </div>
              </div>

              <div className="key-nums">
                <div><strong>{nf(k.totals.sent)}</strong><span>enviados</span></div>
                <div><strong className="c-ok">{nf(k.totals.ok)}</strong><span>validados</span></div>
                <div><strong className="c-bad">{nf(k.totals.fail)}</strong><span>falhas</span></div>
              </div>

              <Spark daily={k.daily} />

              {!k.builtin && (
                <div className="key-actions">
                  <button className="icon-btn" title="Renomear" onClick={() => setModal({ type: "rename", key: k })}><Icon name="pencil" /></button>
                  <button className="icon-btn" title={k.enabled ? "Desativar" : "Ativar"} onClick={() => toggle(k)}><Icon name="power" /></button>
                  <button className="icon-btn" title="Girar chave" onClick={() => askRotate(k)}><Icon name="refresh" /></button>
                  <button className="icon-btn danger" title="Excluir" onClick={() => askDelete(k)}><Icon name="trash" /></button>
                </div>
              )}
            </article>
          ))}
        </div>
      </main>

      {modal && <ModalHost modal={modal} close={() => setModal(null)} setModal={setModal} reload={load} notify={notify} />}
      {toast && <div className="toast" role="status"><Icon name="check" /> {toast}</div>}
    </div>
  );
}

function ModalHost({
  modal, close, setModal, reload, notify,
}: {
  modal: Modal;
  close: () => void;
  setModal: (m: Modal | null) => void;
  reload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [name, setName] = useState(modal.type === "rename" ? modal.key.name : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setErr("");
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    void guard(async () => {
      if (modal.type === "create") {
        const r = await api<{ secret: string }>("/keys", "POST", { name });
        setModal({ type: "secret", name, secret: r.secret, rotated: false });
      } else if (modal.type === "rename") {
        await api(`/keys/${modal.key.id}`, "PATCH", { name });
        notify("Credencial renomeada");
        close();
      }
      await reload();
    });
  };

  const dismissable = modal.type !== "secret";

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && dismissable && close()}>
      <div className="modal glass" role="dialog" aria-modal="true">
        {(modal.type === "create" || modal.type === "rename") && (
          <form onSubmit={submitName}>
            <h2>{modal.type === "create" ? "Nova credencial" : "Renomear credencial"}</h2>
            <p>Use o nome do projeto que vai consumir a API.</p>
            <div className="field">
              <label className="label" htmlFor="kn">NOME</label>
              <input id="kn" className="input" autoFocus required maxLength={60} placeholder="ex.: minha-loja" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {err && <div className="form-error">{err}</div>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" disabled={busy || !name.trim()}>
                {busy ? <span className="spinner" /> : modal.type === "create" ? "Criar" : "Salvar"}
              </button>
            </div>
          </form>
        )}

        {modal.type === "confirm" && (
          <div>
            <h2>{modal.title}</h2>
            <p>{modal.body}</p>
            {err && <div className="form-error">{err}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={close}>Cancelar</button>
              <button className={`btn ${modal.danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={() => guard(modal.run)}>
                {busy ? <span className="spinner" /> : modal.label}
              </button>
            </div>
          </div>
        )}

        {modal.type === "secret" && (
          <div>
            <div className="secret-ico"><Icon name="key" /></div>
            <h2>{modal.rotated ? "Nova chave gerada" : "Credencial criada"}</h2>
            <p>
              Copie agora a chave de <strong>{modal.name}</strong>. Por segurança, ela <strong>não será exibida novamente</strong>.
            </p>
            <div className="secret">
              <code>{modal.secret}</code>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(modal.secret); setCopied(true); } catch {}
                }}
              >
                <Icon name={copied ? "check" : "copy"} /> {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="hint">Use no seu backend: <code>Authorization: Bearer {modal.secret.slice(0, 8)}…</code></p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={close}>Já copiei, fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
