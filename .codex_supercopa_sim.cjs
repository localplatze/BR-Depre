const fs = require('fs');
const supercopa = JSON.parse(fs.readFileSync('.codex_supercopa.json','utf8'));
const users = JSON.parse(fs.readFileSync('.codex_users.json','utf8'));
const groups = supercopa.groups;
const standings = JSON.parse(JSON.stringify(groups.standings));
const groupEntries = Object.entries(groups).filter(([k,v]) => Array.isArray(v));
const groupLabels = { group1:'Grupo A', group2:'Grupo B', group3:'Grupo C', group4:'Grupo D' };
const rounds = Object.entries(groups.rounds).sort((a,b)=>{
  const ta=a[1].timestamp||0, tb=b[1].timestamp||0;
  if (ta!==tb) return ta-tb;
  const na=parseInt((a[0].match(/\d+/)||[])[0]||0,10);
  const nb=parseInt((b[0].match(/\d+/)||[])[0]||0,10);
  return na-nb;
});
function name(id){ const u=users[id]||{}; return (u.customTeamName&&u.customTeamName.trim())||u.name||id; }
function parseScore(s){ if(!s||!s.includes('x')) return null; const [a,b]=s.split('x').map(x=>parseInt(x.trim(),10)); return Number.isFinite(a)&&Number.isFinite(b)?[a,b]:null; }
function h2hResult(idA,idB,results){
  for (const [,r] of rounds) {
    for (const m of Object.values(r.matches||{})) {
      const key = m.player1Id+'|'+m.player2Id;
      const rev = m.player2Id+'|'+m.player1Id;
      let sc = results[key] || results[rev] || (m.result ? parseScore(m.result) : null);
      if (!sc) continue;
      const p1 = results[key] ? m.player1Id : (results[rev] ? m.player2Id : m.player1Id);
      const p2 = results[key] ? m.player2Id : (results[rev] ? m.player1Id : m.player2Id);
      const s1 = sc[0], s2 = sc[1];
      if ((p1===idA && p2===idB) || (p1===idB && p2===idA)) {
        const scoreA = p1===idA ? s1 : s2;
        const scoreB = p1===idA ? s2 : s1;
        if (scoreA > scoreB) return -1;
        if (scoreB > scoreA) return 1;
      }
    }
  }
  return 0;
}
function sortGroup(playerIds, table, results){
  return playerIds.map(id=>({...table[id]})).sort((a,b)=>{
    if ((b.points||0)!==(a.points||0)) return (b.points||0)-(a.points||0);
    if ((b.wins||0)!==(a.wins||0)) return (b.wins||0)-(a.wins||0);
    const aGd=(a.goalsFor||0)-(a.goalsAg||0), bGd=(b.goalsFor||0)-(b.goalsAg||0);
    if (bGd!==aGd) return bGd-aGd;
    if ((b.goalsFor||0)!==(a.goalsFor||0)) return (b.goalsFor||0)-(a.goalsFor||0);
    return h2hResult(a.playerId,b.playerId,results);
  });
}
function apply(table,m,s1,s2){
  const a=table[m.player1Id], b=table[m.player2Id];
  a.games++; b.games++;
  a.goalsFor+=s1; a.goalsAg+=s2;
  b.goalsFor+=s2; b.goalsAg+=s1;
  if (s1>s2) { a.points+=3; a.wins++; b.losses++; }
  else if (s2>s1) { b.points+=3; b.wins++; a.losses++; }
  else { a.points++; b.points++; a.draws++; b.draws++; }
}
const remaining=[];
for (const [rk,r] of rounds) for (const [mk,m] of Object.entries(r.matches||{})) if (!parseScore(m.result)) remaining.push({round:rk,key:mk,...m});
const analysisProb={};
for (const [mk,v] of Object.entries(supercopa.matchAnalyses||{})) {
  const txt=v.text||'';
  const m=txt.match(/\[PLACAR_PROVAVEL\][\s\S]*?\n.*?(\d+) x (\d+)/);
  const o=[...txt.matchAll(/([^\n:]+): odd [^,]+,\s*(\d+)% de chance/gi)];
  if (m && o.length>=2) {
    const s1=+m[1], s2=+m[2], p1=+o[0][2], p2=+o[1][2];
    let pd=Math.max(0,100-p1-p2);
    if ((p1===0&&p2===0)||(p1===50&&p2===50&&s1===s2)) pd=100;
    const total=p1+p2+pd;
    analysisProb[mk]={score:[s1,s2], p1:p1/total, p2:p2/total, pd:pd/total};
  }
}
const currentRound = remaining.filter(m=>m.round==='Round 10');
const futureRounds = remaining.filter(m=>m.round!=='Round 10');
function chooseCurrent(m,r){
  const p=analysisProb[m.key];
  if (!p) return r<1/3?[1,0]:r<2/3?[0,1]:[1,1];
  if (r<p.p1) return p.score;
  if (r<p.p1+p.p2) return [p.score[1],p.score[0]];
  return [0,0];
}
function chooseFuture(r){ return r<1/3?[1,0]:r<2/3?[0,1]:[1,1]; }
const counts={};
for (const [gk,ids] of groupEntries) { counts[gk]={}; ids.forEach(id=>counts[gk][id]={top2:0,b:0,c:0}); }
const N=200000;
for (let i=0;i<N;i++) {
  const table=JSON.parse(JSON.stringify(standings));
  const simResults={};
  for (const m of currentRound) { const sc=chooseCurrent(m,Math.random()); simResults[m.player1Id+'|'+m.player2Id]=sc; apply(table,m,sc[0],sc[1]); }
  for (const m of futureRounds) { const sc=chooseFuture(Math.random()); simResults[m.player1Id+'|'+m.player2Id]=sc; apply(table,m,sc[0],sc[1]); }
  for (const [gk,ids] of groupEntries) {
    const sorted=sortGroup(ids,table,simResults);
    sorted.forEach((p,idx)=>{ if (idx<2) counts[gk][p.playerId].top2++; else if (idx===2) counts[gk][p.playerId].b++; else counts[gk][p.playerId].c++; });
  }
}
for (const [gk,ids] of groupEntries) {
  const now=sortGroup(ids,standings,{});
  console.log('\n'+groupLabels[gk]);
  console.log('Atual: '+now.map((p,i)=>`${i+1}. ${name(p.playerId)} (${p.points} pts)`).join(' | '));
  for (const p of now) {
    const c=counts[gk][p.playerId];
    console.log(`${name(p.playerId)} :: Mata-mata ${(100*c.top2/N).toFixed(1)}% | Serie B ${(100*c.b/N).toFixed(1)}% | Serie C ${(100*c.c/N).toFixed(1)}%`);
  }
}
