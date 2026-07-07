import fs from 'fs';
import path from 'path';

// 1. Carregar variáveis de ambiente do .env primeiro
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const equalIdx = trimmed.indexOf('=');
    if (equalIdx > 0) {
      const key = trimmed.substring(0, equalIdx).trim();
      const val = trimmed.substring(equalIdx + 1).trim();
      process.env[key] = val;
    }
  });
  console.log('Variáveis do .env carregadas com sucesso.');
} else {
  console.error('Arquivo .env não encontrado!');
  process.exit(1);
}

// Configurar ambiente de teste
process.env.NODE_ENV = 'test';

// 2. Executar o handler de Cron
async function run() {
  const cronHandler = (await import('./api/cron-check-round.js')).default;

  console.log('Iniciando teste do Cron (cron-check-round)...');
  const mockReq = {
    headers: {
      authorization: 'Bearer super_secret_cron_key'
    },
    query: {}
  };

  const mockRes = {
    status(code) {
      console.log('[TESTE] Status de Resposta:', code);
      return this;
    },
    json(data) {
      console.log('[TESTE] JSON de Resposta:', JSON.stringify(data, null, 2));
      return this;
    },
    end(msg) {
      console.log('[TESTE] Fim da Resposta:', msg);
      return this;
    }
  };

  try {
    await cronHandler(mockReq, mockRes);
    console.log('Teste concluído com sucesso.');
  } catch (err) {
    console.error('Erro durante o teste:', err);
  } finally {
    // Encerrar conexões do Firebase para permitir saída do processo Node
    const admin = (await import('firebase-admin')).default;
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app.delete()));
      console.log('Conexões do Firebase encerradas.');
    }
    process.exit(0);
  }
}

run();
