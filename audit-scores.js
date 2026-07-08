import fs from 'node:fs';
const BASE_URL = 'https://brdepre-default-rtdb.firebaseio.com';

async function fetchJson(path) {
  const localPath = `audit-${path}.json`;
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  const response = await fetch(`${BASE_URL}/${path}.json`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function isNumber(value) {
  return Number.isFinite(Number(value));
}

function toScore(value) {
  return Number(value);
}

function calculateMatchPoints(finalResult, prediction) {
  if (!finalResult || !prediction) return 0;
  if (!isNumber(finalResult.homeScore) || !isNumber(finalResult.awayScore)) return 0;
  if (!isNumber(prediction.homeScore) || !isNumber(prediction.awayScore)) return 0;

  const finalHome = toScore(finalResult.homeScore);
  const finalAway = toScore(finalResult.awayScore);
  const predHome = toScore(prediction.homeScore);
  const predAway = toScore(prediction.awayScore);

  if (finalHome === predHome && finalAway === predAway) return 3;

  const finalWinner = Math.sign(finalHome - finalAway);
  const predWinner = Math.sign(predHome - predAway);
  if (finalWinner === predWinner) return 1;

  if (finalHome === predAway && finalAway === predHome) return -1;
  return 0;
}

function getMatchesArray(matches) {
  if (!matches) return [];
  return Array.isArray(matches) ? matches.filter(Boolean) : Object.values(matches).filter(Boolean);
}

function getStage(tournaments = []) {
  const joined = tournaments.join(' ').toLowerCase();
  if (joined.includes('clausura')) return 'Clausura';
  return 'Abertura';
}

function isSuperligaRound(round) {
  return Array.isArray(round.tournaments) &&
    round.tournaments.some((item) => String(item).toLowerCase().includes('superliga'));
}

function roundSortValue(round) {
  return round.finishTimestamp || round.createdAt || '';
}

function userName(users, userId) {
  const user = users[userId] || {};
  return user.name || user.displayName || user.email || userId;
}

function addScore(target, userId, points) {
  target[userId] = (target[userId] || 0) + points;
}

function ensureRoundBreakdown(target, userId, roundKey, roundLabel) {
  target[userId] ||= [];
  let item = target[userId].find((entry) => entry.roundKey === roundKey);
  if (!item) {
    item = { roundKey, roundLabel, points: 0, exact: 0, winner: 0, inverted: 0, zero: 0, picks: 0, finals: 0 };
    target[userId].push(item);
  }
  return item;
}

function getSavedPoints(user, stage) {
  const direct = Number(user[`pointsSuperliga${stage}`]);
  return Number.isFinite(direct) ? direct : 0;
}

async function main() {
  const [rounds, users] = await Promise.all([fetchJson('rounds'), fetchJson('users')]);
  const allUsers = users || {};
  const totals = {
    allWithFinals: {},
    finalizedOnly: {},
    superligaAbertura: {},
    superligaClausura: {}
  };
  const breakdown = {};
  const roundSummaries = [];

  const entries = Object.entries(rounds || {}).sort(([, a], [, b]) =>
    String(roundSortValue(a)).localeCompare(String(roundSortValue(b)))
  );

  entries.forEach(([roundKey, round], index) => {
    const matches = getMatchesArray(round.matches);
    const stage = getStage(round.tournaments || []);
    const isSuperliga = isSuperligaRound(round);
    let finalMatches = 0;
    let predictions = 0;

    matches.forEach((match) => {
      if (!match.finalResult || !isNumber(match.finalResult.homeScore) || !isNumber(match.finalResult.awayScore)) return;
      finalMatches += 1;
      Object.entries(match.predictions || {}).forEach(([userId, prediction]) => {
        const points = calculateMatchPoints(match.finalResult, prediction);
        predictions += 1;
        addScore(totals.allWithFinals, userId, points);
        if (round.status === 2) addScore(totals.finalizedOnly, userId, points);
        if (isSuperliga) {
          const target = stage === 'Clausura' ? totals.superligaClausura : totals.superligaAbertura;
          addScore(target, userId, points);
          const item = ensureRoundBreakdown(breakdown, userId, roundKey, `R${index + 1}`);
          item.points += points;
          item.picks += 1;
          item.finals = finalMatches;
          if (points === 3) item.exact += 1;
          else if (points === 1) item.winner += 1;
          else if (points === -1) item.inverted += 1;
          else item.zero += 1;
        }
      });
    });

    roundSummaries.push({
      n: index + 1,
      key: roundKey,
      status: round.status,
      finish: round.finishTimestamp || '',
      tournaments: (round.tournaments || []).join(', '),
      matches: matches.length,
      finalMatches,
      predictions
    });
  });

  const ranking = Object.entries(totals.superligaAbertura)
    .map(([userId, points]) => ({
      userId,
      name: userName(allUsers, userId),
      calculated: points,
      saved: getSavedPoints(allUsers[userId] || {}, 'Abertura'),
      diff: points - getSavedPoints(allUsers[userId] || {}, 'Abertura')
    }))
    .sort((a, b) => b.calculated - a.calculated || a.name.localeCompare(b.name));

  const diffRanking = ranking.filter((row) => row.diff !== 0);
  const currentUserIds = Object.entries(allUsers)
    .filter(([, user]) => user.pointsSuperligaAbertura !== undefined)
    .map(([userId]) => userId);
  const missingFromRound10 = [];

  roundSummaries
    .filter((round) => round.n >= 10 && round.status === 2 && round.finalMatches > 0)
    .forEach((summary) => {
      const round = rounds[summary.key];
      const matches = getMatchesArray(round.matches).filter((match) =>
        match.finalResult && isNumber(match.finalResult.homeScore) && isNumber(match.finalResult.awayScore)
      );
      currentUserIds.forEach((userId) => {
        const picks = matches.reduce((total, match) => total + (match.predictions?.[userId] ? 1 : 0), 0);
        if (picks < matches.length) {
          missingFromRound10.push({
            round: summary.n,
            roundKey: summary.key,
            userId,
            name: userName(allUsers, userId),
            picks,
            expected: matches.length,
            missing: matches.length - picks
          });
        }
      });
    });

  console.log('\n=== Rodadas em /rounds ===');
  roundSummaries.forEach((r) => {
    console.log(`${String(r.n).padStart(2, '0')} | status=${r.status} | jogos=${r.matches}/${r.finalMatches} com resultado | palpites=${r.predictions} | ${r.finish} | ${r.tournaments} | ${r.key}`);
  });

  console.log('\n=== Ranking calculado Superliga Abertura, direto de /rounds ===');
  ranking.slice(0, 20).forEach((row, i) => {
    console.log(`${String(i + 1).padStart(2, '0')}. ${row.name}: ${row.calculated} pts | salvo=${row.saved} | diff=${row.diff >= 0 ? '+' : ''}${row.diff}`);
  });

  console.log('\n=== Divergencias contra /users/pointsSuperligaAbertura ===');
  if (!diffRanking.length) {
    console.log('Nenhuma divergencia encontrada.');
  } else {
    diffRanking.forEach((row) => {
      console.log(`${row.name} (${row.userId}): calculado=${row.calculated}, salvo=${row.saved}, diff=${row.diff >= 0 ? '+' : ''}${row.diff}`);
    });
  }

  console.log('\n=== Palpites faltando por jogador atual, rodadas finalizadas R10+ ===');
  if (!missingFromRound10.length) {
    console.log('Nenhum palpite faltando nas rodadas R10+.');
  } else {
    const grouped = new Map();
    missingFromRound10.forEach((item) => {
      const key = `${item.name} (${item.userId})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(`R${item.round}: ${item.picks}/${item.expected} (-${item.missing})`);
    });
    [...grouped.entries()].forEach(([player, items]) => {
      console.log(`${player}: ${items.join('; ')}`);
    });
  }

  const leader = ranking[0];
  if (leader) {
    console.log(`\n=== Quebra do lider calculado: ${leader.name} ===`);
    (breakdown[leader.userId] || []).forEach((item) => {
      console.log(`${item.roundLabel} ${item.roundKey}: ${item.points} pts | exatos=${item.exact}, vencedor/empate=${item.winner}, invertidos=${item.inverted}, zeros=${item.zero}, palpites=${item.picks}`);
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    roundSummaries,
    rankingSuperligaAbertura: ranking,
    divergencesSuperligaAbertura: diffRanking,
    missingFromRound10,
    totals
  };
  console.log('\nJSON_SUMMARY=' + JSON.stringify(payload));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
