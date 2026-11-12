# pygmy

API de OTP por e-mail para usar em todos os seus projetos — com site pronto (Next.js), backend FastAPI + Redis, tudo em Docker.

```
seus projetos ──(API key)──┐
                           ▼
navegador ──► pygmy.gabrielbarbosadev.com.br ── nginx ──┬─ /v1, /docs ─► api (FastAPI) ─► redis
                                                        └─ resto ──────► web (Next.js)
```

## Deploy na VPS (pygmy.gabrielbarbosadev.com.br)

Roda em paralelo com o seu outro projeto: containers `pygmy-*`, rede `pygmy_net`, volume próprio, portas só em `127.0.0.1`.

1. **DNS** (Hostinger → DNS do domínio): registro `A` → `pygmy` apontando para o IP da VPS.
2. **Código**: `git clone https://github.com/gabrielbarbosaa/pygmy-api.git && cd pygmy-api`
3. **Segredos**: `cp .env.production.example .env` e preencha (gere com `openssl rand -hex 32`).
4. **GitHub OAuth App de produção** (github.com/settings/developers → New OAuth App):
   Homepage `https://pygmy.gabrielbarbosadev.com.br` · Callback `https://pygmy.gabrielbarbosadev.com.br/api/admin/github/callback`.
5. **Portas livres?** `ss -ltn | grep -E ':3100|:8100'` — se ocupadas, mude `WEB_PORT`/`API_PORT` no `.env` **e** em `deploy/nginx-pygmy.conf`.
6. **Subir**: `docker compose up -d --build`
7. **Proxy + HTTPS**
   - **Caddy em Docker** (caso desta VPS): coloque o container do Caddy na rede `pygmy_net` e acrescente `deploy/Caddyfile.pygmy` ao Caddyfile; o HTTPS é automático. Passo a passo em `deploy/CADDY.md`.
   - **nginx no host**: copie `deploy/nginx-pygmy.conf` para o diretório de sites, `nginx -t && systemctl reload nginx` e `certbot --nginx -d pygmy.gabrielbarbosadev.com.br`.
8. **Atualizar depois**: `./deploy/update.sh`.

Se o seu outro projeto usa Caddy/Traefik em vez de nginx, a regra é a mesma: `/v1/*`, `/docs`, `/openapi.json` → `127.0.0.1:8100`; o resto → `127.0.0.1:3100`; enviando `X-Forwarded-For`/`X-Forwarded-Proto`.

### E-mail pela Hostinger
1. No hPanel → **E-mails**, crie uma caixa (ex.: `no-reply@seudominio.com`).
2. No `.env`:
   ```
   OTP_SENDER=smtp
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_USE_SSL=true
   SMTP_USER=no-reply@seudominio.com
   SMTP_PASSWORD=<senha da caixa>
   ```
   (Alternativa: porta `587` com `SMTP_USE_SSL=false`.)
3. O remetente precisa ser a própria caixa autenticada (`SMTP_FROM` vazio já faz isso). Para exibir um nome: `SMTP_FROM=pygmy <no-reply@seudominio.com>`.
4. Se o domínio usa o DNS da Hostinger, SPF/DKIM já vêm configurados — isso evita cair no spam. Em DNS externo, copie os registros SPF/DKIM do hPanel.
5. Teste: `docker compose up -d --build`, peça um código no site e confira o e-mail; erros aparecem em `docker logs pygmy-api`.

Obs.: planos de hospedagem têm limite de envios por hora/dia; o limite por e-mail do pygmy (5/h) ajuda a ficar abaixo dele.

### Login do admin com GitHub
1. Em github.com/settings/developers → **OAuth Apps → New OAuth App**:
   - Homepage URL: `http://localhost:3100` (em produção: `https://pygmy.gabrielbarbosadev.com.br`)
   - Authorization callback URL: `<URL do site>/api/admin/github/callback`
2. Gere um **Client secret** e preencha no `.env`:
   ```
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   ADMIN_GITHUB_USERS=seu-usuario      # vários: separe por vírgula
   APP_URL=http://localhost:3100       # produção: https://pygmy.gabrielbarbosadev.com.br
   ```
3. `docker compose up -d`. Só os usuários listados em `ADMIN_GITHUB_USERS` entram; qualquer outra conta do GitHub é recusada.
4. O login é **somente por GitHub** (não existe senha). Para produção e local use dois OAuth Apps (callbacks diferentes).

### Painel admin (`/admin`)
Entre com **GitHub** em `https://pygmy.gabrielbarbosadev.com.br/admin`. Lá você cria, renomeia, desativa, gira (rotaciona) e exclui credenciais — **uma por projeto** — e vê o uso dos últimos 14 dias.
- O segredo (`pyg_...`) aparece **uma única vez**; no Redis fica só o hash SHA-256.
- Cada credencial tem **namespace isolado**: o mesmo e-mail em dois projetos nunca compartilha código nem limites.
- O painel fala com a API usando `PYGMY_ADMIN_KEY` (só o servidor do site conhece). Sessão: cookie httpOnly de 12 h.
- O `/admin` do backend não é roteado pelo nginx: só o container do site fala com ele, pela rede interna.

### Sem interferir no seu outro serviço
- Projeto compose `pygmy`, rede `pygmy_net`, volume `pygmy_redis_data`, containers `pygmy-*`, com limites de memória/CPU.
- Redis nunca é publicado. API e site publicam **apenas em 127.0.0.1**: API em `API_PORT` (8100), site em `WEB_PORT` (3100).
- Confira se estão livres: `ss -ltn | grep -E '3100|8100'` (ou mude no `.env`).

## Usando a API

Autentique com `Authorization: Bearer <chave>` (ou `X-API-Key`). **Chame sempre do seu backend** — nunca coloque a chave em código de navegador/app.

| Endpoint | Body | Resposta |
|---|---|---|
| `POST /v1/otp/request` | `{"email", "app_name"?}` | `202 {"status":"sent","expires_in":300}` |
| `POST /v1/otp/verify` | `{"email", "code"}` | `200 {"verified":true}` · `400` inválido/expirado · `429` tentativas excedidas |

- `app_name` (opcional) é o nome exibido no e-mail; padrão `pygmy`.
- `X-End-User-IP` (opcional): envie o IP do seu usuário final para ativar o limite por IP.
- Outros erros: `401` chave inválida · `429` cooldown/limite · `503` falha ao enviar e-mail.

**curl**
```bash
curl -X POST https://pygmy.gabrielbarbosadev.com.br/v1/otp/request \
  -H "Authorization: Bearer $PYGMY_KEY" -H "Content-Type: application/json" \
  -d '{"email":"user@exemplo.com","app_name":"Minha Loja"}'

curl -X POST https://pygmy.gabrielbarbosadev.com.br/v1/otp/verify \
  -H "Authorization: Bearer $PYGMY_KEY" -H "Content-Type: application/json" \
  -d '{"email":"user@exemplo.com","code":"482916"}'
```

**Python**
```python
import os, requests
API = "https://pygmy.gabrielbarbosadev.com.br/v1/otp"
H = {"Authorization": f"Bearer {os.environ['PYGMY_KEY']}"}

requests.post(f"{API}/request", json={"email": email}, headers=H, timeout=10).raise_for_status()
ok = requests.post(f"{API}/verify", json={"email": email, "code": code}, headers=H, timeout=10).status_code == 200
```

**Node / TypeScript**
```ts
const API = "https://pygmy.gabrielbarbosadev.com.br/v1/otp";
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PYGMY_KEY}` };

await fetch(`${API}/request`, { method: "POST", headers, body: JSON.stringify({ email }) });
const ok = (await fetch(`${API}/verify`, { method: "POST", headers, body: JSON.stringify({ email, code }) })).ok;
```

Se o seu outro projeto roda no **mesmo servidor em Docker**, prefira conectá-lo à rede `pygmy_net` e chamar `http://api:8000` (sem passar pela internet).

## Regras de segurança do OTP
- Código de 6 dígitos (`secrets`), guardado só como HMAC no Redis; expira em 5 min; uso único.
- Máx. 5 tentativas por código; depois ele é invalidado.
- Cooldown de 60 s para reenvio; 5 pedidos/hora por e-mail (e 20/hora por IP quando informado).
- Ajuste em `backend/app/config.py` (ou variáveis de ambiente).

## Dev / testes
```bash
docker run --rm -v ./backend:/srv -w /srv python:3.12-slim sh -c "pip install -q -r requirements-dev.txt && pytest -q"
```
Use `OTP_SENDER=console` para ver o código em `docker logs pygmy-api` (só dev).




