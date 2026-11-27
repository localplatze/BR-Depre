# Brasileirão da Depressão — plano do aplicativo e da temporada 2027

**Versão:** rascunho 1.0 · 24/11/2026  
**Estado:** planejamento em construção; configurações da temporada são definidas pelo administrador antes da abertura. Não é o regulamento final.  
**Fonte histórica:** `C:\Users\User\Downloads\Regulamento Oficial - BR 2026.pdf`, quatro páginas. O código existente é identificado quando usado como referência; as respostas do proprietário registradas nesta revisão prevalecem sobre o rascunho 0.1.

> **Decisão revisada em 25/11/2026:** a primeira versão do app usará o Realtime Database existente, junto do site e do Firebase Auth. Esta decisão substitui a proposta de Firestore abaixo. A home lê perfil por UID, consulta `rounds` por `status: 1` para descobrir prazo e rodada ativa, e recebe posições por `appHome/users/{uid}`. Não usar listeners na raiz nem em pais que contenham dados sigilosos. Reavaliar Firestore se a complexidade das consultas justificar uma migração futura.

> **Estado das decisões:** regras marcadas como decididas refletem o combinado para 2027. O admin configura os valores e parâmetros variáveis no painel antes do início; itens operacionais ainda pendentes ficam identificados.

## 1. Visão e premissas

O Brasileirão da Depressão é uma competição entre participantes: os palpites e as rodadas formam a base comum, e cada torneio aplica suas próprias regras. O objetivo é um app com clima de jogo, histórias da turma, transparência da pontuação e pouco trabalho manual para quem administra.

**Direção de produto [decidido pelo proprietário]:** app novo em Expo/React Native e JavaScript; Firebase Auth com e-mail/senha e Google vinculáveis; Firestore no plano Spark como meta; aprovação pelo admin; personalização de avatar, escudo, bandeira, seleção e equipe F1; troféus, conquistas, histórico, notícias, insights e gestão. Experiência de jogo mobile, animada e com identidade original, inspirada na energia de Golf Battle sem copiar sua interface. Direção visual em azul e verde, com pequenos detalhes amarelos ou pretos e linguagem Frutiger Aero. A marca terá uma bola de futebol chorando, desenhada em estilo minimalista, com brilho leve e traços vetoriais próprios.

**Inscrição [decidido]:** pagamento único por temporada, em **reais via Pix**, sem valor fixo predeterminado neste plano. O administrador define e publica o valor no painel antes de abrir a temporada; ele atualiza manualmente o status de pagamento de cada participante. O campeão da Superliga pode participar da temporada seguinte com isenção, se quiser se inscrever. As inscrições ficam disponíveis até a **5ª rodada**; o grupo-base e seu número de participantes são cadastrados previamente pelo admin.

**Termos de marcação:** [Decidido] = direção expressa pelo proprietário, ainda sujeita às validações necessárias; [2026] = regra histórica do PDF; [Atual] = comportamento observado no código; [Proposta] = sugestão, sem aprovação; [Pendente] = questão aberta.

## 2. Inscrição, dinheiro e operação

### 2.1 Inscrição e controle de pagamento

- [Decidido] O admin define o valor da inscrição em reais antes do início da temporada e o apresenta no painel/app. Inscrição é por temporada, em pagamento único.
- [Decidido] Pagamento manual por **Pix em reais**. O admin confere o recebimento e atualiza no painel os campos de pagamento do participante; não há confirmação automática.
- [Decidido] Inscrição aberta até a 5ª rodada; demais participantes do grupo são previamente cadastrados pelo admin, que define o número de vagas antes da temporada. O campeão vigente da Superliga recebe isenção para a temporada seguinte se optar por participar.
- [Decidido] Apenas administradores podem alterar status e registro de pagamento. Guardar valor confirmado, data, responsável e observação administrativa; o participante não edita o próprio status.
- [Decidido] O admin poderá editar valores e posições premiadas de cada torneio com patrocínios extras. [Proposta] Os participantes visualizam regulamento, versão e demonstração de como cada valor foi calculado; mudanças após divulgação exigem justificativa e histórico auditável.

### 2.2 Distribuição financeira e controles do admin

[Decidido] Referência financeira para a temporada: **60% Superliga + 25% Supercopa + 5% Libertadores + 10% administração = 100%**. O proprietário administra os valores, a arrecadação e os ajustes da temporada. Os 10% são sua parcela administrativa e podem cobrir eventual custo do banco de dados; a despesa não é descontada de novo da premiação. A tabela de distribuição permanece na seção 3.3.

O admin define o valor em reais e registra manualmente pagamentos e isenções no painel. Os valores e ajustes de premiação são administrados pelo proprietário conforme a configuração da temporada.

[Proposta] O painel mostra o total recebido, quem está pago ou isento e os valores destinados a cada torneio/colocação. Ajustes manuais ficam associados à temporada e ao administrador responsável.

### 2.3 Firestore e Dropbox

- [Decidido] Usar Firestore no plano Spark como meta e Dropbox para armazenar documentos, fotos e artes.
- [Decidido] Firestore guarda apenas metadados necessários e uma referência/caminho/link para o arquivo no Dropbox. **Nunca armazenar imagens em Base64 nem bytes de imagem nos documentos Firestore.**
- [Pendente operacional] Definir entrega e permissões dos links Dropbox, limites de API, armazenamento e política de privacidade. Links compartilháveis podem ser repassados; credenciais e tokens nunca ficam no app. Se a integração não estiver pronta, o admin gerencia arquivos manualmente.
- [Decidido] Sem Cloud Functions. O status de pagamento é manual. Tarefas mensais podem ser verificadas pelo admin ou executadas por cron-job externo configurado pelo proprietário; notificações e integrações que exijam serviço confiável serão planejadas conforme essa infraestrutura.
- A revisão de cotas do Firestore está na seção 6. [Cotas Firestore](https://firebase.google.com/docs/firestore/quotas).

## 3. Regras da temporada 2027

### 3.1 Base comum: rodadas e palpites

[Decidido] As rodadas de palpites alimentam os torneios, cada um com regulamento próprio. Além das 38 rodadas do Brasileirão, podem existir **rodadas extras com jogos de outros torneios** durante o ano. Os torneios podem ocorrer simultaneamente, e uma rodada pode contar para mais de uma competição quando o calendário assim definir. Os resultados consideram somente o tempo regulamentar, sem prorrogação ou disputa de pênaltis.

[Decidido] O calendário registra origem, período e competições que usam cada rodada. Não presumir que uma rodada extra conte para todos os torneios: o admin define sua elegibilidade. Toda rodada fica aberta para palpites por pelo menos **18 horas**; continuam valendo os prazos atuais para cada jogador/partida.

**Pontuação base confirmada [decidido; compatível com 2026]:**

| Resultado | Pontos |
|---|---:|
| Placar exato | +3 |
| Vencedor correto ou empate correto, placar diferente | +1 |
| Placar invertido em jogo com vencedor | -1 |
| Outros erros | 0 |

[Decidido] Manter o **jogo estrela 2x** e usar as estratégias de artilheiro da seção 3.8. A estrela e o coringa são escolhidos antes do início da rodada e não podem apontar para o mesmo jogo.

### 3.2 Superliga — corte e disputa até a última rodada

**[Decidido para 2027]** Todos competem juntos até a **30ª rodada**. Encerrada essa rodada, os oito primeiros passam à **Liga do Top 8**, que segue em pontos corridos até a última rodada para definir o campeão da fase final. Os demais disputam um torneio paralelo eliminatório; o vencedor ganha um prêmio simbólico de **um X-salada**.

**Vantagem do Top 8 [decidido]:** a classificação após a 30ª rodada dá pontos iniciais na liga final: 1º lugar **+6**, 2º **+4**, 3º **+2**, 4º **+1**; do 5º ao 8º, sem bônus. Os pontos obtidos nas rodadas finais somam-se a essa vantagem para definir a tabela final.

**Desempate [decidido]:** aplicar a sequência vigente: total de pontos; pontos feitos na última rodada concluída; melhor posição na rodada anterior. Usar a classificação da Superliga vigente após a rodada concluída correspondente. A mesma sequência resolve empates no corte e na liga do Top 8.

**Rebaixamento [decidido]:** os quatro últimos ao final da 30ª rodada recebem badge/conquista de rebaixamento no perfil, sala de conquistas e histórico da temporada. O sistema pode registrar ao finalizar a classificação, e o administrador pode incluir ou corrigir manualmente com trilha de auditoria.

O torneio secundário é uma chave à parte para os não classificados ao Top 8; número de vagas, pareamentos, byes e calendário são configurados pelo admin antes da fase. A premiação simbólica é separada da divisão principal da seção 3.3.


### 3.3 Premiação — distribuição de referência

**[Decidido como referência]** A divisão de referência é calculada sobre a arrecadação em reais registrada pelo admin, excluindo participantes marcados como isentos. Valores por colocação podem ser configurados pelo proprietário antes da temporada.

| Destino | Parcela do destino | Distribuição interna | Percentual sobre a arrecadação |
|---|---:|---|---:|
| Superliga — campeão | 60% | 75% dos 60% | **45%** |
| Superliga — vice | 60% | 20% dos 60% | **12%** |
| Superliga — 3º | 60% | 5% dos 60% | **3%** |
| Supercopa — campeão | 25% | 75% dos 25% | **18,75%** |
| Supercopa — vice | 25% | 20% dos 25% | **5%** |
| Supercopa — 3º | 25% | 5% dos 25% | **1,25%** |
| Libertadores — campeão | 5% | 100% dos 5% | **5%** |
| Administração | 10% | 100% dos 10% | **10%** |
| **Total** | **100%** | | **100%** |

**Exemplo aritmético:** sobre R$ 1.000 registrados como arrecadação, a divisão de referência corresponde a R$ 450 / R$ 120 / R$ 30 para Superliga; R$ 187,50 / R$ 50 / R$ 12,50 para Supercopa; R$ 50 Libertadores; R$ 100 administração. O admin gerencia os valores e os ajustes da temporada. A isenção do campeão da Superliga fica registrada como isenção, não como Pix recebido.

### 3.4 Supercopa, Séries B e C

**Supercopa [decidido]:** manter o formato atual de grupos. O administrador define o número de grupos e participantes por grupo; padrão inicial de **quatro grupos**. O sistema apresenta um sorteio com visual de cerimônia, mostrando regras, sequência e resultado em uma tela compartilhável; o registro fica revisável e não há re-sorteio silencioso. Na fase de grupos, todos enfrentam todos dentro do próprio grupo.

**Desempate da fase de grupos [decidido]:** pontos no grupo, vitórias, saldo de gols, gols pró e posição na Superliga na última rodada concluída naquele momento, nessa ordem.

Ao fim dos grupos, cada participante segue para o mata-mata correspondente. O administrador configura os potes e a alocação de cada subtorneio. Todas as fases eliminatórias são disputadas em **ida e volta**, inclusive a disputa de **3º lugar da Supercopa**. O pareamento, vagas por grupo e composição de chaves ficam visíveis antes da fase começar.

Séries B e C usam o mesmo modelo configurável de potes e mata-mata quando forem organizadas. O admin define previamente participantes, posições classificatórias, potes e calendário.


### 3.5 Libertadores e Recopa

**Libertadores [configurada pelo admin]:** o administrador define os participantes e a chave com base na classificação da Superliga da temporada anterior. O critério exato de vagas e fases é definido antes da edição pelo admin, acompanhando as posições e com concordância dos participantes. A plataforma registra o critério, participantes, etapas e alterações; a referência histórica de 2026 não fixa automaticamente o formato de 2027.

**Recopa [decidido]:** o admin decide se haverá edição no ano. Quando ocorre, os participantes são os campeões da Superliga e da Supercopa do ano anterior. Se a mesma pessoa tiver vencido ambos, ela já é declarada campeã da Recopa da temporada, sem partida. Caso haja dois participantes, a disputa é em jogo único; empate leva a rodadas extras de palpites até desempatar, podendo se estender pelo número de rodadas necessário. Registrar calendário e decisão de realizar ou não.


### 3.6 Cinturão do Mês, Resta Um e Fórmula Deprê

**Torneios simultâneos [decidido]:** todas as competições podem acontecer ao mesmo tempo. O calendário define explicitamente quais rodadas alimentam cada torneio, sem impedir que uma rodada conte para várias competições.

**Cinturão do Mês [administração configurável]:** o admin verifica e pode apurar manualmente a pontuação mensal no banco; se preferir, o proprietário configura cron-job externo para o processamento. Usar o fuso de Manaus para a virada e manter a regra de horários individuais dos participantes como funciona atualmente. O sistema registra resultado, período e origem da apuração.

**Resta Um [decidido]:** a próxima edição não começa automaticamente; o admin escolhe quando iniciar. Padrão de uma eliminação por rodada, com possibilidade de eliminar mais participantes em casos excepcionais para concluir junto ao calendário. Em empate no corte, elimina-se o pior colocado na classificação vigente da Superliga, como faz o sistema atual. Cada edição mantém seu histórico e campeão.

**Fórmula Deprê [decidido]:** sem premiação; mantém o formato e a pontuação atuais em duplas. Cada participante escolhe uma equipe até o início da temporada; não pode trocar de equipe durante a temporada. Como o número final de participantes pode variar, o administrador pode cadastrar ou remover equipes para ajustar a competição antes do início. Número ímpar de equipes permanece como está no formato atual; não criar trocas ou pareamentos especiais durante a temporada.


### 3.7 Jogo coringa e jogo estrela

**[Decidido]** Jogo coringa aparece na mesma tela de palpites que o jogo estrela. Em cada rodada pode haver um coringa e uma estrela; a pessoa escolhe até o começo da rodada, respeitando os prazos atuais dos palpites individuais. Coringa e estrela **não podem ser o mesmo jogo**.

No jogo coringa, é permitido registrar um segundo placar diferente para a mesma partida. No fechamento, calcula-se a pontuação normal de cada palpite e vale apenas o melhor dos dois, mesmo se ambos forem negativos; nunca se somam. Exemplo: um palpite resulta em −1 e o outro em +3, contam +3. A pontuação considera apenas os **90 minutos regulamentares**, sem prorrogação ou disputa de pênaltis.

O jogo estrela mantém a pontuação 2x vigente. Ambos os controles são bloqueados no início da rodada. Cada rodada precisa ficar aberta para palpites por pelo menos **18 horas**; os demais prazos por jogador/partida seguem as regras atuais.


### 3.8 Artilheiro — jogadores e estratégias do capitão

**[Decidido]** A cada rodada, cada participante escolhe **três jogadores** e designa um como **capitão**. Os outros dois rendem **+1 ponto por gol** cada. Para o capitão, o participante escolhe uma das três estratégias abaixo. A escolha da estratégia faz parte do palpite da rodada.

1. **Artilheiro:** cada gol do capitão vale **2 pontos**.
2. **Garçom:** cada gol do capitão vale **1 ponto** e cada assistência vale **1 ponto**.
3. **Hat-trick:** os gols do capitão contam normalmente a **+1 cada** até completar três. Ao atingir três gols, a pontuação do capitão passa a **8 pontos no total**; cada gol adicional soma mais 1 (4 gols = 9 pontos). Se a soma dos gols dos três jogadores escolhidos ficar **abaixo de 3 na rodada**, aplica-se **−3 pontos** nessa estratégia.

Nas estratégias Artilheiro e Garçom, se nenhum dos três marcar, aplica-se a penalidade geral de **−1 ponto**. Na estratégia Hat-trick, o −3 **substitui** essa penalidade; não se acumulam as duas. A condição de −3 é a soma dos gols do trio, enquanto a bonificação de 8 depende de o capitão marcar três gols. Exemplo: dois gols somados no trio contam normalmente e depois recebem −3; se todos fizerem zero, aplica-se apenas −3, não −3 e −1. As regras permanecem em números inteiros; não há multiplicador por posição aprovado.

**[Decidido]** ESPN segue como fonte de gols e eventos, como no sistema atual. A estratégia Garçom usa a assistência informada pela ESPN no evento de gol, quando disponível. O parser atual só contabiliza o primeiro atleta (marcador), então a integração precisa extrair o assistente e ser conferida em jogos do Brasileirão. Se a ESPN não informar ou houver divergência, o admin confere/corrige manualmente. Ainda definir lista de atletas elegíveis, prazo, jogos adiados e correções. Exibir estratégia, capitão e cálculo por atleta na confirmação e no histórico.

### 3.9 Configurações a preparar antes da temporada

O administrador configura no painel antes do início: valor em reais da inscrição; grupo-base e número previsto de participantes; status manuais de pagamento; grupos, sorteio, potes e chaves dos torneios; critério e participantes da Libertadores; realização da Recopa; equipes da Fórmula Deprê; calendário e rodadas usadas por cada modalidade. As inscrições permanecem abertas até a 5ª rodada conforme a regra definida.

**Implementação técnica antes de lançar:** atualizar o parser, que hoje só contabiliza o marcador, para extrair também o assistente da ESPN; conferir a cobertura em jogos do Brasileirão e habilitar conferência/correção manual para eventos sem assistente.


## 4. Participação, contas e estados

### 4.1 Identidade e acesso

[Decidido] Preservar o campo booleano `isAdmin` do perfil atual para controlar o acesso ao painel de administração. O novo app mostra e libera a gestão quando esse campo é verdadeiro; a alteração do campo fica restrita ao processo administrativo confiável e as regras do Firestore também verificam o papel.

[Confirmado em 24/11/2026] Manter a variável `isAdmin` para conceder acesso ao painel atual de administração. A ESPN também será usada para ler assistências na estratégia Garçom, com conferência manual quando a cobertura da fonte estiver ausente ou divergente.

[Proposta] Uma conta Firebase Auth, identificada por um único UID, com e-mail/senha e Google vinculados explicitamente por `linkWithCredential`. Não criar ou fundir contas apenas porque e-mails parecem iguais. Tratar colisão de credenciais, conta existente, reautenticação, e-mail não verificado, recuperação, cancelamento e desvinculação sem deixar a pessoa sem método de acesso. Confirmar compatibilidade do fluxo Expo com build nativa; não depender apenas de Expo Go. A documentação do Firebase registra uma questão conhecida de linking em alguns projetos: validar no ambiente real. [Vinculação de provedores](https://firebase.google.com/docs/auth/web/account-linking).

[Proposta] Fluxo: criar/entrar → completar perfil → aceite do regulamento → aprovação e/ou pré-cadastro pelo administrador → Pix manual ou isenção → inscrição ativa. O grupo-base é pré-cadastrado pelo admin; inscrições ficam abertas até a 5ª rodada, respeitando o número de participantes definido.

**Estados separados, não um único `isActive`:**
- Conta: criada, restrita, excluída/desativada conforme política.
- Aprovação: pendente, aprovada, recusada, suspensa; com autor, data e motivo quando cabível.
- Inscrição por temporada: não solicitada, pendente, ativa, suspensa, encerrada.
- Pagamento: pendente, confirmado ou isento; atualização manual pelo admin, com data, valor e observação administrativa.
- Acesso: derivado da aprovação + inscrição + situação de pagamento + estado da temporada, calculado em regras e/ou serviço confiável; usuário nunca pode conceder a si mesmo aprovação, cargo ou quitação.

**Inscrição anual:** pagamento único em reais via Pix. O admin publica o valor antes da temporada, registra manualmente pagamento ou isenção e concede acesso com base nos campos administrativos da temporada. A isenção do campeão da Superliga pode ser usada se ele confirmar participação.

### 4.2 Fluxo de dados sigilosos dos palpites

Os palpites dos demais permanecem ocultos até o início da rodada. O sistema não baixa nem expõe ao cliente os placares, jogo estrela, coringa ou artilheiro de terceiros antes da liberação; as regras do Firestore e as consultas devem impedir a leitura, não apenas esconder a informação na interface. [Regras e consultas Firestore](https://firebase.google.com/docs/firestore/security/rules-query).

Os palpites comuns seguem os prazos atuais de cada jogador/partida. A rodada deve oferecer no mínimo 18 horas de janela para palpitar. Jogo estrela, coringa e estratégia de artilheiro são definidos até o começo da rodada. O relógio oficial é controlado pelo sistema; alterações de resultado e jogos adiados precisam manter o sigilo e o histórico auditável.


## 5. Mapa de telas e estados

A navegação proposta usa lobby como centro e ações persistentes simples: **Início, Palpites, Competições, Resenha e Perfil**. Acesso à gestão é restrito. A estrutura visual é uma hipótese, testada em dispositivos antes de virar desenho final.

1. **Abertura / sessão:** identidade provisória e verificação rápida da sessão. Sem animação que bloqueie; erro de rede e estado de manutenção.
2. **Entrar:** e-mail/senha, Google, recuperar senha, cadastro; informar erro acionável sem revelar dados sensíveis. Se Apple exigir opção equivalente de login no iOS, decidir e validar a integração antes do lançamento.
3. **Cadastro / vincular conta:** nome, e-mail e credenciais; termos e privacidade; verificação de e-mail; vinculação segura com login Google, resolução de conta já existente.
4. **Aprovação:** solicitação enviada, pendente, aprovada, recusada ou suspensa, com botão de suporte. Não insinuar que já foi cobrado.
5. **Inscrição e pagamento:** exibir valor em reais definido pelo admin, temporada, Pix, situação individual e regra de isenção do campeão da Superliga; inscrições até a 5ª rodada e pré-cadastro dos participantes-base. A tela não permite ao jogador marcar a própria quitação.
6. **Lobby / home:** avatar e escudo, nome do clube, rodada/prazo real, ação principal de palpitar, posição/estado da disputa, notícias recentes e atalhos para torneios. Evitar dados falsos na primeira temporada; tela de temporada encerrada e de rodada indisponível.
7. **Rodada e palpites:** lista de jogos, datas e prazos individuais atuais, janela mínima de 18h, placares, rascunho, salvamento, coringa e estrela na mesma tela; coringa aceita segundo placar e nunca pode ser o mesmo jogo da estrela. Somente tempo regulamentar. Nenhum palpite de terceiros é exposto antes do início da rodada.
8. **Controles de estrela e coringa (na tela de palpites):** seleção até o início da rodada, bloqueio após esse momento, sem permitir que os dois destaques sejam o mesmo jogo. Para o coringa, informar que vale o melhor de dois palpites e não a soma.
9. **Artilheiro:** selecionar três jogadores elegíveis, designar o capitão e escolher a estratégia (Artilheiro, Garçom ou Hat-trick); explicar pontuação e penalidade aplicável, prazo, confirmação e status de apuração.
10. **Status / palpites da rodada:** tabela por jogador e jogo; placares, estrela, coringa e artilheiro de terceiros permanecem ocultos até o início da rodada, depois a consulta é liberada. Legenda, rolagem e acessibilidade.
11. **Competições:** catálogo de Superliga, Supercopa, Série B/C, Recopa, Libertadores, Resta Um, Cinturão e Fórmula Deprê; exibir estado real, datas e entrada para cada modalidade, nunca inventar títulos.
12. **Superliga:** fase comum até a 30ª rodada, corte do Top 8, tabela final com bônus +6/+4/+2/+1, mata-mata secundário, rebaixados e desempates visíveis; Corridinha como visualização opcional baseada nos dados, com movimento reduzido.
13. **Supercopa / Séries B e C:** grupos e sorteio transparente, classificação e critérios atuais, potes e mata-mata ida e volta incluindo disputa de 3º lugar; fases não iniciadas ficam claras.
14. **Libertadores:** critério de vagas definido pelo admin com base na Superliga anterior e acordado com participantes; exibir critérios, pré-fases, chave e ida e volta.
15. **Recopa:** estado anual definido pelo admin, campeões anteriores, campeão automático em caso de vencedor duplo e jogo único com rodadas extras se houver empate.
16. **Resta Um:** edição atual, estado aguardando início ou em andamento, sobreviventes, corte, risco provisório, histórico de eliminações e campeão; painel admin inicia edição e define uma eliminação por rodada por padrão, podendo registrar múltiplas em exceções para sincronizar o encerramento, sempre com motivo. A animação de eliminação é opcional e não revela dados privados.
17. **Cinturão:** atual detentor, histórico e apuração mensal por admin ou cron-job, usando o fuso de Manaus e os horários individuais atuais.
18. **Fórmula Deprê:** escolha de equipe até o início, sem trocas durante a temporada, escala atual e sem prêmio; admin ajusta número de equipes antes da largada.
19. **Histórico:** temporada → rodada → jogos → palpites e pontuação; comparar somente dados publicados; paginação, ausência de histórico, revisão e dados legados.
20. **Resenha / notícias:** feed por temporada e rodada, cards de notícias, placares e rivalidades, aviso de conteúdo gerado por IA quando pertinente; aprovação editorial, moderação, correções e histórico de publicação. Não inventar resultados nem descrever previsão como fato.
21. **Insights pessoais:** acertos, evolução, rivais e estatísticas derivadas dos dados disponíveis; explicar intervalo de dados e cálculo; análise com IA como opção futura, com limites de custo e sem promessa de ganhos.
22. **Perfil e personalização:** foto/avatar, escudo, nome/sigla, bandeira/seleção, equipe F1 e itens cosméticos. Opções precisam refletir dados reais e regras da temporada; confirmação para uso de imagens e alternativa sem foto. Personalização não altera pontuação.
23. **Troféus e conquistas:** títulos e badges com critério, data e temporada; incluir rebaixamento dos quatro últimos da Superliga após a 30ª rodada; versionar regras e registrar origem.
24. **Notificações:** lista interna e preferências por categoria (prazo, resultado, competição, resenha). Push abre o item correspondente; não enviar segredos em payload. Controle por dispositivo, consentimento e desativação.
25. **Configurações e suporte:** provedores vinculados, senha, idioma/horário, notificações, privacidade, regulamento por versão, pagamento, dúvidas, logout e exclusão de conta; preservar o histórico conforme política e obrigação aplicável.
26. **Gestão:** pré-cadastrar participantes e limite de vagas; definir valor da inscrição; atualizar manualmente pagamentos/isenções; configurar calendário e torneios; sortear grupos com registro transparente; definir potes e chaves; validar resultados e artilheiros; gerir resenha, notificações e cron-job do cinturão. Corrigir dados com registro de autor e motivo.

## 6. Arquitetura proposta

### 6.1 Clientes e serviços

- Expo + React Native + JavaScript; navegação, estado de sessão, armazenamento de rascunho no dispositivo e módulos por domínio. Decidir entre Firebase JS SDK e React Native Firebase por um protótipo de login, persistência, notificações e desenvolvimento nativo; não misturar integrações sem motivo.
- Firebase Auth e Firestore em Spark como objetivo inicial; Auth com persistência adequada ao React Native e providers vinculados. [Referência Firebase Auth](https://firebase.google.com/docs/reference/js/auth).
- Pagamentos e isenções são registrados manualmente por admin. Cálculos e correções oficiais têm trilha e permissão restrita. Tarefas mensais podem ser executadas pelo admin ou por cron-job externo do proprietário; não usar Cloud Functions. Segredos e credenciais não são embutidos no app.
- Expo Notifications com tokens por dispositivo; notificações locais para lembretes previamente agendados são possíveis sem servidor, mas não substituem push para eventos novos, correções, ou quando as condições mudam. Push remoto precisa de serviço remetente confiável e credenciais; Expo Go não cobre o teste de push remoto em versões atuais. [Expo](https://docs.expo.dev/push-notifications/what-you-need-to-know/) · [Firebase FCM](https://firebase.google.com/docs/cloud-messaging/server-environment).
- ESPN permanece como fonte de placares, gols e eventos, seguindo o sistema atual. O resumo de partida pode incluir a assistência associada ao gol. Para a estratégia Garçom, implementar a leitura desse dado, conferir a cobertura em jogos do Brasileirão e permitir verificação/correção manual pelo admin quando faltar ou divergir.
- IA: serviço externo protegido por backend, dados minimizados e fila/limites; orçamento por geração e aprovação editorial. Sem backend confiável, preparo de texto e publicação pelo administrador é o fluxo inicial. Imagens não serão gravadas como bytes/Base64 no Firestore: usar referência ao Dropbox.
- Imagens de participantes: consentimento específico e reversível, finalidade, acesso, retenção, armazenamento e exclusão; usuários sem foto recebem alternativa. Não fazer reconhecimento facial nem inferir dados sensíveis. Provedor e custo pendentes.

### 6.2 Modelo Firestore inicial — caminhos ilustrativos

```text
users/{uid}                              perfil público mínimo, identidade visual e `isAdmin` restrito; arquivos só referenciados por metadados/link Dropbox
users/{uid}/private/settings             preferências privadas
users/{uid}/devices/{deviceId}           token de push, plataforma, consentimento, atualização
seasons/{seasonId}                       título, estado, regras e calendário versionados
seasons/{seasonId}/members/{uid}         aprovação, inscrição, pagamento Pix manual, isenção e valor; escrita de admin
seasons/{seasonId}/rounds/{roundId}      prazos oficiais, estado e revisão da rodada
seasons/{seasonId}/rounds/{roundId}/matches/{matchId}   jogos e resultados publicados
seasons/{seasonId}/rounds/{roundId}/privatePredictions/{uid}  palpites do dono, protegidos antes da liberação
seasons/{seasonId}/rounds/{roundId}/publishedPredictions/{uid}  projeção publicada após início, se necessária
seasons/{seasonId}/tournaments/{id}     metadados, estado e versão das regras
seasons/{seasonId}/tournaments/{id}/standings/{uid}    classificação derivada e revisão
seasons/{seasonId}/tournaments/{id}/fixtures/{id}      confrontos e fase
seasons/{seasonId}/awards/{awardId}     conquistas com origem e versão
seasons/{seasonId}/feed/{postId}        conteúdo revisado e publicado
seasons/{seasonId}/audit/{eventId}      eventos de administração, acesso restrito

```

Os caminhos são esboço, não regras de segurança prontas. Definir granularidade dos palpites: um documento por jogador/rodada reduz leituras para os próprios palpites, mas atualizações por partida precisam de verificação do prazo e tratamento de concorrência; documentos por partida simplificam regras individuais, com mais leituras/escritas. Protótipo com Emulator Suite deve escolher a opção que proteja os campos e se encaixe nas cotas. Escritas oficiais de resultados, projeções, pagamentos e classificações ficam restritas a serviço confiável ou administrador autorizado. Dados privados nunca devem ser aninhados em documento público.

**Índices:** criar apenas para consultas concretas, por exemplo feed por temporada/data e confrontos por competição/fase; isentar campos grandes que não serão consultados; validar índices compostos em testes e observar custos. Preferir queries paginadas, snapshots mínimos, cancelamento de listeners ao sair, dados resumidos e pré-cálculo publicado; evitar baixar todas as rodadas, usuários e palpites em cada tela ou atualizar a cada segundo.

**Cotas atuais (confirmar antes do lançamento):** uma base gratuita por projeto, 1 GiB, 50.000 leituras/dia, 20.000 escritas/dia, 20.000 exclusões/dia e 10 GiB/mês de saída; reinício próximo à meia-noite do Pacífico. Alguns recursos, como TTL e backups gerenciados, exigem faturamento. [Cotas oficiais](https://firebase.google.com/docs/firestore/quotas). Regras podem adicionar leituras e listeners cobram quando documentos retornados mudam; medir no emulador e no console, sem prometer uso zero.

**Orçamento de exemplo — não é estimativa garantida:** 20 jogadores × 8 aberturas/dia × 30 documentos lidos por abertura = 4.800 leituras/dia, antes de listeners, regras, telas adicionais, recargas e administração. Definir metas e medir a operação da rodada, o pior dia e a taxa por usuário. Planejar respostas a erro de cota, cache expirado e dados desatualizados; não confiar em cálculos oficiais offline.

### 6.3 Integridade, auditoria e automação

- Modelo de rodada: rascunho → publicada → palpites abertos → iniciada → resultados provisórios → encerrada → processada/publicada; correções posteriores geram revisão, reprocessamento e trilha.
- Lógica compartilhada e testável de placares, estrela, artilheiro e torneios. Administração visualiza uma prévia e confirma. Gravar IDs determinísticos de processamento por rodada/versão; reexecução não duplica pontos, eliminações ou troféus.
- Fonte confiável separa provisório de oficial; APIs externas podem falhar, atrasar ou corrigir resultados. Criar reconciliação, rollback controlado e auditoria, inclusive de alterações de regulamento ou horários.
- Sem serviço agendado, estados mudam por ações do admin ou leitura sob demanda; isso **não** garante atualização nem push automático quando não houver cliente ativo. Não colocar segredo no app para contornar essa limitação.
- Backup/exportação testados e plano de recuperação sem supor que o backup gerenciado está incluído no Spark; ambiente de teste separado da produção.

## 7. Pagamento e operação financeira

A inscrição é paga em reais por Pix manual. O admin define o valor antes da temporada, pré-cadastra o grupo-base, confere cada pagamento e atualiza o registro do participante no painel. O campeão da Superliga pode receber isenção na temporada seguinte se optar por participar. Inscrição aberta até a 5ª rodada; após esse limite o cadastro fecha. A divisão de premiação e a parcela administrativa seguem a tabela de referência da seção 3.3, com ajustes configurados pelo proprietário.


## 8. Etapas propostas e critérios de aceite

**Fase 0 — configuração:** valor em reais, participantes, regulamento, calendários, grupos, sorteios e chaves; confirmar dados ESPN de assistência, privacidade e serviços necessários.

**Fase 1 — protótipo técnico:** Expo dev build, Auth e linking, Firestore Rules emuladas, perfil, aprovação, leitura paginada e rascunho de palpites com sigilo e prazo. Critério: testes de dois usuários, relógio alterado, acesso não autorizado e reconexão; nenhum palpite alheio acessível antes do início.

**Fase 2 — núcleo da competição:** jogos, palpites, pontuação, estados de rodada, auditoria, histórico, Superliga e Supercopa; dados de exemplo isolados. Critério: casos de empate, pontos negativos, correções e reprocessamento idempotente revisados contra regulamento.

**Fase 3 — modalidades:** Recopa, Libertadores, Série B/C, Resta Um, Cinturão e Fórmula Deprê conforme regras definidas e configurações do admin. Critério: exemplos de temporada e casos-limite conferidos pelo administrador.

**Fase 4 — produto e comunidade:** lobby, avatar, conquistas, resenha e notificações; animações e som com preferências e acessibilidade. Critério: teste de 5–10 participantes convidados, telas pequenas, acessibilidade e experiência sem rede.

**Fase 5 — operação da temporada:** configurar inscrição Pix manual, status de pagamento/isentos, premiação, calendários e processos do admin; preparar suporte e distribuição do app.

**Migração:** inventariar usuários e IDs do Realtime Database, temporadas, rodadas, pontuações, torneios, troféus e fotos; exportar e validar; migrar em ambiente isolado; preservar UID de Auth quando possível; comparar totais e amostras, reconciliar e aprovar antes da virada; plano de retorno sem perda e congelamento de escrita no momento combinado. Não excluir nem alterar a base atual no planejamento.

## 9. Itens operacionais para configurar

- Valor da inscrição em reais, roster pré-cadastrado, total de vagas e status de Pix/isentos.
- Sorteio dos grupos da Supercopa, tamanho dos grupos, potes e chaves de cada mata-mata.
- Critério de participantes e chave da Libertadores com base na Superliga anterior, alinhados com a turma.
- Decisão anual de realizar a Recopa e confirmação dos participantes.
- Equipes da Fórmula Deprê conforme número final de participantes, sem alterações depois do início.
- Calendário de rodadas por torneio, fonte ESPN para gols/assistências e rotina manual ou cron-job para o Cinturão do Mês.


## 10. Referências técnicas consultadas em 24/11/2026

- [Firebase — cotas do Firestore](https://firebase.google.com/docs/firestore/quotas) e [consultas e regras](https://firebase.google.com/docs/firestore/security/rules-query).
- [Firebase — vincular provedores](https://firebase.google.com/docs/auth/web/account-linking) e [persistência React Native](https://firebase.google.com/docs/reference/js/auth).
- [Firebase — Cloud Storage e Spark](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) e [ambiente confiável para FCM](https://firebase.google.com/docs/cloud-messaging/server-environment).
- [Expo — notificações e builds de desenvolvimento](https://docs.expo.dev/push-notifications/what-you-need-to-know/).
- [ESPN — resumo de partida de futebol usado pelo projeto](https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/summary).
