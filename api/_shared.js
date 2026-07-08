import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

// 1. Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    // Substituir novas linhas se necessário devido ao escape de strings nas variáveis do Vercel
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

export const db = admin.database();

// 2. Transmissor de E-mail (SMTP Gmail)
export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  connectionTimeout: 4000,
  greetingTimeout: 4000,
  socketTimeout: 6000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper de envio
export async function sendEmail({ to, bcc, subject, html }) {
  if (process.env.NODE_ENV === 'test') {
    console.log('\n==================================================');
    console.log(`[TESTE] MOCK_SEND_EMAIL:`);
    console.log(`Para: ${to || 'Ninguém'}`);
    console.log(`Bcc: ${bcc || 'Ninguém'}`);
    console.log(`Assunto: ${subject}`);
    console.log('==================================================');
    try {
      const fs = await import('fs');
      const filename = `test_email_${subject.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      fs.writeFileSync(filename, html, 'utf8');
      console.log(`[TESTE] HTML do e-mail salvo localmente em: ${filename}`);
    } catch (e) {
      console.error('Erro ao salvar e-mail localmente:', e);
    }
    console.log('==================================================\n');
    return { messageId: 'mock-id' };
  }

  const mailOptions = {
    from: `"BR Depressão" <${process.env.EMAIL_USER}>`,
    to,
    bcc,
    subject,
    html
  };
  return transporter.sendMail(mailOptions);
}

// 3. Regras de pontuação oficiais (regras do palpites.html)
export function calculateMatchPoints(final, pred) {
  if (!final || final.homeScore === undefined || final.homeScore === null ||
      !pred || pred.homeScore === undefined || pred.homeScore === null) {
    return null;
  }
  
  const fHome = parseInt(final.homeScore, 10);
  const fAway = parseInt(final.awayScore, 10);
  const pHome = parseInt(pred.homeScore, 10);
  const pAway = parseInt(pred.awayScore, 10);
  
  if (fHome === pHome && fAway === pAway) return 3;
  
  const finalWinner = Math.sign(fHome - fAway);
  const predWinner = Math.sign(pHome - pAway);
  if (finalWinner === predWinner) return 1;
  
  if (fHome === pAway && fAway === pHome) return -1;
  
  return 0;
}

// Helper para converter datas do formato do banco para timestamp
export function getManausTimestamp(dateString, roundFinishTimestamp) {
  const dateStr = dateString || roundFinishTimestamp;
  if (!dateStr) return 0;
  if (typeof dateStr === 'number') return dateStr;
  if (dateStr.includes('Z') || dateStr.match(/[+-]\d\d:\d\d$/)) {
    return new Date(dateStr).getTime();
  }
  // Aplica o fuso de Manaus (GMT-4) caso não esteja explícito
  return new Date(dateStr + '-04:00').getTime();
}
