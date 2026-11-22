# Bot de avisos do Discord

Quando uma pessoa entra ou muda para um canal de voz vinculado, o bot publica no canal de texto configurado um aviso com botão para abrir a sala Screenlink. Alterações de mute/deafen, saídas e entradas de outros bots são ignoradas. Há intervalo de 30 segundos por canal para evitar uma sequência de avisos. O bot não retransmite a tela ou o áudio do Discord; os participantes abrem o link e usam o Screenlink no navegador. A senha de uma sala privada continua sendo necessária e não é publicada pelo bot.

## Criar a aplicação no Discord

1. Acesse https://discord.com/developers/applications e crie uma aplicação.
2. Em **Bot**, crie/obtenha o token do bot. Ele fica somente no ambiente do processo do bot; não use `NEXT_PUBLIC_` e não coloque no frontend ou no Git.
3. Instale o bot no seu servidor com o escopo `bot` e as permissões **View Channels**, **Send Messages** e **Embed Links**. Não precisa de Administrator. Confira permissões sobrescritas nos canais de voz e texto usados.
4. O código solicita os intents padrão `Guilds` e `GuildVoiceStates`. Não depende de Message Content, presença nem lista completa de membros.
5. No Discord, habilite **Modo de desenvolvedor** em Configurações > Avançado para copiar os IDs do servidor e dos canais pelo menu de contexto.

## Vincular os canais

Crie primeiro a sala Screenlink no site e copie seu convite, por exemplo `https://seu-site.vercel.app/?room=0123456789abcdef01234567`. O `roomId` é o valor após `room=`; o bot não cria salas ou contas automaticamente.

Na pasta `bot`, copie `rooms.example.json` para `rooms.json`. Para cada canal de voz, preencha:

```json
[
  {
    "guildId": "ID_DO_SERVIDOR_DISCORD",
    "voiceChannelId": "ID_DO_CANAL_DE_VOZ",
    "textChannelId": "ID_DO_CANAL_DE_TEXTO_PARA_AVISOS",
    "roomId": "ID_DA_SALA_SCREENLINK"
  }
]
```

É possível configurar vários vínculos, inclusive em servidores Discord diferentes onde o bot esteja instalado. Cada canal de voz tem um único vínculo. Use uma sala que você controla e um canal de avisos visível às pessoas que devem receber o link; não configure links privados em canais abertos sem intenção de compartilhá-los. O bot não concede acesso à sala nem pula a senha.

## Executar

A aplicação web continua na Vercel. Para acompanhar eventos de entrada em call, o bot mantém uma conexão ao Gateway Discord e precisa de um **worker Node.js permanente**, fora das Functions de duração limitada. Pode rodar em um computador ligado ou em um servidor/serviço de workers. Não adicione este bot como rota do Next.js ou função agendada.

Na pasta `bot`, com Node.js 22.13+:

```sh
npm ci
cp .env.example .env
cp rooms.example.json rooms.json
```

Edite `.env` com seu token e o endereço HTTPS publicado:

```dotenv
DISCORD_BOT_TOKEN=SEU_TOKEN_REAL
SCREENLINK_URL=https://seu-site.vercel.app
ROOMS_FILE=rooms.json
```

Após preencher os vínculos, execute:

```sh
npm start
```

Também há um `Dockerfile` e `compose.yaml` independentes em `bot/`. Com `.env` e `rooms.json` preenchidos, execute **dentro de `bot/`**:

```sh
docker compose up -d --build
docker compose logs --tail=100 bot
```

Mantenha uma única instância do bot para não duplicar avisos. Ao alterar os vínculos, reinicie o processo/container. O bot avisa sobre entradas após sua conexão; não publica retroativamente sobre pessoas que já estavam na call quando ele iniciou. Reiniciar também reinicia o intervalo anti-spam.

## Validar

Entre em um canal vinculado com uma conta humana. Confirme o aviso no canal de texto, clique no botão e valide o endereço/sala. Altere o mute para confirmar que não cria outro aviso. Para testar outra entrada no mesmo canal, aguarde 30 segundos. Confira também uma sala privada e a exigência de senha no site.

Os testes locais (`npm test` dentro de `bot/`) verificam vínculos e quais transições devem gerar aviso. O teste real depende do token, instalação e permissões do seu servidor Discord. Nada é enviado ao Discord durante esses testes.

Referências: [Gateway e intents](https://discord.com/developers/docs/events/gateway), [eventos de voz](https://discord.com/developers/docs/events/gateway-events#voice-state-update).
