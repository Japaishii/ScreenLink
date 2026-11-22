# Acesso social

O acesso fica em `/app`: visitante com nome ou conta Google, GitHub e Apple. Não há cadastro ou login com senha própria. As rotas antigas de senha retornam 410; sessões antigas continuam válidas até expirar ou sair. Contas de provedores diferentes não são vinculadas automaticamente por e-mail.

Cadastre as variáveis somente no servidor (sem `NEXT_PUBLIC_`) e faça um novo deploy. Cada provedor só é habilitado quando todas as suas variáveis estiverem presentes. Isso não verifica se as credenciais são válidas: conclua um acesso real em cada provedor antes de divulgar.

## Google

No Google Cloud, configure a tela de consentimento e um cliente OAuth do tipo aplicação Web. Defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Autorize a URI exata:

`https://SEU-DOMINIO/api/oauth/google/callback`

Durante o modo de teste, inclua seus testadores na configuração do Google. Em desenvolvimento, cadastre também `http://localhost:3000/api/oauth/google/callback` em um cliente de teste.

## GitHub

Crie uma OAuth App no GitHub com a callback URL `https://SEU-DOMINIO/api/oauth/github/callback`. Configure `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`. Use outra OAuth App para desenvolvimento local. O app solicita apenas `read:user`, sem acesso a repositórios.

## Apple

É necessário configurar Sign in with Apple na conta Apple Developer: App ID principal habilitado, Services ID associado, domínio e Return URL verificados. A Return URL é `https://SEU-DOMINIO/api/oauth/apple/callback`.

Configure `APPLE_CLIENT_ID` com o Services ID, `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY` com a chave privada `.p8` completa. O campo aceita quebras de linha reais ou `\n`. Não envie a chave ao navegador, ao Git ou em mensagens. O servidor gera o client secret assinado; não é necessário manter um `APPLE_CLIENT_SECRET` manual.

Apple exige HTTPS e domínio aceito pelo provedor; não funciona com callback localhost. O retorno utiliza POST e cookie temporário Secure/SameSite=None. Navegadores que bloqueiam esse cookie podem exigir nova tentativa. A interface usa “Conta Apple” como nome inicial, pois não recebe nome em todas as autorizações.

## Domínio e segurança

Use um domínio estável. Opcionalmente defina `AUTH_ORIGIN=https://SEU-DOMINIO` (sem barra final); se ausente, usa `APP_ORIGIN` ou a origem da requisição. A origem da tela deve coincidir com a origem de autenticação. Não reutilize o domínio de produção em previews com domínio diferente: use credenciais de teste e callbacks próprias, ou mantenha os provedores desabilitados nesses ambientes.

Há validação de state, cookie temporário e tentativa de uso único no banco; Google e GitHub usam PKCE; tokens de identidade Google/Apple são verificados por assinatura, emissor, audiência, expiração e nonce. Tokens dos provedores não são persistidos. O aceite da versão dos termos é registrado para visitantes e contas sociais. Sair revoga a sessão Screenlink, sem revogar a autorização no provedor; o usuário pode removê-la no painel do próprio provedor.

Teste cancelamento, nova tentativa, acesso repetido à mesma conta e convite de sala preservado após o login. As verificações automatizadas cobrem rejeições e validação criptográfica; a autorização real depende das credenciais e configurações externas.

Referências: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple).
