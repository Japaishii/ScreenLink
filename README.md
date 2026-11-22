# Screenlink

Compartilhamento de tela em Next.js e TypeScript, com login, convidados, servidores públicos/privados e convites por link. **Adaptado para o deploy padrão da Vercel.**

## Publicar na Vercel

Siga [o guia completo](docs/VERCEL.md). É necessário um banco libSQL remoto (por exemplo, Turso/libSQL). Para mídia entre redes restritas, configure também um provedor TURN externo.

1. Importe o repositório na Vercel como Next.js.
2. Cadastre `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` nas variáveis do projeto.
3. Cadastre `TURN_URL`, `TURN_USERNAME` e `TURN_PASSWORD` (ou `TURN_SECRET` para Coturn próprio).
4. Faça o deploy e compartilhe a URL HTTPS.

O arquivo `.env.vercel.example` lista as variáveis. O banco é inicializado automaticamente na primeira requisição; nenhum segredo deve usar prefixo `NEXT_PUBLIC_`.

## Desenvolvimento

Node.js 22.13 ou superior:

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Sem variáveis de banco remoto, o desenvolvimento usa `data/screenlink.sqlite`. Você pode copiar `.env.example` para `.env.local` e configurar um banco remoto e TURN.

```sh
npm test
npm run build
npm start
```

`npm test` inicia temporariamente um Next.js em uma porta aleatória e um banco SQLite isolado. Encerre outro `next dev` deste mesmo projeto antes de rodar o teste de integração, pois o Next.js usa um lock de desenvolvimento. O teste não acessa seu banco de produção. `npm start` usa cookies Secure em produção e requer HTTPS para autenticação no navegador.

## Como funciona

- Abrir uma sala mostra primeiro o chat e os participantes da chamada, sem registrar presença na call, buscar mídia ou solicitar dispositivos. O botão **Entrar na chamada** inicia a conexão; sair da chamada retorna ao chat. Salas privadas continuam exigindo senha antes da visualização.
- O chat também pode ser usado por quem está somente visualizando a sala. Histórico e lista de participantes são atualizados por consultas curtas com autorização da sala.
- Explorar servidores mostra atividade real, telas ao vivo, nomes dos criadores e avatares dos participantes. Inclui busca por nome/descrição/criador, filtros e ordenação por atividade, data e nome.

- Página comercial em `/`, com prévia ilustrativa e proposta Plus de R$ 15/mês. Preço e benefícios são demonstrativos; não há pagamento, assinatura ou restrição paga aplicada ao produto nesta etapa.
- Aplicativo em `/app`. Convites antigos no formato `/?room=...` redirecionam para `/app?room=...` preservando a sala.
- Navegação lateral recolhível (fecha automaticamente ao entrar no canal) e chat recolhível sem desmontar a chamada. No celular, ambos abrem sobre o conteúdo e podem ser fechados por botão, toque fora ou Escape.
- Área “Bot do Discord” na sidebar: o usuário apenas clica no convite e autoriza no Discord. O dono do produto configura `NEXT_PUBLIC_DISCORD_CLIENT_ID` uma única vez no ambiente do build. Sem essa configuração, a interface informa que a integração estará disponível em breve. Token do bot continua somente no worker.

- Sala com palco para tela/câmera, chat lateral persistente, lista de participantes e controles individuais de microfone, câmera e áudio recebido. Dispositivos começam desligados; as permissões são solicitadas ao clicar.
- Chat, câmera e voz funcionam com a mesma autorização da sala; o histórico de chat é persistido no banco e não é compartilhado com outras salas. Últimas 100 mensagens ao entrar, até 300 carregadas na interface.
- Bot Discord opcional em `bot/`: avisa quando alguém entra em call e envia o link da sala vinculada. Veja [como configurar](docs/DISCORD.md). O bot roda como worker separado da Vercel.

- API em Route Handlers do Next.js; não utiliza mais servidor Express/Socket.IO.
- Banco libSQL compartilhado para contas, sessões, salas, presença e sinalização. Sem estado de sala em memória de uma Function.
- WebRTC para vídeo/áudio. Sinalização HTTPS consultada a cada 1,5 segundo, adequada aos primeiros testes com poucos participantes. O vídeo não passa pelas Functions da Vercel.
- Acesso centralizado com visitante pelo nome ou Google, GitHub e Apple; configure os provedores conforme [AUTH.md](docs/AUTH.md). Não há cadastro/login com senha própria. Senhas de salas privadas usam scrypt e salt individual; sessões em cookie HttpOnly/SameSite, Secure em produção; autorização da sala em cada nova conexão e isolamento de sinais por sala/sessão.
- TURN externo opcional para conexões diretas e recomendado para funcionar entre diferentes redes. A versão com Coturn próprio emite credenciais temporárias.

Documentos em `/termos`, `/privacidade`, `/cookies` e `/lgpd`, com exportação e exclusão autenticadas em `/conta`. São minutas com campos sinalizados; confira as pendências de operação e revisão em [LEGAL.md](docs/LEGAL.md).

Não inclui expiração automática de contas de convidados. O número de espectadores aumenta o upload de cada transmissor. A captura de tela depende do navegador e de HTTPS/localhost; prefira navegadores desktop compatíveis.

## Alternativa Docker

O Docker Compose continua disponível para VPS Linux, agora executando o servidor padrão do Next.js com banco local persistente, Caddy e Coturn. Veja [o guia de VPS](docs/DEPLOY.md). Na Vercel, siga exclusivamente [o guia da Vercel](docs/VERCEL.md).
# ScreenLink

## Desktop para Windows

O [guia do desktop](docs/DESKTOP.md) explica como executar no PC, preparar um ZIP para amigos e testar chamadas em redes diferentes.
