# Produto · Brasileirão da Depressão 2027

## O que estamos construindo

Um app de temporada para uma comunidade pequena que disputa palpites e torneios paralelos do Brasileirão. A experiência deve parecer um jogo de grupo: acompanhar a rodada, competir, torcer, provocar com carinho e guardar a história da turma.

## Pessoas e acesso

- **Jogador:** cria perfil, aguarda aprovação do administrador, acompanha torneios, envia palpites dentro do prazo e personaliza identidade e conquistas.
- **Administrador:** mantém o painel já existente, controlado pelo campo booleano `isAdmin`; pode aprovar participantes, configurar temporada, regras, torneios e pagamentos manuais.
- A inscrição é definida pelo admin em reais antes da temporada. Pagamento via Pix é conferido manualmente. A inscrição pode ser feita até a 5ª rodada; o elenco de participantes é pré-cadastrado. O campeão da Superliga pode receber isenção na temporada seguinte se quiser participar.
- O fluxo obrigatório de perfil pede nome e sobrenome, nome do time, time do coração, escuderia, escudo personalizado, avatar e confirmação final. Durante o desenvolvimento, `REQUIRE_PROFILE_SETUP_EVERY_LAUNCH` mantém o fluxo ativo em toda abertura do app; para o lançamento, esse sinalizador volta a exigir a configuração apenas de quem ainda não concluiu o perfil.

## Temporada e competições

As regras vigentes estão detalhadas em [`../PLANO-APP-TEMPORADA-2027.md`](../PLANO-APP-TEMPORADA-2027.md). Esse documento é a fonte de decisões para Superliga, Top 8, mata-mata secundário, Supercopa, Libertadores, Recopa, Resta Um, Cinturão do Mês, Formula Depre, palpites e artilheiro.

## Produto técnico

- As abas Recopa e Resta Um configuram a temporada 2027 em `tournaments/recopa/2027` e `tournaments/restaUm/2027`, com backup por alteração. A Recopa registra decisão anual, campeões anteriores, rodadas da partida/desempate, placares e título automático em caso de campeão duplo. O Resta Um permite início manual, seleção de participantes aptos, apuração do menor resultado em rodada encerrada com desempate pela posição da Superliga, cortes excepcionais ou manuais justificados, reintegração e histórico da edição. A Home prioriza os registros de 2027 e mantém fallback para o caminho legado.
- A Libertadores 2027 fica em `tournaments/libertadores/2027`: critério de vagas baseado na Superliga anterior, confirmação de acordo, classificação e participantes inscritos; fases e formatos são configurados pelo admin, com confrontos vinculados ao calendário, importação de pontuação, placares, vencedor e campeão. A gravação sincroniza as rodadas usadas com o calendário 2027 e cria backup dos dados anteriores. A chave entre etapas é avançada manualmente e revisada pelo admin.
- O Cinturão 2027 usa `tournaments/cinturao/2027` para detentor, desafiante, fila, placar mensal e histórico; resultados podem ser importados de duelos encerrados da Supercopa ligados a rodadas marcadas para o Cinturão. A Fórmula Deprê 2027 fica em `tournaments/formulaDepre/2027`: catálogo de escuderias ajustável antes da largada, até dois pilotos por equipe, classificação individual e de construtores calculada com pontos 25–18–15–12–10–8–6–4–2–1 por rodada marcada. Escuderias e pilotos ficam bloqueados após o início. O seletor de escuderia do perfil usa o catálogo 2027 e respeita esse bloqueio.

- Expo / React Native em JavaScript, com Android, iOS e web como alvos.
- Firebase Auth por e-mail e Google. A conta deve permitir vincular os dois métodos sem criar identidades duplicadas.
- Realtime Database existente no plano Spark, compartilhado com o site nesta primeira versão. Manter leituras em caminhos específicos e resumos pequenos; não escutar a raiz nem baixar coleções inteiras.
- O banco guarda metadados e referências a arquivos do Dropbox; nunca imagens em Base64 nem bytes de imagem.
- ESPN continua como fonte de eventos de gol e assistência, com revisão/correção manual administrativa quando necessário.
- Horários e fechamento seguem os prazos individuais atuais e fuso Manaus. Toda rodada dá pelo menos 18 horas para palpitar.

## Princípios do produto

1. Regras e prazos ficam visíveis antes da confirmação do palpite.
2. Palpites de outras pessoas permanecem ocultos até o início da rodada.
3. O app não inventa números, status de pagamento, notícias ou estatísticas.
4. Estados sem dados explicam o que falta e quem pode resolver.
5. Perfil e conquistas celebram a turma sem expor dados pessoais desnecessários.

## Estado atual

O painel também inclui premiações e conquistas (`seasons/2027/awards`), com divisão de receita, ajustes, registros com critério e trilha de auditoria; pagamento de inscrição pode ficar pago, pendente ou isento. Conteúdo e Notificações gerencia resenhas revisadas (`seasons/2027/feed`) e avisos in-app (`seasons/2027/notifications`), respeitando preferências individuais. Os jogadores consultam suas conquistas, resenhas e caixa de notificações nas telas ligadas à Home. Notificações push ainda exigem um emissor confiável no servidor.

O login por e-mail está conectado ao projeto Firebase já usado pelo site e mantém a sessão no aparelho. A Home e a tela de palpites consultam `seasons/2027/rounds` para a rodada ativa; resumos pessoais seguem em `appHome/users/{uid}`. O status da temporada 2027 (`a_iniciar`, `em_andamento`, `concluida`) é definido no painel e mostrado na Home e Superliga. A Superliga usa apenas membros aptos registrados em `seasons/2027/members/{uid}`. Administradores com `users/{uid}/isAdmin === true` veem o acesso ao painel, que protege a rota. A aba Jogadores mostra escudos, aptidão e pagamento; aptidão e pagamento são gravados separadamente, com autor e horário. A Superliga é atribuída automaticamente a quem está apto. A gestão da Superliga define o corte do Brasileirão, acompanha a rodada atual, associa rodadas do bolão às etapas, configura bônus e participantes do Top 8, participantes/formato/vagas/folgas do X-Salada e o pódio, com trilha administrativa. A aba Supercopa salva a edição 2027 em `tournaments/supercopa/2027`: participantes aptos inscritos na competição, composição e sorteio auditável dos grupos, calendário todos-contra-todos ligado às rodadas 2027, classificação, potes, Séries A/B/C e mata-mata de ida e volta. Cada gravação da edição cria backup da configuração anterior. A aba Rodadas cria, edita e exclui calendários em `seasons/2027/rounds`, com backup antes de mudanças destrutivas, importação ESPN e critérios revisáveis de seleção. Cada partida importada salva nome, escudo e identificador de clube/partida da ESPN; a tela de palpites prioriza esses dados registrados. Resultados oficiais consideram somente o tempo regulamentar, sem prorrogação ou disputa de pênaltis. As demais configurações do painel continuam em construção. A tela de cadastro ainda é apenas visual. O acesso Google foi deixado de fora por enquanto.
