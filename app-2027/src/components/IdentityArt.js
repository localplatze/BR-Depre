import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Polygon, Rect, Stop, SvgXml, Text as SvgText } from 'react-native-svg';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { FORMULA_CAR_SVG } from './formulaCarSvgSource';
import { AvatarFigure } from './AvatarFigure';
import { Avatar as ModularAvatar } from './avatar-engine/Avatar';

const crestShapes = {
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

export function PlayerCrest({ config = {}, initials = 'FC', size = 112, style }) {
  const gradientId = `crest-sheen-${useId().replace(/:/g, '')}`;
  const shape = crestShapes[config.shape] ? config.shape : 'ogival';
  // Include the shape in both the native SVG key and clip id. Some RN SVG
  // versions keep a clipPath definition cached when only its `d` changes,
  // leaving the new outline around a fill clipped to the previous silhouette.
  const clipId = `crest-mask-${useId().replace(/:/g, '')}-${shape}`;
  const path = crestShapes[shape];
  const primary = config.colorPrimary || '#10B981';
  const secondary = config.colorSecondary || '#087E8B';
  const tertiary = config.colorTertiary || '#F2C94C';
  const border = config.colorBorder || '#F4C84A';
  const iconColor = config.colorIcon || '#FFFFFF';
  const pattern = config.pattern || 'v-stripes';
  const icon = config.selectedIcon || 'ball';
  const iconScale = config.iconScale === 'small' ? .78 : config.iconScale === 'large' ? 1.18 : 1;
  const iconBacking = config.iconBacking || 'disc';
  const letterStyle = config.letterStyle || 'varsity';
  const letterFamily = letterStyle === 'serif' ? 'serif' : letterStyle === 'condensed' ? 'sans-serif-condensed' : 'sans-serif';
  const badgeText = String(config.abbrText || initials).slice(0, 4).toUpperCase();
  const borderStyle = config.borderStyle || 'classic';
  const borderWidth = borderStyle === 'fine' ? 4 : borderStyle === 'metal' ? 9 : 7;
  const sheen = config.finish === 'matte' ? .06 : .28;
  const textColor = config.colorText || '#08182D';
  const iconSize = size * .3 * iconScale;
  const iconTop = size * 1.08 * (77 / 194) - iconSize / 2;
  return (
    <View style={[{ width: size, height: size * 1.08, position: 'relative' }, style]}>
      <Svg key={shape} width={size} height={size * 1.08} viewBox="0 0 180 194">
      <Defs>
        <ClipPath id={clipId}><Path d={path} /></ClipPath>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={sheen} /><Stop offset=".48" stopColor="#FFFFFF" stopOpacity="0" /><Stop offset="1" stopColor="#06142F" stopOpacity={sheen * .72} /></LinearGradient>
      </Defs>
      <Path d={path} fill="#06172C" transform="translate(0 5)" />
      <G clipPath={`url(#${clipId})`}>
        <Rect x="0" y="0" width="180" height="194" fill={primary} />
        <CrestPatternArtwork pattern={pattern} secondary={secondary} tertiary={tertiary} border={border} />
        <Rect x="0" y="0" width="180" height="194" fill={`url(#${gradientId})`} />
      </G>
      {config.ornament && config.ornament !== 'none' && <CrestOrnament variant={config.ornament} color={iconColor} />}
      <Path d={path} fill="none" stroke={border} strokeWidth={borderWidth} />
      {borderStyle === 'double' && <Path d={path} fill="none" stroke="#FFFFFF" strokeOpacity=".75" strokeWidth="1.6" transform="translate(90 97) scale(.91) translate(-90 -97)" />}
      {borderStyle === 'metal' && <Path d={path} fill="none" stroke="#FFFFFF" strokeOpacity=".58" strokeWidth="1.5" transform="translate(0 -2)" />}
      <Path d={path} fill="none" stroke="#FFFFFF" strokeOpacity=".45" strokeWidth="1.5" transform="translate(0 -2)" />
      {iconBacking === 'disc' && <Circle cx="90" cy="77" r="34" fill="#071526" fillOpacity=".63" stroke="#FFFFFF" strokeOpacity=".36" strokeWidth="1.5" />}
      {iconBacking === 'ribbon' && <Path d="M47 61 L72 67 L68 114 L90 102 L112 114 L108 67 L133 61 L126 101 Q90 123 54 101Z" fill={border} stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="2" />}
      {config.showAbbr !== false && <>
        <Path d="M40 132 H140 V158 Q90 165 40 158 Z" fill={border} stroke="#FFFFFF" strokeWidth="1.5" />
        <SvgText x="90" y="153" textAnchor="middle" fill={textColor} fontSize={badgeText.length > 3 ? 13 : 17} fontFamily={letterFamily} fontWeight="900" fontStyle={letterStyle === 'italic' ? 'italic' : 'normal'} letterSpacing={letterStyle === 'condensed' ? '0' : '1'} stroke={letterStyle === 'block' ? textColor : 'none'} strokeWidth={letterStyle === 'block' ? '.7' : '0'}>{badgeText}</SvgText>
      </>}
      </Svg>
      <MaterialDesignIcons name={getCrestIconName(icon)} color={iconColor} size={iconSize} style={{ position: 'absolute', left: size / 2 - iconSize / 2, top: iconTop }} />
    </View>
  );
}

export function CrestMiniature({ shape = 'ogival', pattern = 'solid', colorPrimary = '#0A8058', colorSecondary = '#0B65B3', colorTertiary = '#F2C94C', colorBorder = '#F2C94C', selected = false, size = 40 }) {
  const clipId = `crest-mini-${useId().replace(/:/g, '')}-${shape}`;
  const path = crestShapes[shape] || crestShapes.ogival;
  return <Svg key={`${shape}-${pattern}`} width={size} height={size * 1.08} viewBox="0 0 180 194">
    <Defs><ClipPath id={clipId}><Path d={path} /></ClipPath></Defs>
    <G clipPath={`url(#${clipId})`}>
      <Rect width="180" height="194" fill={colorPrimary} />
      <CrestPatternArtwork pattern={pattern} secondary={colorSecondary} tertiary={colorTertiary} border={colorBorder} />
    </G>
    <Path d={path} fill="none" stroke={selected ? '#A6F16A' : colorBorder} strokeWidth={selected ? 9 : 6} />
  </Svg>;
}

function CrestPatternArtwork({ pattern, secondary, tertiary, border }) {
  return <>
    {pattern === 'v-stripes' && <><Rect x="50" y="0" width="26" height="194" fill={secondary} /><Rect x="104" y="0" width="26" height="194" fill={secondary} /></>}
    {pattern === 'h-stripes' && <><Rect x="0" y="53" width="180" height="24" fill={secondary} /><Rect x="0" y="111" width="180" height="24" fill={secondary} /></>}
    {pattern === 'diagonal' && <Path d="M-20 45 L5 20 L200 145 L175 170 Z" fill={secondary} />}
    {pattern === 'diagonal_inv' && <Path d="M175 20 L200 45 L5 170 L-20 145 Z" fill={secondary} />}
    {pattern === 'halves' && <Rect x="90" y="0" width="90" height="194" fill={secondary} />}
    {pattern === 'quarters' && <><Rect x="90" y="0" width="90" height="97" fill={secondary} /><Rect x="0" y="97" width="90" height="97" fill={secondary} /></>}
    {pattern === 'chevron' && <Path d="M0 48 L90 105 L180 48 L180 80 L90 138 L0 80 Z" fill={secondary} />}
    {pattern === 'cross' && <><Rect x="76" y="0" width="28" height="194" fill={secondary} /><Rect x="0" y="72" width="180" height="28" fill={secondary} /></>}
    {pattern === 'circle_target' && <><Circle cx="90" cy="78" r="54" fill="none" stroke={secondary} strokeWidth="18" /><Circle cx="90" cy="78" r="24" fill={secondary} /></>}
    {pattern === 'pinstripes' && <G fill={secondary}>{[31, 49, 67, 113, 131, 149].map((x) => <Rect key={x} x={x} y="0" width="7" height="194" />)}</G>}
    {pattern === 'hoops' && <G fill={secondary}>{[34, 70, 106, 142].map((y) => <Rect key={y} x="0" y={y} width="180" height="13" />)}</G>}
    {pattern === 'tricolor' && <><Rect x="0" y="0" width="60" height="194" fill={secondary} /><Rect x="120" y="0" width="60" height="194" fill={tertiary} /></>}
  </>;
}

const crestIconAliases = { ball: 'soccer', bolt: 'lightning-bolt', shield: 'shield-star', boot: 'shoe-cleat', flag: 'flag-checkered', eagle: 'bird', lion: 'cat', wolf: 'dog-side', bull: 'bullseye', phoenix: 'fire', laurel: 'medal', goal: 'soccer-field', captain: 'shield-crown' };
function getCrestIconName(name) { return crestIconAliases[name] || name || 'soccer'; }

function CrestOrnament({ variant, color }) {
  if (variant === 'stars') return <G fill={color}>
    <Polygon points="42,65 45,72 53,73 47,78 49,86 42,82 35,86 37,78 31,73 39,72" />
    <Polygon points="138,65 141,72 149,73 143,78 145,86 138,82 131,86 133,78 127,73 135,72" />
    <Polygon points="43,96 45,101 51,102 46,106 47,112 43,109 38,112 39,106 34,102 40,101" />
    <Polygon points="137,96 139,101 145,102 140,106 141,112 137,109 132,112 133,106 128,102 134,101" />
  </G>;
  if (variant === 'laurel') return <G fill={color}>
    <Path d="M45 111 Q30 94 36 60 Q42 82 49 87 Q43 98 45 111Z M135 111 Q150 94 144 60 Q138 82 131 87 Q137 98 135 111Z" />
    <Path d="M39 82 Q30 78 31 68 Q39 70 43 77 M41 96 Q31 94 30 84 Q39 85 44 91 M141 82 Q150 78 149 68 Q141 70 137 77 M139 96 Q149 94 150 84 Q141 85 136 91" />
  </G>;
  if (variant === 'wings') return <G fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M53 65 37 57 45 72 31 70 47 82 M127 65 143 57 135 72 149 70 133 82" />
    <Path d="M52 91 38 88 48 101 M128 91 142 88 132 101" strokeWidth="2.4" />
  </G>;
  if (variant === 'bolts') return <G fill={color}>
    <Path d="M39 59 H51 L45 73 H53 L37 91 L41 77 H34Z" />
    <Path d="M141 59 H129 L135 73 H127 L143 91 L139 77 H146Z" />
  </G>;
  return null;
}

export function CrestGlyph({ name, color = '#FFFFFF', size = 24 }) {
  return <MaterialDesignIcons name={getCrestIconName(name)} color={color} size={size} />;
}

export function PlayerAvatar({ config = {}, size = 150, style, crestConfig, initials = 'FC' }) {
  if (Array.isArray(config.parts)) {
    const height = size * (320 / 240);
    const anchor = config.crestPosition === 'center'
      ? { x: 108, y: 241, width: 24, height: 28 }
      : { x: 153, y: 248, width: 22, height: 25 };
    const crestScale = config.crestSize === 'small' ? .78 : config.crestSize === 'large' ? 1.38 : 1;
    const crestSize = size * (anchor.width / 240) * crestScale;
    const crestLeft = size * (anchor.x + anchor.width * (1 - crestScale) / 2) / 240;
    const crestTop = size * (anchor.y + anchor.height * (1 - crestScale) / 2) / 240;
    return <View style={[{ width: size, height, position: 'relative' }, style]}>
      <ModularAvatar config={config} width={size} height={height} />
      {crestConfig && config.showCrest !== false && <PlayerCrest
        config={crestConfig}
        initials={initials}
        size={crestSize}
        style={{ position: 'absolute', left: crestLeft, top: crestTop }}
      />}
    </View>;
  }
  return <View style={[{ width: size, height: size * 1.12 }, style]}>
    <AvatarFigure config={config} size={size} crestConfig={crestConfig} initials={initials} />
  </View>;
}

export function FormulaCarBadge({ color = '#1769C2', size = 148 }) {
  const themedSvg = FORMULA_CAR_SVG
    .replace(/(<g id="body-primary"[^>]*fill=")[^"]+(" stroke=")[^"]+/, (_, fillPrefix, strokePrefix) => `${fillPrefix}${color}${strokePrefix}${shadeColor(color)}`)
    .replace(/(<g id="body-secondary"[^>]*fill=")[^"]+/, (_, fillPrefix) => `${fillPrefix}${mixColor(color, '#FFFFFF', 0.34)}`)
    .replace('fill="#ef4444"', `fill="${color}"`);
  return <SvgXml xml={themedSvg} width={size} height={size * (240 / 360)} />;
}

function shadeColor(hex, amount = 0.42) {
  return mixColor(hex, '#101827', amount);
}

function mixColor(first, second, amount) {
  const toRgb = (hex) => hex.replace('#', '').match(/.{2}/g)?.map((channel) => parseInt(channel, 16)) || [23, 105, 194];
  const a = toRgb(first);
  const b = toRgb(second);
  return `#${a.map((channel, index) => Math.round(channel * (1 - amount) + b[index] * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function makeTeamInitials(teamName = '') {
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase();
  return (words[0] || 'FC').slice(0, 3).toUpperCase();
}
