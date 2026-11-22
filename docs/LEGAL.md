# Documentos e operação de privacidade

As páginas `/termos`, `/privacidade`, `/cookies` e `/lgpd` são minutas. Elas não certificam conformidade jurídica. Os campos sem informação permanecem sinalizados, conforme solicitado. Antes de disponibilizar comercialmente, valide o conteúdo com assessoria jurídica e a operação real.

- Definir responsável: `NEXT_PUBLIC_LEGAL_OPERATOR`, `NEXT_PUBLIC_LEGAL_DOCUMENT` e `NEXT_PUBLIC_PRIVACY_EMAIL`. São informações públicas, incluídas no build; fazer novo deploy após alterar.
- Definir e implementar prazos de retenção de contas, convidados, chat, registros técnicos e backups. Expiração lógica de sessão/presença não equivale a limpeza física automática de todos os dados.
- Preencher os fornecedores TURN/hospedagem/banco efetivamente contratados, localização e instrumentos aplicáveis a transferências internacionais.
- Validar bases legais, público etário, condições comerciais, atendimento de titulares, prazo de resposta, tratamento de incidentes e contratos com operadores.
- Revisar dados legados: hashes de senhas de contas antigas podem continuar no banco, embora o login por senha tenha sido removido. Definir a migração e retenção antes de eliminá-los.
- Se adicionar analytics, publicidade, gravação, cobrança ou novos fornecedores, atualizar documentos e mecanismo de consentimento quando aplicável. Não há banner de consentimento opcional nesta versão porque não foram adicionados cookies de publicidade ou analytics.

`/conta` permite exportar os dados da sessão autenticada e solicitar exclusão com confirmação digitada. A exclusão remove a conta, mensagens próprias e servidores próprios (incluindo conversas desses servidores). Backups e registros dos fornecedores precisam de procedimentos separados. O canal de contato sinalizado precisa estar operacional para solicitações que não possam ser resolvidas pela interface, inclusive perda da sessão de visitante.

O aceite registra usuário, versão e data. Ao alterar substancialmente documentos, incremente `LEGAL_VERSION` em `lib/legal.ts` e planeje eventual nova apresentação aos usuários já autenticados; alterar a versão por si só não encerra sessões existentes nem força novo aceite.

Referências: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [ANPD](https://www.gov.br/anpd/pt-br).
