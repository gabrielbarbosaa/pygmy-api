"use client";

import { FormEvent, useEffect, useState } from "react";
import Icon from "./Icon";
import OtpInput from "./OtpInput";

type Step = "email" | "code" | "done";
type Resp = { status: number; body: unknown } | null;

async function call(action: "request" | "verify", payload: object) {
  const res = await fetch(`/api/otp/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function message(data: { detail?: unknown }): string {
  return typeof data?.detail === "string"
    ? data.detail
    : "Dados inválidos. Verifique e tente novamente.";
}

export default function Demo() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resp, setResp] = useState<Resp>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Validate automatically as soon as the 6th digit is typed/pasted.
  useEffect(() => {
    if (step === "code" && code.length === 6 && !loading) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await call("request", { email });
      setResp({ status: r.status, body: r.data });
      if (!r.ok) return setError(message(r.data));
      setStep("code");
      setCode("");
      setCooldown(60);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(c: string) {
    setError("");
    setLoading(true);
    try {
      const r = await call("verify", { email, code: c });
      setResp({ status: r.status, body: r.data });
      if (!r.ok) {
        setError(message(r.data));
        setCode("");
        return;
      }
      setStep("done");
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("email");
    setEmail("");
    setCode("");
    setError("");
    setResp(null);
    setCooldown(0);
  }

  const idx = step === "email" ? 0 : step === "code" ? 1 : 2;

  return (
    <div className="demo glass" id="demo">
      <div className="demo-glow" aria-hidden="true" />
      <div className="demo-head">
        <span className="badge badge-info"><span className="dot" /> Teste ao vivo</span>
        <ol className="stepper" aria-label="Progresso">
          {["E-mail", "Código", "Pronto"].map((s, i) => (
            <li key={s} className={i <= idx ? "on" : ""}>{i + 1}</li>
          ))}
        </ol>
      </div>

      {step === "email" && (
        <form onSubmit={requestCode} className="demo-body" key="email">
          <h3>Receba um código agora</h3>
          <p>Digite seu e-mail e enviaremos um código real de 6 dígitos.</p>
          <div className="field">
            <label className="label" htmlFor="demo-email">SEU E-MAIL</label>
            <input
              id="demo-email"
              className="input"
              type="email"
              required
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : <>Enviar código <Icon name="arrow" /></>}
          </button>
        </form>
      )}

      {step === "code" && (
        <div className="demo-body" key="code">
          <h3>Digite o código</h3>
          <p>
            Enviamos para <strong>{email}</strong>. Confira também o spam.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} invalid={!!error} />
          <button className="btn btn-primary btn-block" disabled={loading || code.length !== 6} onClick={() => verify(code)}>
            {loading ? <span className="spinner" /> : "Validar código"}
          </button>
          <div className="demo-links">
            <button className="linkbtn" disabled={loading || cooldown > 0} onClick={() => requestCode()}>
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
            </button>
            <button className="linkbtn" onClick={reset}>Trocar e-mail</button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="demo-body demo-done" key="done">
          <div className="done-ring"><Icon name="check" /></div>
          <h3>Verificado!</h3>
          <p><strong>{email}</strong> foi validado com sucesso.</p>
          <button className="btn btn-block" onClick={reset}>Testar de novo</button>
        </div>
      )}

      {error && <p className="demo-error" role="alert">{error}</p>}

      {resp && (
        <div className="demo-resp">
          <div className="demo-resp-head">
            <span>Resposta da API</span>
            <span className={resp.status < 300 ? "ok" : "bad"}>{resp.status}</span>
          </div>
          <pre>{JSON.stringify(resp.body, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
