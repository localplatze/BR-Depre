# Direção visual · Brasileirão da Depressão

## Ideia

Um jogo de futebol entre amigos com energia brasileira e humor de arquibancada. A entrada acontece sob as luzes de um estádio; o drama vem da bola coroada que chora e das histórias da rodada.

## Assinatura

- **Símbolo:** emblema fornecido pelo administrador: bola clássica chorando, coroa amarela e faixa verde-amarela. Usar o arquivo original; não redesenhar nem simplificar em versões conflitantes.
- **Paleta:** azul de estádio e azul de placar como base; verde-gramado para ação e sucesso; amarelo da coroa apenas como detalhe; branco frio para leitura.
- **Linguagem:** jogo de futebol para celular, com fotografia de estádio real, azul de arquibancada, campo verde e o emblema como arte central. Brilho e profundidade vêm da marca e da foto; evitar halos, círculos decorativos e cartões genéricos.
- **Tipografia:** títulos curtos, compactos e pesados; texto de regra e leitura em sans-serif nativa, legível. Números de competição devem ser grandes e tabulares.
- **Composição:** hierarquia de transmissão esportiva, assimetria controlada e espaço para identidade do jogador. Evitar dashboards SaaS, pilhas de cards iguais, micro-rótulos repetidos, ícones genéricos e enfeites sem função.
- **Movimento:** entradas curtas, flutuação suave do emblema e feedback de placar; respeitar redução de movimento e não esconder informações em animações.

## Acessibilidade e responsividade

Contraste forte, tipografia escalável, alvos de toque de pelo menos 44 pt, texto alternativo em ilustrações e comportamento consistente em telas compactas e largas. Não depender só de cor para indicar status.

## Tela entregue

`/` abre a experiência com fotografia de estádio, emblema original e acesso direto a entrar ou criar conta. `/entrar` usa o Firebase Auth por e-mail com sessão persistente e encaminha à `/home`. A home combina identidade do jogador, estado contextual da rodada, campanha, atalhos para histórico e troféus, catálogo de torneios e navegação inferior; ainda usa dados de demonstração enquanto não é ligada ao Firestore. `/cadastro` continua como apresentação visual até a etapa de cadastro.
