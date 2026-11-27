# Brasileirão da Depressão · app 2027

Aplicativo Expo independente do site atual. Código em JavaScript, com navegação via Expo Router.

## Rodar localmente

```sh
npm install
npm start
```

Use `a` para Android, `i` para iOS (em macOS com Xcode) ou `w` para web. Os comandos diretos `npm run android`, `npm run ios` e `npm run web` também estão disponíveis.

## Estrutura inicial

- `src/app/`: rotas e telas.
- `src/components/`: componentes compartilhados, incluindo o mascote e os fluxos visuais de autenticação.
- `assets/brand/mascote-temporada.png`: emblema original enviado pelo administrador.
- `assets/brand/stadium-night.jpg`: fotografia de estádio usada como textura de fundo.
- `PRODUCT.md` e `DESIGN.md`: contexto do produto e direção visual.

Firebase ainda não está configurado. Consulte [`PRODUCT.md`](PRODUCT.md) e o [plano geral](../PLANO-APP-TEMPORADA-2027.md) antes de implementar autenticação ou regras de competição.
