# Publicar o Screenlink na Vercel

A aplicação usa o deploy padrão do Next.js: interface e APIs rodam na Vercel. Usuários, sessões, salas, presença e sinalização ficam em um banco **libSQL remoto**, como um banco libSQL do Turso. Não há servidor Node.js customizado nem WebSocket permanente nesta versão.

## 1. Criar o banco

Crie um banco **libSQL** no Turso e obtenha a URL de conexão (`libsql://...`) e um token com permissão de leitura e escrita. A aplicação usa `@libsql/client`; selecione um banco compatível com esse cliente. Não use uma URL de arquivo SQLite na Vercel.

No painel do projeto da Vercel, em **Settings > Environment Variables**, cadastre:

| Variável | Conteúdo |
| --- | --- |
| `TURSO_DATABASE_URL` | URL remota do banco libSQL |
| `TURSO_AUTH_TOKEN` | Token de leitura/escrita do banco |

O esquema é criado de forma idempotente na primeira requisição. O token precisa permitir criação de tabelas e índices. O build não precisa se conectar ao banco.

Use bancos separados para Production e Preview se não quiser que deploys de teste alterem usuários e salas de produção. Dados do SQLite local não são enviados automaticamente ao banco remoto.

## 2. Configurar TURN

Para testar com pessoas em redes diferentes, configure um provedor TURN externo. Copie os valores reais que o provedor informar:

| Variável | Conteúdo |
| --- | --- |
| `TURN_URL` | Uma ou mais URLs TURN, separadas por vírgula |
| `TURN_USERNAME` | Usuário do serviço |
| `TURN_PASSWORD` | Senha do serviço |

Exemplo de formato, sem credenciais reais:

```dotenv
TURN_URL=turn:relay.exemplo.com:3478?transport=udp,turns:relay.exemplo.com:443?transport=tcp
TURN_USERNAME=usuario-do-provedor
TURN_PASSWORD=senha-do-provedor
```

Se você já possui Coturn com `use-auth-secret`, configure `TURN_SECRET` no lugar de `TURN_USERNAME` e `TURN_PASSWORD`. O backend emitirá credenciais de 24 horas sem enviar esse segredo ao navegador. Com provedores de usuário/senha fixos, essas credenciais são entregues aos participantes autenticados porque o navegador precisa delas para acessar o relay; utilize credenciais restritas e acompanhe seu uso.

Sem TURN, o app tenta conexões diretas usando STUN. Isso pode funcionar em algumas redes, mas não garante a transmissão entre seus amigos. TURN não roda dentro da Vercel. O tráfego de mídia continua criptografado pelo WebRTC, mesmo quando usa relay.

## 3. Importar e publicar

1. Envie o projeto para um repositório Git.
2. Na Vercel, selecione **Add New > Project** e importe o repositório.
3. Framework: **Next.js**. Root Directory: a pasta que contém `package.json`.
4. Build Command: `npm run build`. Install Command: `npm ci`. Mantenha o Output Directory padrão do Next.js. Não use Docker ou `server.ts`.
5. Escolha Node.js 22.x ou uma versão suportada superior.
6. Adicione as variáveis de banco e TURN nos ambientes desejados e faça o deploy.
7. Abra a URL HTTPS retornada e consulte `/healthz`. O resultado esperado é `{"status":"ok"}`.

As variáveis estão listadas também em `.env.vercel.example`. Nunca use prefixo `NEXT_PUBLIC_` para o token do banco ou segredos. Ao alterar variáveis, faça um novo deploy.

`APP_ORIGIN` é opcional: normalmente o app valida requisições contra a origem da própria URL. Se quiser fixar o domínio público, defina `APP_ORIGIN=https://seu-projeto.vercel.app` (sem barra final). Não reutilize esse valor de produção em deploys Preview com URLs diferentes.

Se a proteção de deploy da Vercel exigir login, ajuste a audiência/proteção do projeto no painel para que seus amigos consigam abrir o link.

## 4. Teste de aceitação

1. Entre como convidado e crie um servidor público.
2. Abra o convite em outra sessão de navegador e confirme que aparecem dois participantes.
3. Compartilhe a tela em um navegador desktop compatível e confira o recebimento da imagem na outra sessão.
4. Repita com um amigo em outra rede. Teste áudio de aba quando suportado pelo navegador.
5. Crie um servidor privado e confirme o bloqueio sem senha e a entrada com a senha correta.
6. Confira cadastro, login, logout e persistência após um novo deploy.

Uma conexão direta bem-sucedida não verifica o TURN. No Chrome, `chrome://webrtc-internals` mostra o par ICE selecionado; um candidato `relay` indica uso do TURN.

## Arquitetura e limites

- APIs em `app/api/[...path]/route.ts`, runtime Node.js. Cada requisição é curta; não precisa de processos em segundo plano ou afinidade entre instâncias.
- A presença usa heartbeat e expira após 25 segundos sem comunicação. O cliente verifica participantes e sinais a cada 1,5 segundo, além do tempo de rede. Pode levar alguns segundos para iniciar uma transmissão ou atualizar a lista.
- Sinais SDP/ICE ficam no banco, com isolamento por sala e conexão autenticada; o vídeo e o áudio não são enviados nem armazenados por essas APIs.
- Polling implica aproximadamente 40 chamadas por minuto por participante e várias operações de banco por chamada. É uma solução para os primeiros testes com poucos amigos; acompanhe cotas de Functions e do banco. Para uso maior, evolua para um serviço de presença/pub-sub e um SFU para mídia.
- Vídeo em malha consome upload proporcional ao número de espectadores. Não é uma solução de grandes transmissões nesta versão.
- Suspensão da aba ou da rede pode expirar a presença. O cliente reconecta e negocia as transmissões novamente. Sessões são revogadas no logout e conferidas em cada requisição.
- As mensagens recebidas são confirmadas pelo cursor na consulta seguinte; mensagens antigas e presenças abandonadas são limpas quando alguém lista os servidores. Não há cron obrigatório.
- O banco remoto precisa de backup configurado no provedor. A configuração local de volumes Docker não é usada pela Vercel.

Referências oficiais: [cliente TypeScript libSQL](https://docs.turso.tech/sdk/ts/reference), [variáveis na Vercel](https://vercel.com/docs/environment-variables).
