import { sendEmail, calculateMatchPoints, getManausTimestamp } from './_shared.js';

export const config = {
  maxDuration: 30
};

function withTimeout(promise, label, ms = 7000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout em ${label} apos ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getDatabaseUrl() {
  return (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
}

function getAppUrl() {
  return (process.env.APP_URL || 'https://brdadepre.vercel.app').replace(/\/$/, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMatchesArray(matches) {
  if (!matches) return [];
  return Array.isArray(matches) ? matches.filter(Boolean) : Object.values(matches).filter(Boolean);
}

function isStarPrediction(prediction) {
  return Boolean(prediction?.isStarMatch || prediction?.isCaptain || prediction?.star || prediction?.doublePoints);
}

function getUserDisplayName(user) {
  return user?.name || user?.email || 'Jogador';
}

function getTeamDisplayName(allTeams, teamId, fallback = 'Time') {
  return allTeams?.[teamId]?.name || fallback || teamId || 'Time';
}

function formatStageName(stageKey) {
  return {
    groups: 'Fase de Grupos',
    quarterFinals: 'Quartas de Final',
    semiFinals: 'Semifinais',
    final: 'Final'
  }[stageKey] || 'Supercopa';
}

function getSupercopaActiveStage(supercopaData = {}) {
  if (supercopaData.activeStage) return supercopaData.activeStage;
  if (supercopaData.final?.status === 1) return 'final';
  if (supercopaData.semiFinals?.status === 1) return 'semiFinals';
  if (supercopaData.quarterFinals?.status === 1) return 'quarterFinals';
  if (supercopaData.groups?.status === 1) return 'groups';
  return 'groups';
}

function buildStarPlayersHtml(roundData, participants) {
  const starPlayers = roundData?.starPlayers || {};
  const rows = participants.map((participant) => {
    const selection = starPlayers[participant.uid];
    const athleteName = selection?.athleteName || 'Não escolheu';
    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 9px 12px; color: #334155; font-weight: 600;">${escapeHtml(getUserDisplayName(participant))}</td>
        <td style="padding: 9px 12px; color: #0f172a; text-align: right;">${escapeHtml(athleteName)}</td>
      </tr>
    `;
  }).join('');

  return `
    <h2 style="margin: 30px 0 14px; font-size: 16px; color: #0f172a; border-bottom: 2px solid #f59e0b; padding-bottom: 6px; font-weight: 700;">
      🎯 Artilheiros Escolhidos
    </h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fffef7;">
      <thead style="background: #fef3c7;">
        <tr>
          <th style="padding: 10px 12px; text-align: left; color: #92400e; font-weight: 700;">Jogador</th>
          <th style="padding: 10px 12px; text-align: right; color: #92400e; font-weight: 700;">Artilheiro</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildMatchPredictionsHtml(matches, participants, allTeams, mode = 'start') {
  return matches.map((match, matchIdx) => {
    const homeTeamName = getTeamDisplayName(allTeams, match.homeTeam, match.homeTeam);
    const awayTeamName = getTeamDisplayName(allTeams, match.awayTeam, match.awayTeam);
    const matchPredictions = match.predictions || {};
    const hasStarRow = participants.some((participant) => isStarPrediction(matchPredictions[participant.uid]));

    const rows = participants.map((participant) => {
      const prediction = matchPredictions[participant.uid];
      const star = isStarPrediction(prediction);
      let pointsHtml = '';

      if (mode === 'end') {
        const pts = calculateMatchPoints(match.finalResult, prediction);
        let badgeBg = '#94a3b8';
        let badgeColor = '#ffffff';
        let pointsText = '0 pts';
        if (pts === 3) {
          badgeBg = '#10b981';
          pointsText = '+3 pts';
        } else if (pts === 1) {
          badgeBg = '#f59e0b';
          badgeColor = '#111827';
          pointsText = '+1 pt';
        } else if (pts === -1) {
          badgeBg = '#ef4444';
          pointsText = '-1 pt';
        }

        pointsHtml = `
          <td style="padding: 9px 12px; text-align: right;">
            <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 11px; display: inline-block;">
              ${pointsText}
            </span>
          </td>
        `;
      }

      const predictionText = prediction && prediction.homeScore !== undefined
        ? `${prediction.homeScore} x ${prediction.awayScore}${star ? ' ⭐' : ''}`
        : 'Não palpitou';

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; ${star ? 'background: linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(255,255,255,0));' : ''}">
          <td style="padding: 9px 12px; text-align: left; color: #334155; font-weight: 600;">${escapeHtml(getUserDisplayName(participant))}</td>
          <td style="padding: 9px 12px; text-align: center; color: ${star ? '#92400e' : '#1e3a8a'}; font-weight: ${star ? '800' : '700'};">
            ${escapeHtml(predictionText)}
          </td>
          ${pointsHtml}
        </tr>
      `;
    }).join('');

    const headerTone = hasStarRow ? 'background: linear-gradient(90deg, #fef3c7, #f8fafc); color: #92400e;' : 'background: #f1f5f9; color: #1e293b;';
    const scorePill = mode === 'end'
      ? `<span style="background: #2563eb; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; margin-left: 10px; color: white;">FIM: ${match.finalResult.homeScore} x ${match.finalResult.awayScore}</span>`
      : '';

    return `
      <div style="background: #ffffff; border: 1px solid ${hasStarRow ? '#f59e0b' : '#e2e8f0'}; border-radius: 10px; margin-bottom: 18px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="${headerTone} padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <span>${escapeHtml(homeTeamName)} vs ${escapeHtml(awayTeamName)}</span>
          ${scorePill}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join('');
}

function buildSupercopaSummaryHtml(supercopaData, allUsers) {
  if (!supercopaData || Object.keys(supercopaData).length === 0) {
    return '<p style="margin: 0; color: #64748b;">Supercopa ainda não configurada.</p>';
  }

  const activeStage = getSupercopaActiveStage(supercopaData);
  if (activeStage === 'groups') {
    const activeRound = Object.entries(supercopaData.groups?.rounds || {})
      .map(([roundId, round]) => ({ roundId, ...round }))
      .find((round) => round.status === 1) || null;

    const groupMatches = getMatchesArray(activeRound?.matches).map((match) => {
      const p1 = allUsers[match.homeTeam || match.player1Id]?.name || 'A definir';
      const p2 = allUsers[match.awayTeam || match.player2Id]?.name || 'A definir';
      const score = match.result || 'Aguardando';
      return `<li style="margin-bottom: 4px;"><strong>${escapeHtml(p1)}</strong> vs <strong>${escapeHtml(p2)}</strong> <span style="color:#64748b;">(${escapeHtml(score)})</span></li>`;
    }).join('');

    return `
      <p style="margin: 0 0 8px; color: #334155;"><strong>${formatStageName(activeStage)}</strong> em andamento.</p>
      ${groupMatches ? `<ul style="margin: 0; padding-left: 18px; color: #475569;">${groupMatches}</ul>` : '<p style="margin: 0; color: #64748b;">Nenhum confronto ativo encontrado nos grupos.</p>'}
    `;
  }

  const phaseData = supercopaData[activeStage] || {};
  const phaseLabels = [
    { key: 'matches', label: 'Série A' },
    { key: 'b', label: 'Série B' },
    { key: 'c', label: 'Série C' }
  ];

  const blocks = phaseLabels.map(({ key, label }) => {
    const matches = getMatchesArray(phaseData[key]);
    if (!matches.length) return '';
    const items = matches.map((match) => {
      const p1 = allUsers[match.homeTeam || match.player1Id]?.name || 'A definir';
      const p2 = allUsers[match.awayTeam || match.player2Id]?.name || 'A definir';
      const score = match.result || match.manualResult || 'Aguardando';
      return `<li style="margin-bottom: 4px;"><strong>${escapeHtml(p1)}</strong> vs <strong>${escapeHtml(p2)}</strong> <span style="color:#64748b;">(${escapeHtml(score)})</span></li>`;
    }).join('');
    return `<div style="margin-top: 10px;"><strong style="color:#0f172a;">${label}</strong><ul style="margin: 6px 0 0; padding-left: 18px; color:#475569;">${items}</ul></div>`;
  }).join('');

  return `
    <p style="margin: 0 0 8px; color: #334155;"><strong>${formatStageName(activeStage)}</strong> em andamento.</p>
    ${blocks || '<p style="margin: 0; color: #64748b;">Nenhum confronto ativo encontrado.</p>'}
  `;
}

function buildRestaUmSummaryHtml(restaUmData, allUsers) {
  const participants = restaUmData?.participants || [];
  const eliminations = Object.values(restaUmData?.eliminations || {});
  const eliminatedSet = new Set(eliminations.map((item) => item.eliminatedUserId).filter(Boolean));
  const survivors = participants.filter((uid) => !eliminatedSet.has(uid));
  const lastElimination = eliminations.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
  const lastEliminatedName = lastElimination?.eliminatedUserId ? (allUsers[lastElimination.eliminatedUserId]?.name || lastElimination.eliminatedUserId) : 'Ninguém na última rodada';

  return `
    <p style="margin: 0 0 6px; color: #334155;">Sobreviventes: <strong>${survivors.length}</strong> de <strong>${participants.length || Object.keys(allUsers).length}</strong>.</p>
    <p style="margin: 0; color: #64748b;">Último eliminado: <strong>${escapeHtml(lastEliminatedName)}</strong>.</p>
  `;
}

function buildCinturaoSummaryHtml(cinturaoData, allUsers) {
  const championName = allUsers[cinturaoData?.championId]?.name || 'Ninguém';
  const challengerName = allUsers[cinturaoData?.challengerId]?.name || 'A definir';
  const currentMatch = cinturaoData?.currentMatch || {};
  const scoreText = currentMatch.champScore !== undefined && currentMatch.challengerScore !== undefined
    ? `${currentMatch.champScore} x ${currentMatch.challengerScore}`
    : 'Aguardando confronto';

  return `
    <p style="margin: 0 0 6px; color: #334155;">Campeão: <strong>${escapeHtml(championName)}</strong> (${Number(cinturaoData?.defenses || 0)} defesa(s)).</p>
    <p style="margin: 0 0 6px; color: #334155;">Desafiante atual: <strong>${escapeHtml(challengerName)}</strong>.</p>
    <p style="margin: 0; color: #64748b;">Placar do duelo: <strong>${escapeHtml(scoreText)}</strong>.</p>
  `;
}

function buildFormulaDepreSummaryHtml(formulaData, allUsers) {
  const standings = Array.isArray(formulaData?.standings) ? formulaData.standings : [];
  if (!standings.length) {
    return '<p style="margin: 0; color: #64748b;">Fórmula Deprê ainda não calculada.</p>';
  }

  const topThree = standings.slice(0, 3).map((entry, index) => {
    const userName = allUsers[entry.userId]?.name || entry.userId || `Piloto ${index + 1}`;
    return `<li style="margin-bottom: 4px;"><strong>${index + 1}º ${escapeHtml(userName)}</strong> - ${Number(entry.points || 0)} pts</li>`;
  }).join('');

  return `
    <p style="margin: 0 0 8px; color: #334155;">Recorte atual: <strong>${escapeHtml(formulaData.stageFilterLabel || formulaData.stageFilter || 'Temporada')}</strong>.</p>
    <ul style="margin: 0; padding-left: 18px; color: #475569;">${topThree}</ul>
  `;
}

function buildTournamentContextHtml({ supercopaData, restaUmData, cinturaoData, formulaData, allUsers }) {
  return `
    <h2 style="margin: 30px 0 14px; font-size: 16px; color: #0f172a; border-bottom: 2px solid #0ea5e9; padding-bottom: 6px; font-weight: 700;">
      🧭 Panorama Paralelo da Rodada
    </h2>
    <div style="display: grid; gap: 12px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
        <div style="font-weight: 800; color: #0f172a; margin-bottom: 8px;">🏆 Supercopa</div>
        ${buildSupercopaSummaryHtml(supercopaData, allUsers)}
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
        <div style="font-weight: 800; color: #0f172a; margin-bottom: 8px;">💀 Resta Um</div>
        ${buildRestaUmSummaryHtml(restaUmData, allUsers)}
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
        <div style="font-weight: 800; color: #0f172a; margin-bottom: 8px;">🥊 Cinturão</div>
        ${buildCinturaoSummaryHtml(cinturaoData, allUsers)}
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
        <div style="font-weight: 800; color: #0f172a; margin-bottom: 8px;">🏎️ Fórmula Deprê</div>
        ${buildFormulaDepreSummaryHtml(formulaData, allUsers)}
      </div>
    </div>
  `;
}

async function firebaseRestGet(path, query = '', label = path) {
  const baseUrl = getDatabaseUrl();
  if (!baseUrl) throw new Error('FIREBASE_DATABASE_URL nao configurado.');
  const suffix = query ? `?${query}` : '';
  const response = await withTimeout(fetch(`${baseUrl}/${path}.json${suffix}`), label);
  if (!response.ok) {
    throw new Error(`${label}: Firebase REST HTTP ${response.status}`);
  }
  return response.json();
}

async function firebaseRestSet(path, value, label = path) {
  const baseUrl = getDatabaseUrl();
  if (!baseUrl) throw new Error('FIREBASE_DATABASE_URL nao configurado.');
  const response = await withTimeout(fetch(`${baseUrl}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  }), label);
  if (!response.ok) {
    throw new Error(`${label}: Firebase REST HTTP ${response.status}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  // 1. Validar autenticação do Cron
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    const { key } = req.query;
    if (key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
  }

  if (req.query.ping === '1') {
    return res.status(200).json({
      success: true,
      mode: 'ping',
      env: {
        firebaseDatabaseUrl: Boolean(process.env.FIREBASE_DATABASE_URL),
        firebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
        emailUser: Boolean(process.env.EMAIL_USER),
        emailPass: Boolean(process.env.EMAIL_PASS),
        cronSecret: Boolean(process.env.CRON_SECRET)
      },
      now: new Date().toISOString()
    });
  }

  const dryRun = req.query.dryRun === '1';

  try {
    const diagnostics = [];
    const appUrl = getAppUrl();

    // 2. Carregar primeiro apenas rodadas ativas (status = 1)
    const rounds = await firebaseRestGet(
      'rounds',
      'orderBy=%22status%22&equalTo=1',
      'consulta de rodadas ativas'
    );
    if (!rounds || !Object.keys(rounds).length) {
      return res.status(200).json({ success: true, dryRun, diagnostics, message: 'Nenhuma rodada ativa encontrada.' });
    }

    diagnostics.push(`Rodadas ativas encontradas: ${Object.keys(rounds).length}`);

    // 3. Carregar dados auxiliares somente quando houver rodada ativa
    const [teamsData, usersData, supercopaData, restaUmData, cinturaoData, formulaData] = await Promise.all([
      firebaseRestGet('teams', '', 'consulta de times'),
      firebaseRestGet('users', '', 'consulta de usuarios'),
      firebaseRestGet('tournaments/supercopa', '', 'consulta de supercopa'),
      firebaseRestGet('tournaments/restaUm', '', 'consulta de resta um'),
      firebaseRestGet('tournaments/cinturao', '', 'consulta de cinturao'),
      firebaseRestGet('tournaments/formulaDepre', '', 'consulta de formula depre')
    ]);

    const allTeams = teamsData || {};
    const allUsers = usersData || {};
    diagnostics.push(`Times carregados: ${Object.keys(allTeams).length}`);
    diagnostics.push(`Usuarios carregados: ${Object.keys(allUsers).length}`);

    const log = [];
    const now = Date.now();
    // 4. Processar cada rodada ativa
    for (const [roundKey, roundData] of Object.entries(rounds)) {
      const matches = roundData.matches || [];
      if (matches.length === 0) continue;

      // Determinar o início da rodada (menor timestamp das partidas ou data limite)
      let minTimestamp = null;
      matches.forEach(m => {
        const ts = getManausTimestamp(m.timestamp, roundData.finishTimestamp);
        if (minTimestamp === null || ts < minTimestamp) {
          minTimestamp = ts;
        }
      });
      const roundStartTime = minTimestamp || getManausTimestamp(roundData.finishTimestamp);

      const emailsConfig = roundData.emails || {};

      // Obter todos os usuários com e-mail cadastrado
      const allPlayersList = Object.entries(allUsers)
        .map(([uid, u]) => ({ uid, ...u }))
        .filter(p => p.email);
      const allEmails = allPlayersList.map(p => p.email);

      // Obter ID de todos que palpitaram nesta rodada
      const participantIds = new Set();
      matches.forEach(match => {
        if (match.predictions) {
          Object.keys(match.predictions).forEach(uid => {
            participantIds.add(uid);
          });
        }
      });

      // Mapear os e-mails dos participantes (quem palpitou pelo menos uma vez)
      const participants = Array.from(participantIds)
        .map(uid => ({ uid, ...allUsers[uid] }))
        .filter(p => p.email);
      const emailList = participants.map(p => p.email);

      // =========================================================================
      // CENÁRIO C: E-mail de Criação da Rodada (Assim que ela fica ativa/andamento)
      // =========================================================================
      const shouldSendCreated = !emailsConfig.createdSent;
      if (shouldSendCreated && allEmails.length > 0) {
        let matchesListHtml = '<ul style="padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8; margin: 0 0 20px;">';
        matches.forEach(match => {
          const homeTeamName = allTeams[match.homeTeam]?.name || match.homeTeam;
          const awayTeamName = allTeams[match.awayTeam]?.name || match.awayTeam;
          matchesListHtml += `<li style="margin-bottom: 6px;"><strong>${homeTeamName} vs ${awayTeamName}</strong></li>`;
        });
        matchesListHtml += '</ul>';

        const createdEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 700;">⚽ Palpites Abertos!</h1>
                <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Uma nova rodada está disponível. Venha registrar seus palpites!</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <p style="margin-top: 0; font-size: 15px; font-weight: 600; color: #0f172a;">Confrontos da Rodada:</p>
                ${matchesListHtml}
                <div style="text-align: center; margin: 30px 0 10px;">
                  <a href="${appUrl}/palpites.html" style="background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(59,130,246,0.2);">
                    Enviar Meus Palpites
                  </a>
                </div>
              </div>
              <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0;">BR Depressão - Notificações de Rodada</p>
              </div>
            </div>
          </body>
          </html>
        `;

        if (dryRun) {
          log.push(`[DRY RUN] Rodada ${roundKey}: enviaria e-mail de abertura para ${allEmails.length} usuários.`);
        } else {
          await sendEmail({
            to: process.env.EMAIL_USER,
            bcc: allEmails.join(','),
            subject: '⚽ BR Depressão - Nova Rodada Aberta para Palpites!',
            html: createdEmailHtml
          });

          if (process.env.NODE_ENV === 'test') {
            console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/createdSent = true`);
          } else {
            await firebaseRestSet(`rounds/${roundKey}/emails/createdSent`, true, 'gravacao createdSent');
          }
          log.push(`Rodada ${roundKey}: E-mail de abertura enviado para ${allEmails.length} usuários.`);
        }
      }

      // =========================================================================
      // CENÁRIO D: E-mail de Alerta (3 horas antes do início da rodada)
      // =========================================================================
      const warningTime = roundStartTime - 3 * 60 * 60 * 1000;
      const shouldSendWarning = now >= warningTime && now < roundStartTime && !emailsConfig.warningSent;

      if (shouldSendWarning && allEmails.length > 0) {
        // Mapear quem palpitou vs pendentes
        const playersStatus = allPlayersList.map(p => {
          let hasPredicted = false;
          matches.forEach(match => {
            if (match.predictions && match.predictions[p.uid]) {
              hasPredicted = true;
            }
          });
          return { name: p.name, hasPredicted };
        });

        // Ordenar colocando os pendentes primeiro (pressão amigável)
        playersStatus.sort((a, b) => (a.hasPredicted ? 1 : 0) - (b.hasPredicted ? 1 : 0));

        let statusRowsHtml = '';
        playersStatus.forEach(p => {
          const statusBadge = p.hasPredicted
            ? '<span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; display: inline-block;">Palpitou</span>'
            : '<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; display: inline-block;">Pendente</span>';

          statusRowsHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 12px; color: #334155; font-weight: 500;">${p.name}</td>
              <td style="padding: 10px 12px; text-align: right;">${statusBadge}</td>
            </tr>
          `;
        });

        const warningEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #d97706, #b45309); color: white; padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 700;">⚠️ Último Aviso: 3 Horas Restantes!</h1>
                <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">O prazo da rodada está terminando. Registre seus palpites para não ficar para trás!</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #475569; text-align: center;">
                  Painel de Envio da Rodada:
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                  <thead style="background-color: #f8fafc;">
                    <tr>
                      <th style="padding: 10px 12px; text-align: left; color: #475569; font-weight: 600;">Jogador</th>
                      <th style="padding: 10px 12px; text-align: right; color: #475569; font-weight: 600;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${statusRowsHtml}
                  </tbody>
                </table>
                <div style="text-align: center; margin: 30px 0 10px;">
                  <a href="${appUrl}/palpites.html" style="background-color: #d97706; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(217,119,6,0.2);">
                    Ir Palpitar
                  </a>
                </div>
              </div>
              <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0;">BR Depressão - Lembrete Automático</p>
              </div>
            </div>
          </body>
          </html>
        `;

        if (dryRun) {
          log.push(`[DRY RUN] Rodada ${roundKey}: enviaria e-mail de lembrete (3h) para ${allEmails.length} usuários.`);
        } else {
          await sendEmail({
            to: process.env.EMAIL_USER,
            bcc: allEmails.join(','),
            subject: '⚠️ BR Depressão - Prazo de Palpites se encerra em 3 horas!',
            html: warningEmailHtml
          });

          if (process.env.NODE_ENV === 'test') {
            console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/warningSent = true`);
          } else {
            await firebaseRestSet(`rounds/${roundKey}/emails/warningSent`, true, 'gravacao warningSent');
          }
          log.push(`Rodada ${roundKey}: E-mail de lembrete (3h) enviado para ${allEmails.length} usuários.`);
        }
      }

      // =========================================================================
      // CENÁRIO A: E-mail de Início de Rodada (Palpites de Todo Mundo)
      // =========================================================================
      const shouldSendStart = now >= roundStartTime && !emailsConfig.startSent;
      if (shouldSendStart) {
        if (emailList.length === 0) {
          log.push(`Rodada ${roundKey}: Nenhum palpite registrado, pulando e-mail de início.`);
        } else {
          const matchesListHtml = buildMatchPredictionsHtml(matches, participants, allTeams, 'start');
          const starPlayersHtml = buildStarPlayersHtml(roundData, participants);
          const contextHtml = buildTournamentContextHtml({
            supercopaData,
            restaUmData,
            cinturaoData,
            formulaData,
            allUsers
          });

          const startEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Palpites da Rodada Iniciados!</h1>
                  <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Confira o que cada jogador palpitou nesta rodada.</p>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                  <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; font-weight: 700;">
                    📋 Jogos e Palpites Consolidados
                  </h2>
                  ${matchesListHtml}
                  ${starPlayersHtml}
                  ${contextHtml}
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                  <p style="margin: 0;">BR Depressão - Palpites Consolidados</p>
                </div>
              </div>
            </body>
            </html>
          `;

          if (dryRun) {
            log.push(`[DRY RUN] Rodada ${roundKey}: enviaria e-mail de início para ${emailList.length} usuários.`);
          } else {
            await sendEmail({
              to: process.env.EMAIL_USER,
              bcc: emailList.join(','),
              subject: 'BR Depressão - Palpites da Rodada Liberados!',
              html: startEmailHtml
            });

            if (process.env.NODE_ENV === 'test') {
              console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/startSent = true`);
            } else {
              await firebaseRestSet(`rounds/${roundKey}/emails/startSent`, true, 'gravacao startSent');
            }
            log.push(`Rodada ${roundKey}: E-mail de início enviado para ${emailList.length} usuários.`);
          }
        }
      }

      // =========================================================================
      // CENÁRIO B: E-mail de Fim de Rodada (Resultados e Classificação)
      // =========================================================================
      const hasFinalResult = (match) => {
        return match && match.finalResult &&
          match.finalResult.homeScore !== undefined && match.finalResult.homeScore !== null &&
          match.finalResult.awayScore !== undefined && match.finalResult.awayScore !== null;
      };

      const allMatchesFinished = matches.every(m => hasFinalResult(m));
      const shouldSendEnd = allMatchesFinished && !emailsConfig.endSent;

      if (shouldSendEnd) {
        if (emailList.length === 0) {
          log.push(`Rodada ${roundKey}: Nenhum palpite para avaliar, pulando e-mail de encerramento.`);
        } else {
          // Calcular pontuações de cada jogador
          const playersPerformance = participants.map(p => {
            let roundPoints = 0;
            const matchScores = matches.map((match, matchIdx) => {
              const pred = match.predictions?.[p.uid];
              const pts = calculateMatchPoints(match.finalResult, pred);
              if (pts !== null) {
                roundPoints += pts;
              }
              return {
                matchIdx,
                prediction: pred,
                points: pts
              };
            });

            return {
              uid: p.uid,
              name: p.name,
              totalPoints: roundPoints,
              scores: matchScores
            };
          });

          // Classificar ranking da rodada
          playersPerformance.sort((a, b) => b.totalPoints - a.totalPoints);

          // HTML da Tabela de Classificação
          let rankingRowsHtml = '';
          playersPerformance.forEach((p, index) => {
            let posColor = '#334155';
            if (index === 0) posColor = '#d97706';
            else if (index === 1) posColor = '#475569';
            
            rankingRowsHtml += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: 700; color: ${posColor}; width: 15%; text-align: center;">
                  ${index + 1}º
                </td>
                <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">
                  ${p.name}
                </td>
                <td style="padding: 10px 12px; font-weight: 700; color: #10b981; text-align: right; width: 25%;">
                  ${p.totalPoints} pts
                </td>
              </tr>
            `;
          });

          const resultsListHtml = buildMatchPredictionsHtml(matches, playersPerformance, allTeams, 'end');
          const starPlayersHtml = buildStarPlayersHtml(roundData, participants);
          const contextHtml = buildTournamentContextHtml({
            supercopaData,
            restaUmData,
            cinturaoData,
            formulaData,
            allUsers
          });

          const endEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Resultados da Rodada!</h1>
                  <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">A rodada acabou. Veja quem pontuou e a classificação final.</p>
                </div>
                
                <div style="background: white; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                  <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #0f172a; border-bottom: 2px solid #10b981; padding-bottom: 6px; font-weight: 700;">
                    🏆 Classificação da Rodada
                  </h2>
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 14px;">
                    <tbody>
                      ${rankingRowsHtml}
                    </tbody>
                  </table>

                  <h2 style="margin-bottom: 16px; font-size: 16px; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 6px; font-weight: 700;">
                    📊 Detalhe por Partida
                  </h2>
                  ${resultsListHtml}
                  ${starPlayersHtml}
                  ${contextHtml}
                </div>
                
                <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                  <p style="margin: 0; font-weight: 600; color: #64748b;">BR Depressão</p>
                </div>
              </div>
            </body>
            </html>
          `;

          if (dryRun) {
            log.push(`[DRY RUN] Rodada ${roundKey}: enviaria e-mail de finalização para ${emailList.length} usuários.`);
          } else {
            await sendEmail({
              to: process.env.EMAIL_USER,
              bcc: emailList.join(','),
              subject: 'BR Depressão - Resultados da Rodada Disponíveis!',
              html: endEmailHtml
            });

            if (process.env.NODE_ENV === 'test') {
              console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/endSent = true`);
            } else {
              await firebaseRestSet(`rounds/${roundKey}/emails/endSent`, true, 'gravacao endSent');
            }
            log.push(`Rodada ${roundKey}: E-mail de finalização enviado para ${emailList.length} usuários.`);
          }
        }
      }
    }

    return res.status(200).json({ success: true, dryRun, diagnostics, processed: log });
  } catch (error) {
    console.error('Erro no cron-check-round:', error);
    return res.status(500).json({ error: 'Erro interno na checagem da rodada.', details: error.message });
  }
}
