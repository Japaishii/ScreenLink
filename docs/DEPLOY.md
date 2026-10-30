# Publicar em uma VPS Linux

Este pacote alternativo executa uma instância do Screenlink, Caddy (HTTPS) e Coturn (relay de mídia) com Docker Compose. Para publicar na Vercel, siga [VERCEL.md](VERCEL.md). A aplicação agora usa o servidor padrão do Next.js e sinalização HTTPS com presença no banco.

## 1. Pré-requisitos

- VPS Linux com IPv4 público, Docker Engine e plugin Docker Compose instalados. Use uma versão atualizada do Docker e siga a instalação oficial: https://docs.docker.com/engine/install/ubuntu/.
- Como ponto de partida para poucos amigos: 2 vCPU e 2 GB de RAM. O build e as transmissões podem exigir mais recursos; monitore CPU, memória e tráfego.
- Um domínio ou subdomínio, por exemplo `tela.seudominio.com`, com registro DNS **A** apontando para o IPv4 público da VPS. Se configurar AAAA, o IPv6 também precisa estar funcional. Para a primeira instalação, use DNS direto, sem proxy/CDN.
- Acesso SSH ao servidor. Nenhum dado de acesso ao servidor está incluído neste projeto.

## 2. Enviar os arquivos e configurar

Envie o projeto para uma pasta da VPS por Git ou SCP. Não envie `node_modules`, `.next` ou seu `.env` local. Execute os comandos abaixo na pasta do projeto, no servidor:

```sh
cp .env.production.example .env
openssl rand -hex 32
nano .env
```

Preencha as quatro variáveis:

```dotenv
DOMAIN=tela.seudominio.com
ACME_EMAIL=seu-email@seudominio.com
TURN_PUBLIC_IP=IPV4_PUBLICO_DA_VPS
TURN_SECRET=COLE_AQUI_O_SEGREDO_GERADO_PELO_OPENSSL
```

Não inclua `https://` ou caminhos em `DOMAIN`. Não use os valores de exemplo. Mantenha o segredo somente no servidor e evite compartilhar a saída de `docker compose config`, pois ela contém variáveis resolvidas. O navegador recebe credenciais TURN temporárias de 24 horas; o segredo compartilhado fica no backend e no Coturn. Sessões maiores que esse prazo devem reconectar para renovar credenciais.

## 3. Firewall

Libere no firewall da VPS **e** no painel/regras de segurança do provedor:

| Porta | Protocolo | Uso |
| --- | --- | --- |
| 22 ou sua porta SSH | TCP | Administração; preserve seu acesso SSH |
| 80 | TCP | HTTP e emissão de certificado |
| 443 | TCP | Aplicação HTTPS e WebSockets |
| 443 | UDP | HTTP/3 opcional |
| 3478 | TCP e UDP | TURN |
| 49160–49260 | UDP | Mídia retransmitida pelo TURN |

A aplicação não publica a porta 3000 no host. Somente o Caddy acessa essa porta pela rede interna do Compose. Coturn usa a rede do host Linux. A configuração incluída atende uma VPS com um IPv4 público; se sua VPS usa NAT, ajuste `--external-ip` em `compose.yaml` para `IP_PUBLICO/IP_PRIVADO` e mantenha `TURN_PUBLIC_IP` apenas com o IP público. As portas de relay devem ser encaminhadas preservando os números das portas.

Não habilite ou substitua o firewall remoto sem antes preservar a regra de SSH. As portas publicadas pelo Docker também dependem das regras próprias do Docker.

## 4. Iniciar

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy turn
```

O primeiro build pode levar alguns minutos. O Caddy obtém e renova o certificado automaticamente quando o domínio resolve para a VPS e as portas 80/443 estão acessíveis. O domínio precisa estar configurado antes desta etapa.

Abra `https://tela.seudominio.com`. O endereço deve apresentar certificado válido antes do teste de captura de tela. Cadastro e login usam cookies Secure; acessar a aplicação por HTTP puro em produção não é um teste válido de autenticação.

```sh
curl --fail https://tela.seudominio.com/healthz
```

O resultado esperado é `{"status":"ok"}`. Esse endpoint verifica o processo e o acesso ao banco; não testa emissão de certificado, WebRTC nem conectividade TURN.

## 5. Testar com amigos

1. Crie uma conta ou entre como convidado.
2. Crie um servidor público e compartilhe o link com alguém em outra rede (por exemplo, internet móvel).
3. Compartilhe uma tela em um navegador desktop compatível e confirme o recebimento da imagem. Áudio depende do navegador e da fonte escolhida na captura.
4. Crie um servidor privado e confirme que outro usuário precisa da senha. Confira também login e logout.
5. No Chrome, `chrome://webrtc-internals` permite inspecionar o par ICE selecionado. Um candidato `relay` indica uso do TURN; uma conexão direta bem-sucedida não valida o relay. Para redes que bloqueiam também TCP/UDP 3478, será necessário um serviço TURN com TLS em uma porta permitida, normalmente 443, em outro IP/host (o Caddy já utiliza 443 nesta VPS).

## 6. Persistência, atualização e backup

Os volumes nomeados `screenlink_app_data`, `screenlink_caddy_data` e `screenlink_caddy_config` persistem entre recriações dos containers. O primeiro contém o banco; o segundo contém certificados. `docker compose down` preserva esses volumes. **Não execute `docker compose down -v` se quiser manter os dados.**

Para atualizar, envie o código novo (ou use `git pull`, se instalou via Git) e execute:

```sh
docker compose up -d --build
```

Atualizações e reinícios podem interromper a sinalização; os clientes tentam reconectar. Este Compose usa banco em arquivo e uma instância do app; mantenha uma réplica para esse modo. Na Vercel, o banco externo compartilha presença e sinalização entre as Functions.

Faça backup antes de atualizar. Com o app parado, o banco não recebe novas gravações; copie o diretório completo para incluir eventuais arquivos WAL:

```sh
docker compose stop app
docker compose cp app:/app/data ./backup-data
docker compose up -d app
```

Use uma pasta de destino nova a cada backup para não misturar versões e guarde uma cópia fora da VPS. Para restaurar, pare o app e substitua o conteúdo do volume por um backup completo, preservando proprietário UID/GID 1000. Não sobreponha um banco em uso.

## Diagnóstico

- **Caddy sem certificado:** confira DNS, portas 80/443, registros AAAA e logs do Caddy.
- **Login retorna origem não autorizada:** confirme que o endereço acessado é exatamente `https://DOMAIN`. Depois de mudar `.env`, execute `docker compose up -d` para recriar os serviços.
- **Sala conecta, mas não aparece imagem:** confira portas 3478 e 49160–49260 UDP, IP público/NAT, relógio do servidor e logs do Coturn. O relógio deve estar sincronizado para credenciais temporárias.
- **Container app unhealthy:** consulte logs; confira espaço em disco e permissão do volume. O processo roda como usuário sem privilégios (`node`, UID 1000). `DATA_DIR` continua válido para o banco local.
- **Reinício inesperado:** `restart: unless-stopped` recupera processos encerrados e reinicia serviços após reboot se o Docker estiver habilitado. O healthcheck indica falhas, mas não reinicia sozinho processos ainda vivos.

As configurações de proxy seguem https://caddyserver.com/docs/caddyfile/directives/reverse_proxy. As credenciais e portas TURN seguem https://github.com/coturn/coturn/blob/4.6.3/examples/etc/turnserver.conf.
