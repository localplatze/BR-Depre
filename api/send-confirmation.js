import { db, sendEmail } from './_shared.js';

export default async function handler(req, res) {
  // Configurar CORS se necessário, Vercel já permite rotas da mesma origem por padrão
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  const { userId, email, name, roundKey } = req.body;

  if (!userId || !email || !roundKey) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes (userId, email, roundKey).' });
  }

  try {
    // Buscar rodada, times e dados do usuário
    const [roundSnap, teamsSnap] = await Promise.all([
      db.ref(`rounds/${roundKey}`).once('value'),
      db.ref('teams').once('value')
    ]);

    if (!roundSnap.exists()) {
      return res.status(404).json({ error: 'Rodada não encontrada.' });
    }

    const roundData = roundSnap.val();
    const teams = teamsSnap.val() || {};
    const matches = roundData.matches || [];

    let matchesHtml = '';
    let count = 0;

    matches.forEach((match) => {
      const pred = match.predictions?.[userId];
      if (pred && pred.homeScore !== undefined && pred.awayScore !== undefined) {
        const homeTeamName = teams[match.homeTeam]?.name || match.homeTeam;
        const awayTeamName = teams[match.awayTeam]?.name || match.awayTeam;
        
        matchesHtml += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 8px; text-align: right; font-weight: 600; width: 40%; font-size: 14px; color: #1e293b;">
              ${homeTeamName}
            </td>
            <td style="padding: 12px 8px; text-align: center; width: 20%;">
              <span style="background-color: #3b82f6; color: white; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; display: inline-block; min-width: 40px;">
                ${pred.homeScore} x ${pred.awayScore}
              </span>
            </td>
            <td style="padding: 12px 8px; text-align: left; font-weight: 600; width: 40%; font-size: 14px; color: #1e293b;">
              ${awayTeamName}
            </td>
          </tr>
        `;
        count++;
      }
    });

    if (count === 0) {
      return res.status(400).json({ error: 'Nenhum palpite encontrado para este usuário nesta rodada.' });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Palpites Confirmados</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Palpites Confirmados!</h1>
            <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Olá, <strong>${name || 'Jogador'}</strong>! Seus palpites foram salvos com sucesso no sistema.</p>
          </div>
          <div style="padding: 24px;">
            <p style="margin-top: 0; margin-bottom: 20px; font-size: 14px; color: #64748b; text-align: center;">
              Abaixo estão os palpites que você registrou para esta rodada:
            </p>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                ${matchesHtml}
              </tbody>
            </table>
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">Você receberá um novo e-mail com os palpites de todos os jogadores assim que a rodada iniciar.</p>
            <p style="margin: 6px 0 0; font-weight: 600; color: #64748b;">BR Depressão</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: `BR Depressão - Palpites Confirmados - ${name || ''}`,
      html: emailHtml
    });

    return res.status(200).json({ success: true, message: 'E-mail de confirmação enviado.' });
  } catch (error) {
    console.error('Erro no send-confirmation:', error);
    return res.status(500).json({ error: 'Erro interno ao processar e enviar e-mail.', details: error.message });
  }
}
