# Publicar o pygmy com o Caddy (em Docker) que já roda na VPS

Pré-requisitos: DNS `A` de `pygmy.gabrielbarbosadev.com.br` → IP da VPS, e o pygmy
rodando (`docker compose up -d --build` em `~/apps/pygmy-api`).

## 1. Achar a pasta do proxy
```bash
CADDY_DIR=$(docker inspect proxy-caddy-1 --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')
echo "$CADDY_DIR"; ls -la "$CADDY_DIR"
docker inspect proxy-caddy-1 --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```
Confirme qual arquivo é montado em `/etc/caddy/Caddyfile` (normalmente `$CADDY_DIR/Caddyfile`).

## 2. Colocar o Caddy na rede do pygmy (agora, sem reiniciar)
```bash
docker network connect pygmy_net proxy-caddy-1
```

## 3. Adicionar o site ao Caddyfile
```bash
cd "$CADDY_DIR"
cp Caddyfile Caddyfile.bak
cat ~/apps/pygmy-api/deploy/Caddyfile.pygmy >> Caddyfile
docker exec proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
```

## 4. Recarregar (sem derrubar os outros sites)
```bash
docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```
O Caddy emite o certificado sozinho (pode levar ~30 s). Logs: `docker logs -f proxy-caddy-1`.

## 5. Tornar a rede permanente
O passo 2 se perde se o container do Caddy for recriado. No compose do proxy
(`$CADDY_DIR/docker-compose.yml`), no serviço `caddy`, adicione:

```yaml
services:
  caddy:
    networks:
      - default          # mantenha a rede atual do proxy
      - pygmy_net
networks:
  pygmy_net:
    external: true
```
Depois: `docker compose up -d caddy` (recria só o Caddy; ~2 s de indisponibilidade).
Se o serviço já tem `networks:`, só acrescente `- pygmy_net` e a seção `external`.

## Desfazer
```bash
cd "$CADDY_DIR" && cp Caddyfile.bak Caddyfile
docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```
