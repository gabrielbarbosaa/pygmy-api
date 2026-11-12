import "./landing.css";
import CodeTabs from "../components/CodeTabs";
import Demo from "../components/Demo";
import Icon from "../components/Icon";
import Logo from "../components/Logo";

// Read PUBLIC_API_URL at request time (not baked at build).
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "mail", title: "E-mail bonito, pronto", text: "Template HTML moderno com modo escuro e fallback em texto. Você só informa o nome do seu app." },
  { icon: "shield", title: "Seguro por padrão", text: "Código guardado apenas como hash, uso único, expira em minutos e bloqueia após tentativas erradas." },
  { icon: "layers", title: "Um serviço, vários projetos", text: "Uma credencial por projeto, com espaço isolado: o mesmo e-mail em dois apps nunca se mistura." },
  { icon: "bolt", title: "Duas chamadas e pronto", text: "POST para pedir, POST para validar. Sem SDK, sem dependências: funciona com qualquer linguagem." },
  { icon: "clock", title: "Anti-abuso embutido", text: "Intervalo entre reenvios e limite de pedidos por hora, por e-mail e por IP do usuário final." },
  { icon: "chart", title: "Painel de credenciais", text: "Crie, desative, gire e revogue chaves em segundos, com métricas de uso dos últimos 14 dias." },
];

const STEPS = [
  { n: "01", title: "Peça o código", text: "Seu backend chama POST /v1/otp/request com o e-mail do usuário." },
  { n: "02", title: "Usuário recebe", text: "Um e-mail elegante chega com o código de 6 dígitos, válido por 5 minutos." },
  { n: "03", title: "Valide", text: "Seu backend chama POST /v1/otp/verify e recebe {\"verified\": true}." },
];

const FACTS = [
  ["6 dígitos", "gerados com fonte criptográfica"],
  ["5 min", "de validade e uso único"],
  ["5 tentativas", "antes de invalidar o código"],
  ["60 s", "de intervalo entre reenvios"],
];

export default function Home() {
  const api = (process.env.PUBLIC_API_URL || "https://pygmy.gabrielbarbosadev.com.br").replace(/\/$/, "");

  return (
    <>
      <div className="bg-ambient" aria-hidden="true">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>

      <header className="nav">
        <div className="container nav-in">
          <a href="#top" className="brand"><Logo size={30} /> pygmy</a>
          <nav className="nav-links" aria-label="Principal">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#docs">API</a>
          </nav>
          <a href="#demo" className="btn btn-primary btn-sm">Testar agora</a>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero container">
          <div className="hero-copy">
            <span className="badge badge-info rise" style={{ animationDelay: "0s" }}>
              <span className="dot" /> OTP por e-mail · API simples
            </span>
            <h1 className="rise" style={{ animationDelay: ".08s" }}>
              Verificação por código, <span className="grad-text">sem dor de cabeça.</span>
            </h1>
            <p className="lead rise" style={{ animationDelay: ".16s" }}>
              pygmy envia e valida códigos OTP por e-mail para todos os seus projetos.
              Uma API enxuta, segura e pronta para usar em minutos.
            </p>
            <div className="hero-cta rise" style={{ animationDelay: ".24s" }}>
              <a href="#demo" className="btn btn-primary">Experimentar <Icon name="arrow" /></a>
              <a href="#docs" className="btn"><Icon name="code" /> Ver a API</a>
            </div>
            <ul className="facts rise" style={{ animationDelay: ".32s" }}>
              {FACTS.map(([a, b]) => (
                <li key={a}><strong>{a}</strong><span>{b}</span></li>
              ))}
            </ul>
          </div>
          <div className="hero-demo rise" style={{ animationDelay: ".2s" }}>
            <Demo />
          </div>
        </section>

        {/* FEATURES */}
        <section id="recursos" className="section container">
          <div className="section-head">
            <span className="eyebrow">Recursos</span>
            <h2>Tudo que um OTP precisa, <span className="grad-text">nada além.</span></h2>
            <p>Feito para ser plugado em qualquer projeto pessoal ou profissional.</p>
          </div>
          <div className="grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="feature glass">
                <div className="feature-icon"><Icon name={f.icon} /></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* HOW */}
        <section id="como-funciona" className="section container">
          <div className="section-head">
            <span className="eyebrow">Como funciona</span>
            <h2>Três passos, <span className="grad-text">um fluxo.</span></h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.n} className="step glass">
                <span className="step-n grad-text">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DOCS */}
        <section id="docs" className="section container">
          <div className="section-head">
            <span className="eyebrow">API</span>
            <h2>Integre em <span className="grad-text">minutos.</span></h2>
            <p>
              Autentique com <code>Authorization: Bearer &lt;chave&gt;</code>. Chame sempre do
              seu backend — nunca exponha a chave no navegador.
            </p>
          </div>
          <div className="docs">
            <CodeTabs api={api} />
            <div className="endpoints">
              <div className="endpoint glass">
                <div><span className="verb">POST</span><code>/v1/otp/request</code></div>
                <p>Envia o código. Body: <code>email</code>, opcional <code>app_name</code>.</p>
                <small>202 enviado · 429 aguarde/limite · 503 falha no e-mail</small>
              </div>
              <div className="endpoint glass">
                <div><span className="verb">POST</span><code>/v1/otp/verify</code></div>
                <p>Valida o código. Body: <code>email</code>, <code>code</code>.</p>
                <small>200 verificado · 400 inválido/expirado · 429 tentativas excedidas</small>
              </div>
              <div className="endpoint glass">
                <div><span className="verb alt">HEADER</span><code>X-End-User-IP</code></div>
                <p>Opcional. IP do seu usuário final, para ativar o limite por IP.</p>
                <small>Documentação interativa em <code>/docs</code></small>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container cta-wrap">
          <div className="cta glass">
            <h2>Pronto para <span className="grad-text">verificar?</span></h2>
            <p>Teste o fluxo completo agora mesmo, com o seu e-mail.</p>
            <a href="#demo" className="btn btn-primary">Fazer o teste <Icon name="arrow" /></a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-in">
          <a href="#top" className="brand"><Logo size={24} /> pygmy</a>
          <span>OTP por e-mail para todos os seus projetos.</span>
        </div>
      </footer>
    </>
  );
}
