import { db, sendEmail, calculateMatchPoints, getManausTimestamp } from './_shared.js';

export const config = {
  maxDuration: 30
};

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
  try {
    // 2. Carregar dados auxiliares: times e usuários
    const [teamsSnap, usersSnap] = await Promise.all([
      db.ref('teams').once('value'),
      db.ref('users').once('value')
    ]);

    const allTeams = teamsSnap.val() || {};
    const allUsers = usersSnap.val() || {};

    // 3. Carregar rodadas ativas (status = 1)
    const roundsSnap = await db.ref('rounds').orderByChild('status').equalTo(1).once('value');
    if (!roundsSnap.exists()) {
      return res.status(200).json({ message: 'Nenhuma rodada ativa encontrada.' });
    }

    const rounds = roundsSnap.val();
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
                  <a href="https://brdepre.firebaseapp.com/palpites.html" style="background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(59,130,246,0.2);">
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

        await sendEmail({
          to: process.env.EMAIL_USER,
          bcc: allEmails.join(','),
          subject: '⚽ BR Depressão - Nova Rodada Aberta para Palpites!',
          html: createdEmailHtml
        });

        if (process.env.NODE_ENV === 'test') {
          console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/createdSent = true`);
        } else {
          await db.ref(`rounds/${roundKey}/emails/createdSent`).set(true);
        }
        log.push(`Rodada ${roundKey}: E-mail de abertura enviado para ${allEmails.length} usuários.`);
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
                  <a href="https://brdepre.firebaseapp.com/palpites.html" style="background-color: #d97706; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(217,119,6,0.2);">
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

        await sendEmail({
          to: process.env.EMAIL_USER,
          bcc: allEmails.join(','),
          subject: '⚠️ BR Depressão - Prazo de Palpites se encerra em 3 horas!',
          html: warningEmailHtml
        });

        if (process.env.NODE_ENV === 'test') {
          console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/warningSent = true`);
        } else {
          await db.ref(`rounds/${roundKey}/emails/warningSent`).set(true);
        }
        log.push(`Rodada ${roundKey}: E-mail de lembrete (3h) enviado para ${allEmails.length} usuários.`);
      }

      // =========================================================================
      // CENÁRIO A: E-mail de Início de Rodada (Palpites de Todo Mundo)
      // =========================================================================
      const shouldSendStart = now >= roundStartTime && !emailsConfig.startSent;
      if (shouldSendStart) {
        if (emailList.length === 0) {
          log.push(`Rodada ${roundKey}: Nenhum palpite registrado, pulando e-mail de início.`);
        } else {
          let matchesListHtml = '';

          matches.forEach((match, matchIdx) => {
            const homeTeamName = allTeams[match.homeTeam]?.name || match.homeTeam;
            const awayTeamName = allTeams[match.awayTeam]?.name || match.awayTeam;
            
            let predictionsRowsHtml = '';
            const matchPredictions = match.predictions || {};

            participants.forEach(p => {
              const pred = matchPredictions[p.uid];
              const predictionText = pred && pred.homeScore !== undefined 
                ? `${pred.homeScore} x ${pred.awayScore}`
                : '<span style="color: #94a3b8; font-style: italic;">Não palpitou</span>';

              predictionsRowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 12px; text-align: left; color: #334155; font-weight: 500;">
                    ${p.name}
                  </td>
                  <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #1e3a8a;">
                    ${predictionText}
                  </td>
                </tr>
              `;
            });

            matchesListHtml += `
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="background: #f1f5f9; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b; font-size: 15px;">
                  ${homeTeamName} vs ${awayTeamName}
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tbody>
                    ${predictionsRowsHtml}
                  </tbody>
                </table>
              </div>
            `;
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
                  ${matchesListHtml}
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                  <p style="margin: 0;">BR Depressão - Palpites Consolidados</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await sendEmail({
            to: process.env.EMAIL_USER,
            bcc: emailList.join(','),
            subject: 'BR Depressão - Palpites da Rodada Liberados!',
            html: startEmailHtml
          });

          if (process.env.NODE_ENV === 'test') {
            console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/startSent = true`);
          } else {
            await db.ref(`rounds/${roundKey}/emails/startSent`).set(true);
          }
          log.push(`Rodada ${roundKey}: E-mail de início enviado para ${emailList.length} usuários.`);
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

          // HTML dos Detalhes Jogo a Jogo
          let resultsListHtml = '';
          matches.forEach((match, matchIdx) => {
            const homeTeamName = allTeams[match.homeTeam]?.name || match.homeTeam;
            const awayTeamName = allTeams[match.awayTeam]?.name || match.awayTeam;
            const finalScoreText = `${match.finalResult.homeScore} x ${match.finalResult.awayScore}`;
            
            let predictionDetailsHtml = '';

            playersPerformance.forEach(p => {
              const scoreDetail = p.scores.find(s => s.matchIdx === matchIdx);
              const pred = scoreDetail?.prediction;
              const pts = scoreDetail?.points;

              let badgeBg = '#94a3b8';
              let badgeText = 'white';
              let pointsText = '0 pts';

              if (pts === 3) {
                badgeBg = '#10b981';
                pointsText = '+3 pts';
              } else if (pts === 1) {
                badgeBg = '#f59e0b';
                badgeText = '#000';
                pointsText = '+1 pt';
              } else if (pts === -1) {
                badgeBg = '#ef4444';
                pointsText = '-1 pt';
              }

              const predText = pred && pred.homeScore !== undefined
                ? `${pred.homeScore} x ${pred.awayScore}`
                : 'Não palpitou';

              predictionDetailsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 12px; text-align: left; color: #334155; font-weight: 500;">
                    ${p.name}
                  </td>
                  <td style="padding: 8px 12px; text-align: center; color: #64748b; font-size: 12px;">
                    ${predText}
                  </td>
                  <td style="padding: 8px 12px; text-align: right;">
                    <span style="background-color: ${badgeBg}; color: ${badgeText}; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; display: inline-block;">
                      ${pointsText}
                    </span>
                  </td>
                </tr>
              `;
            });

            resultsListHtml += `
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="background: #0f172a; color: white; padding: 12px 16px; font-weight: 700; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="margin-right: auto;">${homeTeamName} vs ${awayTeamName}</span>
                  <span style="background: #2563eb; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; float: right; margin-left: 10px;">
                    FIM: ${finalScoreText}
                  </span>
                  <div style="clear: both;"></div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tbody>
                    ${predictionDetailsHtml}
                  </tbody>
                </table>
              </div>
            `;
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
                </div>
                
                <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                  <p style="margin: 0; font-weight: 600; color: #64748b;">BR Depressão</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await sendEmail({
            to: process.env.EMAIL_USER,
            bcc: emailList.join(','),
            subject: 'BR Depressão - Resultados da Rodada Disponíveis!',
            html: endEmailHtml
          });

          if (process.env.NODE_ENV === 'test') {
            console.log(`[TESTE] Mock de escrita no banco: rounds/${roundKey}/emails/endSent = true`);
          } else {
            await db.ref(`rounds/${roundKey}/emails/endSent`).set(true);
          }
          log.push(`Rodada ${roundKey}: E-mail de finalização enviado para ${emailList.length} usuários.`);
        }
      }
    }

    return res.status(200).json({ success: true, processed: log });
  } catch (error) {
    console.error('Erro no cron-check-round:', error);
    return res.status(500).json({ error: 'Erro interno na checagem da rodada.', details: error.message });
  }
}
