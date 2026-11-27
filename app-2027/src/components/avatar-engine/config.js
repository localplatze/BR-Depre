export const AVATAR_SCHEMA_VERSION = 1;

export const DEFAULT_AVATAR_CONFIG = {
  schemaVersion: AVATAR_SCHEMA_VERSION,
  parts: [
    'hair-back-curly', 'body-athletic', 'sleeves-athletic-short', 'jersey-vertical',
    'collar-crew', 'head-round', 'eyes-round', 'brows-natural', 'nose-round',
    'beard-none', 'mouth-smile', 'hair-front-curly', 'wrist-none',
  ],
  colors: {
    SKIN: '#B97756', HAIR: '#241A18', JERSEY: '#126AC2', TRIM: '#A6F16A',
    EYE: '#49352D', ITEM: '#F2C94C', BANDANA: '#F2C94C', GLASSES: '#FFFFFF', WRIST: '#F2C94C',
  },
  showCrest: true,
  crestPosition: 'right',
  crestSize: 'normal',
  sponsorText: '',
};

export const AVATAR_LAYERS = {
  body: 'body-',
  sleeves: 'sleeves-',
  jersey: 'jersey-',
  collar: 'collar-',
  head: 'head-',
  eyes: 'eyes-',
  brows: 'brows-',
  nose: 'nose-',
  beard: 'beard-',
  mouth: 'mouth-',
  hair: 'hair-front-',
  accessory: 'accessory-',
  wrist: 'wrist-',
};

const legacyHair = {
  careca: 'bald', raspado: 'buzz', curto: 'short', social: 'sidepart', undercut: 'sidepart',
  cacheado: 'curly', ondulado: 'long-wavy', ondas: 'long-wavy', afro: 'afro', longo: 'long-wavy',
  chanel: 'bob', rabo: 'ponytail', coque: 'bun', trancas: 'braids',
};
const legacyBody = { leve: 'slim', atletico: 'athletic', forte: 'robust' };
const legacyJersey = { classico: 'solid', 'gola-v': 'solid', listrado: 'vertical', diagonal: 'diagonal', blocos: 'shoulder', polo: 'solid' };
const layerStarts = Object.values(AVATAR_LAYERS);

function setPart(parts, prefix, id) {
  const keep = parts.filter((part) => !part.startsWith(prefix));
  return id ? [...keep, id] : keep;
}

export function replaceAvatarPart(config, layer, id) {
  const prefix = AVATAR_LAYERS[layer];
  if (!prefix) return config;
  let parts = setPart(config.parts || [], prefix, id);
  if (layer === 'hair' && id) parts = setPart(parts, 'hair-back-', `hair-back-${id.slice('hair-front-'.length)}`);
  if (layer === 'body' && id) {
    const bodyType = id.slice('body-'.length);
    const sleeve = (parts.find((part) => part.startsWith('sleeves-')) || '').endsWith('-long') ? 'long' : 'short';
    parts = setPart(parts, 'sleeves-', `sleeves-${bodyType}-${sleeve}`);
    const wrist = parts.find((part) => part.startsWith('wrist-'));
    if (wrist && wrist !== 'wrist-none') parts = setPart(parts, 'wrist-', `wrist-${bodyType}`);
  }
  return { ...config, schemaVersion: AVATAR_SCHEMA_VERSION, parts };
}

export function toggleAvatarAccessory(config, id) {
  const current = config.parts || [];
  const parts = current.includes(id)
    ? current.filter((part) => part !== id)
    : [...current.filter((part) => part !== 'accessory-none'), id];
  return { ...config, schemaVersion: AVATAR_SCHEMA_VERSION, parts };
}

export function setAvatarColor(config, token, color) {
  return {
    ...config,
    schemaVersion: AVATAR_SCHEMA_VERSION,
    colors: { ...(config.colors || DEFAULT_AVATAR_CONFIG.colors), [token]: color },
  };
}

export function normalizeAvatarConfig(saved) {
  if (saved && Array.isArray(saved.parts)) {
    let parts = [...DEFAULT_AVATAR_CONFIG.parts];
    for (const prefix of layerStarts) {
      const chosen = saved.parts.find((part) => part.startsWith(prefix));
      if (chosen) {
        const index = parts.findIndex((part) => part.startsWith(prefix));
        if (index >= 0) parts[index] = chosen;
        else parts.push(chosen);
      }
    }
    const accessories = saved.parts.filter((part) => part.startsWith('accessory-') && part !== 'accessory-none');
    const selectedHair = parts.find((part) => part.startsWith('hair-front-'));
    if (selectedHair) parts = setPart(parts, 'hair-back-', `hair-back-${selectedHair.slice('hair-front-'.length)}`);
    const mergedParts = parts.filter((part) => !part.startsWith('accessory-')).concat(accessories);
    return {
      schemaVersion: AVATAR_SCHEMA_VERSION,
      parts: mergedParts,
      colors: { ...DEFAULT_AVATAR_CONFIG.colors, ...(saved.colors || {}) },
      showCrest: saved.showCrest !== false,
      crestPosition: saved.crestPosition === 'center' ? 'center' : 'right',
      crestSize: ['small', 'normal', 'large'].includes(saved.crestSize) ? saved.crestSize : 'normal',
      sponsorText: typeof saved.sponsorText === 'string' ? saved.sponsorText.slice(0, 18) : '',
    };
  }

  const old = saved || {};
  const hair = legacyHair[old.hairStyle] || 'curly';
  const bodyType = legacyBody[old.bodyType] || 'athletic';
  const feminine = old.presentation === 'feminino';
  const body = `body-${feminine ? 'feminine-' : ''}${bodyType}`;
  const expression = old.expression === 'focado'
    ? ['eyes-narrow', 'brows-determined', 'mouth-neutral']
    : old.expression === 'serio'
      ? ['eyes-narrow', 'brows-natural', 'mouth-neutral']
      : old.expression === 'confiante'
        ? ['eyes-soft', 'brows-arched', 'mouth-smirk']
        : old.expression === 'comemora'
          ? ['eyes-happy', 'brows-arched', 'mouth-grin']
          : ['eyes-round', 'brows-natural', 'mouth-smile'];
  const beard = { none: 'none', bigode: 'mustache', barba: 'full', stubble: 'short' }[old.beardStyle] || 'none';
  const accessoryParts = [];
  if (old.bandana && old.bandana !== 'none') accessoryParts.push('accessory-headband');
  if (old.glasses && old.glasses !== 'none') accessoryParts.push('accessory-glasses');
  return {
    schemaVersion: AVATAR_SCHEMA_VERSION,
    parts: [
      `hair-back-${hair}`, body, `sleeves-${feminine ? 'feminine-' : ''}${bodyType}-short`,
      `jersey-${legacyJersey[old.uniformStyle] || 'vertical'}`,
      `collar-${old.uniformStyle === 'polo' ? 'polo' : old.uniformStyle === 'gola-v' ? 'v' : 'crew'}`,
      `head-${feminine ? 'feminine-' : ''}${feminine ? 'oval' : 'round'}`,
      ...expression.slice(0, 2), 'nose-round', `beard-${beard}`, expression[2],
      `hair-front-${hair}`, ...accessoryParts,
    ],
    colors: {
      ...DEFAULT_AVATAR_CONFIG.colors,
      SKIN: old.skinTone || DEFAULT_AVATAR_CONFIG.colors.SKIN,
      HAIR: old.hairColor || DEFAULT_AVATAR_CONFIG.colors.HAIR,
      JERSEY: old.kitColor || DEFAULT_AVATAR_CONFIG.colors.JERSEY,
      TRIM: old.kitSecondary || DEFAULT_AVATAR_CONFIG.colors.TRIM,
      BANDANA: old.bandanaColor || DEFAULT_AVATAR_CONFIG.colors.BANDANA,
      GLASSES: old.glassesColor || DEFAULT_AVATAR_CONFIG.colors.GLASSES,
    },
    showCrest: old.showCrest !== false,
    crestPosition: old.crestPosition === 'center' ? 'center' : 'right',
    crestSize: ['small', 'normal', 'large'].includes(old.crestSize) ? old.crestSize : 'normal',
    sponsorText: typeof old.sponsorText === 'string' ? old.sponsorText.slice(0, 18) : '',
  };
}
