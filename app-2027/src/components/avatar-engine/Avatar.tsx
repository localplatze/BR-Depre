import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { registry } from './registry';

export type ColorToken = 'SKIN' | 'HAIR' | 'JERSEY' | 'TRIM' | 'EYE' | 'ITEM' | 'BANDANA' | 'GLASSES' | 'WRIST';
export type AvatarConfig = { parts: string[]; colors?: Partial<Record<ColorToken, string>>; sponsorText?: string };
const defaults: Record<string,string> = { SKIN:'#e4a078', HAIR:'#493025', JERSEY:'#245bc4', TRIM:'#e33b45', EYE:'#49352d', ITEM:'#f4e9d9', BANDANA:'#f4e9d9', GLASSES:'#f4e9d9', WRIST:'#f4e9d9' };
const layers = ['hair-back','body','sleeves','jersey','collar','head','eyes','brows','nose','beard','mouth','hair-front','accessory','wrist'];
const layerOf = (id:string) => layers.findIndex(layer => id.startsWith(layer+'-'));
export function avatarXml(config: AvatarConfig) {
  const colors: Record<string,string> = {...defaults,...config.colors};
  const selected = new Map<number,string>();
  const accessories: string[] = [];
  for (const id of config.parts) {
    const layer=layerOf(id);
    if(layer>=0 && Object.prototype.hasOwnProperty.call(registry,id)) {
      if(layer===12) {
        if(id!=='accessory-none' && !accessories.includes(id)) accessories.push(id);
      } else selected.set(layer,id);
    }
  }
  const body=selected.get(1)?.slice(5);
  if(body) {
    const sleeve=selected.get(2)?.endsWith('-long')?'long':'short';
    selected.set(2,`sleeves-${body}-${sleeve}`);
    if(selected.get(13) && selected.get(13)!=='wrist-none') selected.set(13,`wrist-${body}`);
    if(sleeve==='long') selected.delete(13);
  }
  const hair=selected.get(11)?.slice(11);
  if(hair) selected.set(0,`hair-back-${hair}`);
  const collarType=selected.get(4)?.slice('collar-'.length) || 'crew';
  const neckline=collarType==='v'
    ? 'M91 208L120 236L149 208'
    : collarType==='polo'
      ? 'M91 208Q120 220 149 208'
      : 'M91 208Q120 224 149 208';
  const sponsorText=String(config.sponsorText || '').trim().slice(0,18);
  const sponsorFontSize=sponsorText.length > 14 ? 14 : sponsorText.length > 10 ? 18 : 26;
  const sponsorMarkup=sponsorText
    ? `<g text-anchor="middle" font-family="sans-serif" font-size="${sponsorFontSize}" font-weight="900" letter-spacing=".2"><text x="120" y="283" fill="#07182A" opacity=".72">${escapeXml(sponsorText)}</text><text x="120" y="281" fill="#FFFFFF">${escapeXml(sponsorText)}</text></g>`
    : '';
  const content=[...selected.entries()].sort((a,b)=>a[0]-b[0]).map(([layer,id])=>{
    let piece=registry[id]??'';
    if(layer===3) piece=piece.split('M91 208Q120 229 149 208').join(neckline);
    if(layer===13) piece=piece.replace(/\{\{ITEM\}\}/g,'{{WRIST}}');
    if(layer===4 && sponsorMarkup) piece+=sponsorMarkup;
    return piece;
  }).join('')
    + accessories.map((id) => {
      const itemToken = id === 'accessory-headband' ? 'BANDANA' : id === 'accessory-glasses' ? 'GLASSES' : 'ITEM';
      return (registry[id] ?? '').replace(/\{\{ITEM\}\}/g, `{{${itemToken}}}`);
    }).join('');
  const coloredContent=content.replace(/\{\{([A-Z]+)\}\}/g, (_,key:string)=> /^#[0-9a-f]{6}$/i.test(colors[key]??'')?colors[key]:defaults[key]??'#000000');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320">${coloredContent}</svg>`;
}
function escapeXml(value:string) {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
export function Avatar({config,width=120,height=160}:{config:AvatarConfig;width?:number;height?:number}) {
  const xml=useMemo(()=>avatarXml(config),[config]);
  return <SvgXml xml={xml} width={width} height={height}/>;
}
