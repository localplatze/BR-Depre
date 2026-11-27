# Brasileirão da Depressão — Avatar v1
Biblioteca vetorial modular original, frontal, 240 × 320. Não requer API de geração de imagens.

## Integração no app
O onboarding usa `Avatar.tsx`, `registry.ts` e `config.js`. O componente compõe as peças localmente com `react-native-svg`; as respostas são guardadas como JSON em `users/{uid}/avatarConfig`, com `schemaVersion`, `parts`, `colors` e `showCrest`. Nenhum SVG renderizado ou imagem em Base64 é enviado ao Firebase.

As opções de acessório podem ser combinadas. Bandana, armação dos óculos e munhequeira têm tokens de cor independentes (`BANDANA`, `GLASSES`, `WRIST`). O escudo do jogador é sobreposto no ponto `badgeAnchor` do manifesto.

Perfis que ainda estejam no formato anterior são convertidos para o esquema atual ao abrir a etapa de avatar e só são persistidos quando o jogador confirma o perfil.

## Expo
Execute `npx expo install react-native-svg`. Copie Avatar.tsx e registry.ts para seu projeto. Importe `Avatar` e passe uma configuração de examples.json. Exemplo:

```tsx
import { Avatar } from './avatar/Avatar';
import examples from './avatar/examples.json';
<Avatar config={examples[0]} width={120} height={160} />
```

Salve somente `parts` e `colors` no Firebase, junto de uma versão de schema. Use IDs do manifesto. A ordem é aplicada automaticamente pelo componente. `hair-front` sincroniza a camada traseira; `body` sincroniza mangas e munhequeiras. Uma seleção por camada; acessórios faciais são mutuamente exclusivos nesta versão. Cabelos, rostos e acessórios podem ser compartilhados entre bases. O manifesto define a posição do escudo (x=153, y=248, 22×25); sobreponha seu próprio escudo nessa coordenada, respeitando a escala uniforme. Cabelos longos podem passar por trás dos ombros.

## Cores
Tokens SKIN, HAIR, JERSEY, TRIM, EYE, ITEM recebem hex de seis dígitos. Altere `config.colors`, sem alterar os caminhos. SVGs individuais possuem cores padrão válidas para abrir em editores; `registry.ts` contém os mesmos caminhos com tokens. Para editar a geometria e manter a engine sincronizada, altere a entrada correspondente no registry e o SVG individual.

## Conteúdo
assets/ contém as peças; manifest.json lista camadas, variantes e tokens; examples.json contém oito configurações; example-1.svg a example-8.svg são exemplos montados, não necessários em runtime. preview.png foi renderizada diretamente desses SVGs. O catálogo é uma primeira versão vetorial estilizada, não uma reprodução de 3D. Bases com a mesma largura compartilham a geometria do corpo; os rostos e os cabelos podem ser selecionados de forma independente. Não foi testado em dispositivo Expo.
