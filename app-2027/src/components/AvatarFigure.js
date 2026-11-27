import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

const bodyShapes = {
  leve: 'M58 126 Q69 118 78 118 H102 Q111 118 122 126 Q140 130 145 146 L133 156 L126 146 L137 190 H43 L54 146 L47 156 L35 146 Q40 130 58 126Z',
  atletico: 'M55 126 Q68 118 78 118 H102 Q112 118 125 126 Q146 131 151 149 L137 160 L128 148 L139 190 H41 L52 148 L43 160 L29 149 Q34 131 55 126Z',
  forte: 'M51 126 Q66 117 78 117 H102 Q114 117 129 126 Q151 130 158 151 L141 163 L130 150 L141 190 H39 L50 150 L39 163 L22 151 Q29 130 51 126Z',
};

const hairFront = {
  curto: 'M50 75 Q47 45 67 34 Q82 25 98 31 Q125 27 132 58 L129 76 Q119 61 109 59 Q99 52 88 60 Q76 52 66 63 L56 78Z',
  social: 'M50 76 Q44 45 68 33 Q91 20 116 34 Q133 44 130 72 L122 67 Q118 51 105 49 Q87 50 74 59 Q63 66 56 81Z',
  undercut: 'M49 76 Q43 49 62 36 Q79 22 99 28 Q125 28 132 57 L129 77 L122 67 Q115 54 102 53 Q82 54 69 66 L58 78 L58 60 Q52 63 49 76Z',
  raspado: 'M53 67 Q53 38 75 34 Q98 27 117 37 Q129 45 128 68 Q117 53 102 51 Q78 51 61 67Z',
  cacheado: 'M49 79 Q39 31 90 28 Q141 31 131 79 L121 70 Q114 55 105 57 Q97 42 88 58 Q75 43 66 61 Q56 58 49 79Z',
  afro: 'M48 81 Q35 68 43 53 Q38 39 55 35 Q59 20 75 28 Q88 16 99 28 Q117 19 123 36 Q141 44 133 61 Q139 74 130 84 L119 71 Q111 62 102 59 Q91 66 82 58 Q69 57 61 70Z',
  longo: 'M49 79 Q42 40 66 31 Q87 23 103 31 Q130 34 132 65 L126 84 Q118 60 104 57 Q91 48 78 58 Q65 58 56 81Z',
  ondas: 'M48 81 Q38 65 48 53 Q41 42 56 34 Q69 24 82 33 Q93 23 105 34 Q127 30 133 52 Q140 65 129 82 L121 69 Q111 61 104 58 Q91 63 82 56 Q67 58 58 80Z',
  chanel: 'M48 83 Q42 45 66 32 Q89 20 111 34 Q134 47 131 82 L127 103 Q119 113 112 103 L115 72 Q102 57 90 60 Q73 58 63 73 L67 105 Q58 114 51 103Z',
  rabo: 'M49 78 Q44 43 69 32 Q91 23 112 34 Q132 46 130 75 L122 68 Q119 52 102 51 Q80 50 61 68Z',
  coque: 'M49 78 Q44 43 69 32 Q91 23 112 34 Q132 46 130 75 L122 68 Q119 52 102 51 Q80 50 61 68Z',
  trancas: 'M49 77 Q46 42 68 31 Q90 21 112 33 Q133 46 131 77 L123 67 Q116 54 104 56 Q92 47 82 56 Q66 55 56 78Z',
};

const hairBack = {
  longo: 'M51 67 Q44 44 63 32 Q81 20 104 29 Q132 38 132 70 L138 126 Q135 140 124 145 L117 91 Q111 71 101 62 Q83 55 69 66 Q59 77 58 99 L55 143 Q42 137 42 122Z',
  ondas: 'M52 70 Q42 48 59 34 Q76 21 91 31 Q109 23 124 40 Q139 55 129 81 L141 123 Q139 139 125 145 L115 92 Q106 73 97 64 Q83 56 72 68 Q63 79 61 100 L57 142 Q45 138 42 123Z',
  chanel: 'M51 68 Q44 42 66 31 Q90 19 112 33 Q135 47 130 80 L137 110 Q133 123 121 119 L116 77 Q108 62 95 59 Q77 57 64 74 L62 119 Q50 124 45 111Z',
  rabo: 'M117 42 Q143 45 142 69 Q139 86 126 92 L119 79 Q127 68 117 61Z',
  coque: 'M76 39 Q70 26 78 17 Q86 8 97 13 Q111 17 106 39 Q118 48 124 61 L113 70 Q104 55 90 52 Q77 55 65 70 L55 61 Q62 47 76 39Z',
  trancas: 'M57 67 Q45 99 48 133 Q50 145 59 148 Q67 143 64 129 L67 91Z M119 67 Q133 99 130 133 Q128 145 119 148 Q111 143 114 129 L111 91Z',
};

export function AvatarFigure({ config = {}, size = 150, style, crestConfig, initials = 'FC' }) {
  const gradientId = `avatar-shirt-${useId().replace(/:/g, '')}`;
  const shieldMaskId = `avatar-crest-${useId().replace(/:/g, '')}`;
  const skin = config.skinTone || '#B97756';
  const hair = config.hairColor || '#241A18';
  const hairLight = config.hairHighlight || hair;
  const primary = config.kitColor || '#126AC2';
  const secondary = config.kitSecondary || '#A6F16A';
  const beardColor = config.beardColor || hair;
  const body = bodyShapes[config.bodyType] || bodyShapes.atletico;
  const hairStyle = config.hairStyle === 'ondulado' ? 'ondas' : config.hairStyle || 'cacheado';
  const torsoTransform = config.height === 'baixo' ? 'translate(0 190) scale(1 .94) translate(0 -190)' : config.height === 'alto' ? 'translate(0 190) scale(1 1.06) translate(0 -190)' : undefined;
  const shirt = config.uniformStyle || 'classico';

  return (
    <Svg width={size} height={size * 1.12} viewBox="0 0 180 202" style={style}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity=".24" /><Stop offset=".42" stopColor={primary} /><Stop offset="1" stopColor="#07182C" stopOpacity=".52" /></LinearGradient>
        {crestConfig && <ClipPathForCrest id={shieldMaskId} config={crestConfig} />}
      </Defs>
      <AvatarBodyLayer skin={skin} bodyType={config.bodyType} transform={torsoTransform} />
      <AvatarUniformLayer body={body} style={shirt} primary={primary} secondary={secondary} gradientId={gradientId} transform={torsoTransform} />
      <AvatarHairBackLayer style={hairStyle} color={hair} highlight={hairLight} />
      <AvatarHeadLayer skin={skin} presentation={config.presentation} />
      <AvatarExpressionLayer expression={config.expression || 'sorriso'} presentation={config.presentation} />
      <AvatarFacialHairLayer style={config.beardStyle || 'none'} color={beardColor} />
      <AvatarHairFrontLayer style={hairStyle} color={hair} highlight={hairLight} />
      <AvatarAccessoryLayer config={config} />
      {crestConfig && config.showCrest !== false && <AvatarCrestLayer config={crestConfig} initials={initials} maskId={shieldMaskId} />}
    </Svg>
  );
}

export function AvatarBodyLayer({ skin = '#B97756', bodyType = 'atletico', transform }) {
  const armPath = bodyType === 'forte'
    ? 'M48 128 Q34 130 29 150 L25 184 Q29 194 47 191 L58 147 M132 128 Q146 130 151 150 L155 184 Q151 194 133 191 L122 147'
    : bodyType === 'leve'
      ? 'M54 129 Q42 132 39 150 L35 183 Q39 192 52 190 L63 148 M126 129 Q138 132 141 150 L145 183 Q141 192 128 190 L117 148'
      : 'M51 128 Q37 131 33 150 L29 184 Q33 193 50 191 L61 147 M129 128 Q143 131 147 150 L151 184 Q147 193 130 191 L119 147';
  return <G transform={transform}>
    <Ellipse cx="90" cy="194" rx="55" ry="6" fill="#021329" fillOpacity=".38" />
    <Path d={armPath} fill={skin} stroke="#172B42" strokeOpacity=".35" strokeWidth="1.5" strokeLinejoin="round" />
    <Path d="M76 110 H104 V137 Q90 148 76 137Z" fill={skin} />
  </G>;
}

export function AvatarUniformLayer({ body, style, primary, secondary, gradientId, transform }) {
  return <G transform={transform}>
    <Path d={body} fill={primary} stroke="#D8F2FF" strokeOpacity=".38" strokeWidth="2" strokeLinejoin="round" />
    <Path d={body} fill={`url(#${gradientId})`} />
    {style === 'listrado' && <G stroke={secondary} strokeWidth="9" opacity=".92"><Path d="M62 125 L55 188" /><Path d="M83 120 L80 190" /><Path d="M105 120 L109 190" /><Path d="M126 125 L133 188" /></G>}
    {style === 'diagonal' && <Path d="M42 169 L113 121 H139 L72 190 H43Z" fill={secondary} fillOpacity=".9" />}
    {style === 'blocos' && <><Path d="M31 145 L58 130 V157 L34 166Z M149 145 L122 130 V157 L146 166Z" fill={secondary} /><Path d="M67 120 H113 V128 H67Z" fill={secondary} /></>}
    {style === 'classico' ? <Path d="M77 121 Q90 135 103 121" fill="none" stroke="#EFF7FF" strokeWidth="4" strokeLinecap="round" /> : <Path d="M78 120 H102 L90 137Z" fill={style === 'polo' ? secondary : '#EFF7FF'} fillOpacity=".96" />}
    {style === 'polo' && <><Path d="M84 125 V145 M96 125 V145" stroke={secondary} strokeWidth="2.5" /><Circle cx="90" cy="132" r="1.5" fill="#FFFFFF" /><Circle cx="90" cy="139" r="1.5" fill="#FFFFFF" /></>}
    <Path d="M34 149 L46 157 M146 149 L134 157" stroke={secondary} strokeWidth="4" />
    <Path d="M46 186 H134" stroke="#D8F2FF" strokeOpacity=".38" strokeWidth="1.5" />
  </G>;
}

export function AvatarHeadLayer({ skin, presentation = 'masculino' }) {
  const face = presentation === 'feminino'
    ? 'M51 70 Q50 40 90 39 Q130 40 129 70 L124 96 Q118 117 90 121 Q62 117 56 96Z'
    : 'M51 70 Q50 40 90 39 Q130 40 129 70 L124 98 Q116 120 90 123 Q64 120 56 98Z';
  return <>
    <Ellipse cx="47" cy="85" rx="8" ry="12" fill={skin} stroke="#7D4939" strokeOpacity=".28" strokeWidth="1.5" />
    <Ellipse cx="133" cy="85" rx="8" ry="12" fill={skin} stroke="#7D4939" strokeOpacity=".28" strokeWidth="1.5" />
    <Path d={face} fill={skin} stroke="#5A332E" strokeOpacity=".2" strokeWidth="1.5" />
    <Path d="M58 98 Q61 111 72 117" fill="none" stroke="#F8D1B8" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
  </>;
}

export function AvatarExpressionLayer({ expression = 'sorriso', presentation = 'masculino' }) {
  const lash = presentation === 'feminino' ? 2.8 : 0;
  if (expression === 'comemora') return <>
    <Path d="M65 87 Q73 80 81 87 M99 87 Q107 80 115 87" fill="none" stroke="#302129" strokeWidth="3" strokeLinecap="round" />
    <Path d="M78 105 Q90 99 102 105 Q100 119 90 119 Q80 119 78 105Z" fill="#43252B" />
    <Path d="M82 111 Q90 107 98 111 Q96 117 90 117 Q84 117 82 111Z" fill="#ED6C72" />
  </>;
  const brows = expression === 'focado'
    ? 'M65 80 L82 84 M98 84 L115 80'
    : expression === 'confiante'
      ? 'M65 81 Q73 75 82 80 M99 80 Q108 73 116 79'
      : 'M65 81 Q73 77 82 81 M98 81 Q107 77 115 81';
  const eyes = expression === 'serio' ? 'M67 90 Q74 87 81 90 M99 90 Q106 87 113 90' : 'M68 91 Q74 86 81 91 M99 91 Q106 86 112 91';
  return <>
    <Path d={brows} fill="none" stroke="#322326" strokeWidth={expression === 'focado' ? 4 : 3} strokeLinecap="round" />
    <Ellipse cx="74.5" cy="90" rx="5.2" ry="4.2" fill="#FFF4E9" /><Ellipse cx="105.5" cy="90" rx="5.2" ry="4.2" fill="#FFF4E9" />
    <Path d={eyes} fill="none" stroke="#241F25" strokeWidth={2.5 + lash} strokeLinecap="round" />
    <Circle cx="75" cy="91" r="2.1" fill="#181E29" /><Circle cx="105" cy="91" r="2.1" fill="#181E29" />
    {presentation === 'feminino' && <Path d="M68 88 L65 85 M72 87 L71 83 M78 87 L80 84 M100 87 L98 84 M106 87 L107 83 M111 88 L114 85" stroke="#241F25" strokeWidth="1.5" strokeLinecap="round" />}
    <Path d="M90 92 L86 102 Q90 105 94 102" fill="none" stroke="#784B3C" strokeWidth="2" strokeLinecap="round" />
    {expression === 'neutro' || expression === 'serio'
      ? <Path d="M82 111 Q90 110 98 111" fill="none" stroke="#663B35" strokeWidth="2.6" strokeLinecap="round" />
      : expression === 'confiante'
        ? <Path d="M82 110 Q91 116 100 108" fill="none" stroke="#663B35" strokeWidth="3" strokeLinecap="round" />
        : <Path d="M81 108 Q90 116 99 108" fill="none" stroke={presentation === 'feminino' ? '#8A4F55' : '#663B35'} strokeWidth="3" strokeLinecap="round" />}
  </>;
}

export function AvatarFacialHairLayer({ style = 'none', color = '#241A18' }) {
  if (style === 'none') return null;
  if (style === 'bigode') return <Path d="M75 106 Q82 102 89 107 Q95 102 103 106 Q100 114 91 112 Q84 114 75 106Z" fill={color} />;
  if (style === 'barba') return <Path d="M59 96 Q64 111 72 117 Q90 131 108 117 Q117 110 121 96 L116 117 Q109 132 90 135 Q71 132 64 117Z" fill={color} />;
  return <Path d="M65 110 Q70 119 78 121 M102 121 Q111 118 115 109" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />;
}

export function AvatarHairBackLayer({ style = 'curto', color = '#241A18', highlight = '#241A18' }) {
  if (!hairBack[style]) return null;
  return <G>
    <Path d={hairBack[style]} fill={color} stroke="#110F18" strokeOpacity=".42" strokeWidth="1.5" strokeLinejoin="round" />
    {style === 'rabo' && <Circle cx="119" cy="48" r="5" fill={highlight} />}
    {style === 'trancas' && <G fill={highlight}><Circle cx="57" cy="140" r="2" /><Circle cx="121" cy="140" r="2" /></G>}
  </G>;
}

export function AvatarHairFrontLayer({ style = 'curto', color = '#241A18', highlight = '#241A18' }) {
  if (style === 'careca') return <>
    <Path d="M55 65 Q59 40 90 38 Q121 40 125 65" fill="none" stroke="#F1C6AE" strokeOpacity=".35" strokeWidth="2" />
    <Path d="M51 75 Q48 55 64 43" fill="none" stroke="#6B5148" strokeOpacity=".28" strokeWidth="2" />
  </>;
  const d = hairFront[style] || hairFront.cacheado;
  return <G>
    <Path d={d} fill={color} stroke="#100F16" strokeOpacity=".5" strokeWidth="1.6" strokeLinejoin="round" />
    {['social', 'ondas', 'longo'].includes(style) && <Path d="M63 61 Q78 40 103 40" fill="none" stroke={highlight} strokeOpacity=".44" strokeWidth="3" strokeLinecap="round" />}
    {style === 'cacheado' && <G fill={highlight} fillOpacity=".82"><Circle cx="60" cy="49" r="5" /><Circle cx="75" cy="37" r="5" /><Circle cx="91" cy="34" r="5" /><Circle cx="108" cy="39" r="5" /><Circle cx="123" cy="51" r="5" /></G>}
    {style === 'afro' && <Path d="M49 61 Q58 29 90 27 Q122 29 132 61" fill="none" stroke={highlight} strokeOpacity=".3" strokeWidth="3" />}
    {style === 'trancas' && <G stroke={highlight} strokeOpacity=".72" strokeWidth="1.5"><Path d="M61 57 Q73 39 85 55 M78 45 Q91 33 103 53 M99 50 Q112 39 122 59" /></G>}
  </G>;
}

export function AvatarAccessoryLayer({ config = {} }) {
  const tint = config.glassesColor || config.bandanaColor || '#F2C94C';
  return <>
    {config.bandana && config.bandana !== 'none' && <G>
      <Path d="M52 66 Q90 53 128 66 L125 76 Q90 67 55 77Z" fill={config.bandanaColor || '#F2C94C'} stroke="#12263B" strokeOpacity=".56" strokeWidth="1.5" />
      {config.bandana === 'estampada' && <Path d="M63 67 L70 75 M83 63 L88 73 M104 63 L109 72 M119 67 L123 73" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="2" />}
    </G>}
    {config.glasses && config.glasses !== 'none' && <G fill="none" stroke={tint} strokeWidth="2.6" strokeLinejoin="round">
      {config.glasses === 'redondo' ? <><Circle cx="75" cy="90" r="9" /><Circle cx="105" cy="90" r="9" /></> : config.glasses === 'escuro' ? <><Path d="M64 83 H84 L82 96 Q73 101 66 94Z" fill={tint} /><Path d="M96 83 H116 L114 94 Q107 101 98 96Z" fill={tint} /></> : <><Path d="M64 83 Q75 79 85 84 L82 96 Q72 99 66 93Z" /><Path d="M95 84 Q105 79 116 83 L114 93 Q107 99 98 96Z" /></>}
      <Path d="M84 86 Q90 82 96 86 M64 85 L58 82 M116 85 L122 82" />
    </G>}
  </>;
}

function ClipPathForCrest({ id, config }) {
  const d = getShieldPath(config.shape);
  return <ClipPath id={id}><Path d={d} /></ClipPath>;
}

function AvatarCrestLayer({ config, initials, maskId }) {
  const shape = getShieldPath(config.shape);
  const fill = config.colorPrimary || '#0A8058';
  const stripe = config.colorSecondary || '#0B365B';
  const border = config.colorBorder || '#F2C94C';
  return <G transform="translate(117 137) scale(.078)">
    <G clipPath={`url(#${maskId})`}>
      <Rect width="180" height="194" fill={fill} />
      <Rect x="76" y="0" width="28" height="194" fill={stripe} />
    </G>
    <Path d={shape} fill="none" stroke={border} strokeWidth="10" />
    <SvgText x="90" y="108" textAnchor="middle" fill={config.colorText || '#FFFFFF'} fontSize="39" fontWeight="900">{String(config.abbrText || initials || 'FC').slice(0, 2).toUpperCase()}</SvgText>
  </G>;
}

function getShieldPath(shape) {
  const paths = {
    ogival: 'M18 13 Q90 2 162 13 L158 91 Q153 136 90 180 Q27 136 22 91 Z',
    french: 'M24 17 L156 17 L156 91 Q153 137 90 177 Q27 137 24 91 Z',
    circle: 'M90 15 A75 75 0 0 1 90 165 A75 75 0 0 1 90 15 Z',
    round: 'M90 15 A75 75 0 0 1 90 165 A75 75 0 0 1 90 15 Z',
    diamond: 'M90 10 L164 90 L90 174 L16 90 Z',
    retro: 'M22 21 Q90 39 158 21 L154 98 Q148 142 90 178 Q32 142 26 98 Z',
    crown: 'M22 34 L52 17 L90 31 L128 17 L158 34 L154 99 Q146 144 90 178 Q34 144 26 99 Z',
    hexagon: 'M48 12 L132 12 L164 48 L152 133 L90 178 L28 133 L16 48 Z',
    spanish: 'M21 14 L159 14 L153 97 Q147 142 90 178 Q33 142 27 97 Z',
    square: 'M24 16 L156 16 L156 134 L90 178 L24 134 Z',
    pennant: 'M22 16 L158 16 L145 102 L90 178 L35 102 Z',
    oval: 'M90 12 C132 12 161 43 161 88 C161 131 132 174 90 180 C48 174 19 131 19 88 C19 43 48 12 90 12Z',
    winged: 'M18 31 L48 20 L68 31 L90 20 L112 31 L132 20 L162 31 L154 104 Q147 146 90 178 Q33 146 26 104 Z',
  };
  return paths[shape] || paths.ogival;
}
