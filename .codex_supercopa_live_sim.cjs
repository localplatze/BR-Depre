const fs = require('fs');
const supercopa = JSON.parse(fs.readFileSync('.codex_supercopa.json','utf8'));
const users = JSON.parse(fs.readFileSync('.codex_users.json','utf8'));
const activeRoundsRaw = JSON.parse(fs.readFileSync('.codex_active_rounds.json','utf8'));
const activeSuperligaRoundData = Object.values(activeRoundsRaw || {}).find(r => (r.tournaments || []).includes('supercopa')) || null;
const groups = supercopa.groups;
const baseStandings = JSON.parse(JSON.stringify(groups.standings));
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
function calculateMatchPoints(final, pred) {
  if (!final || final.homeScore === undefined || !pred || pred.homeScore === undefined) return 0;
  let pts = 0;
  if (final.homeScore == pred.homeScore && final.awayScore == pred.awayScore) pts = 3;
  else {
    const finalW = Math.sign(final.homeScore - final.awayScore);
    const predW = Math.sign(pred.homeScore - pred.awayScore);
    if (finalW === predW) pts = 1;
    else if (final.homeScore == pred.awayScore && final.awayScore == pred.homeScore) pts = -1;
    else pts = 0;
  }
  if (pred.isStarMatch || pred.isCaptain || pred.star || pred.doublePoints) pts *= 2;
  return pts;
}
function calculateLiveRoundPoints(playerId, roundData, finalOverrides = new Map()) {
  if (!playerId) return 0;
  if (!roundData) {
    const u = users[playerId] || {};
    return u.lastRoundPointsLigaClausura ?? u.lastRoundPointsLigaAbertura ?? 0;
  }
  let points = 0;
  let hasValidPrediction = false;
  const matches = roundData.matches ? (Array.isArray(roundData.matches) ? roundData.matches : Object.values(roundData.matches)) : [];
  for (const match of matches) {
    const finalResult = finalOverrides.get(match.apiFixtureId) || match.finalResult;
    if (finalResult && match.predictions?.[playerId]) {
      hasValidPrediction = true;
      points += calculateMatchPoints(finalResult, match.predictions[playerId]);
    }
  }
  const starPlayers = roundData.starPlayers || {};
  const playerGoals = roundData.playerGoals || {};
  const sp = starPlayers[playerId];
  if (hasValidPrediction && sp && sp.athleteId) {
    const gInfo = playerGoals[sp.athleteId] || 0;
    const gCount = typeof gInfo === 'number' ? gInfo : (gInfo.count || 0);
    points += gCount;
  }
  return points;
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
const activeCopaRoundEntry = Object.entries(groups.rounds).find(([,r]) => r.status === 1);
const activeCopaRound = activeCopaRoundEntry?.[1];
const liveStandings = JSON.parse(JSON.stringify(baseStandings));
const lockedResults = {};
if (activeCopaRound && activeSuperligaRoundData) {
  for (const m of Object.values(activeCopaRound.matches || {})) {
    const p1 = calculateLiveRoundPoints(m.player1Id, activeSuperligaRoundData);
    const p2 = calculateLiveRoundPoints(m.player2Id, activeSuperligaRoundData);
    lockedResults[m.player1Id + '|' + m.player2Id] = [p1, p2];
    apply(liveStandings, m, p1, p2);
  }
}
const unresolvedFixtures = (activeSuperligaRoundData?.matches ? (Array.isArray(activeSuperligaRoundData.matches) ? activeSuperligaRoundData.matches : Object.values(activeSuperligaRoundData.matches)) : []).filter(m => !m.finalResult && m.liveStatus !== 'FT');
const plausibleScores = [
  {homeScore:0,awayScore:0}, {homeScore:1,awayScore:0}, {homeScore:0,awayScore:1},
  {homeScore:1,awayScore:1}, {homeScore:2,awayScore:1}, {homeScore:1,awayScore:2},
  {homeScore:2,awayScore:0}, {homeScore:0,awayScore:2}
];
const remainingFuture = [];
for (const [rk,r] of rounds) {
  for (const [mk,m] of Object.entries(r.matches||{})) {
    if (r.status === 1) continue;
    if (!parseScore(m.result)) remainingFuture.push({round:rk,key:mk,...m});
  }
}
const counts={};
for (const [gk,ids] of groupEntries) { counts[gk]={}; ids.forEach(id=>counts[gk][id]={top2:0,b:0,c:0}); }
const N=200000;
for (let i=0;i<N;i++) {
  const overrideFinals = new Map();
  for (const f of unresolvedFixtures) {
    const sc = plausibleScores[Math.floor(Math.random()*plausibleScores.length)];
    overrideFinals.set(f.apiFixtureId, sc);
  }
  const table = JSON.parse(JSON.stringify(baseStandings));
  const results = {};
  if (activeCopaRound && activeSuperligaRoundData) {
    for (const m of Object.values(activeCopaRound.matches || {})) {
      const p1 = calculateLiveRoundPoints(m.player1Id, activeSuperligaRoundData, overrideFinals);
      const p2 = calculateLiveRoundPoints(m.player2Id, activeSuperligaRoundData, overrideFinals);
      results[m.player1Id + '|' + m.player2Id] = [p1,p2];
      apply(table, m, p1, p2);
    }
  }
  for (const m of remainingFuture) {
    const r = Math.random();
    const sc = r < 1/3 ? [1,0] : r < 2/3 ? [0,1] : [1,1];
    results[m.player1Id + '|' + m.player2Id] = sc;
    apply(table, m, sc[0], sc[1]);
  }
  for (const [gk,ids] of groupEntries) {
    const sorted = sortGroup(ids, table, results);
    sorted.forEach((p,idx)=>{ if (idx<2) counts[gk][p.playerId].top2++; else if (idx===2) counts[gk][p.playerId].b++; else counts[gk][p.playerId].c++; });
  }
}
console.log('Tabela ao vivo da Round 10');
for (const [gk,ids] of groupEntries) {
  const now = sortGroup(ids, liveStandings, lockedResults);
  console.log('\n'+groupLabels[gk]);
  console.log('Atual live: '+now.map((p,i)=>`${i+1}. ${name(p.playerId)} (${p.points} pts, SG ${(p.goalsFor||0)-(p.goalsAg||0)})`).join(' | '));
  for (const p of now) {
    const c=counts[gk][p.playerId];
    console.log(`${name(p.playerId)} :: Mata-mata ${(100*c.top2/N).toFixed(1)}% | Serie B ${(100*c.b/N).toFixed(1)}% | Serie C ${(100*c.c/N).toFixed(1)}%`);
  }
}
console.log('\nJogos restantes na rodada ativa da Superliga: '+unresolvedFixtures.length);
for (const f of unresolvedFixtures) console.log(`- ${f.homeTeam} x ${f.awayTeam} (${f.liveStatus||'NS'})`);
