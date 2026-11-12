"use client";

import { useState } from "react";
import Icon from "./Icon";

export default function CodeTabs({ api }: { api: string }) {
  const tabs: Record<string, string> = {
    curl: `# 1) pedir o código
curl -X POST ${api}/v1/otp/request \\
  -H "Authorization: Bearer $PYGMY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@exemplo.com","app_name":"Minha Loja"}'

# 2) validar o código digitado
curl -X POST ${api}/v1/otp/verify \\
  -H "Authorization: Bearer $PYGMY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@exemplo.com","code":"482916"}'`,
    Python: `import os, requests

API = "${api}/v1/otp"
H = {"Authorization": f"Bearer {os.environ['PYGMY_KEY']}"}

# 1) pedir o código
requests.post(f"{API}/request", json={"email": email}, headers=H, timeout=10).raise_for_status()

# 2) validar o código digitado
r = requests.post(f"{API}/verify", json={"email": email, "code": code}, headers=H, timeout=10)
verified = r.status_code == 200`,
    "Node.js": `const API = "${api}/v1/otp";
const headers = {
  "Content-Type": "application/json",
  Authorization: \`Bearer \${process.env.PYGMY_KEY}\`,
};

// 1) pedir o código
await fetch(\`\${API}/request\`, { method: "POST", headers, body: JSON.stringify({ email }) });

// 2) validar o código digitado
const res = await fetch(\`\${API}/verify\`, { method: "POST", headers, body: JSON.stringify({ email, code }) });
const verified = res.ok;`,
  };
  const names = Object.keys(tabs);
  const [tab, setTab] = useState(names[0]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tabs[tab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <div className="codebox glass">
      <div className="codebox-bar">
        <div className="codebox-dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="codebox-tabs" role="tablist">
          {names.map((n) => (
            <button key={n} role="tab" aria-selected={tab === n} className={tab === n ? "on" : ""} onClick={() => setTab(n)}>
              {n}
            </button>
          ))}
        </div>
        <button className="codebox-copy" onClick={copy} aria-label="Copiar código">
          <Icon name={copied ? "check" : "copy"} /> {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre><code>{tabs[tab]}</code></pre>
    </div>
  );
}
