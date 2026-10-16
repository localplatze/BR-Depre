const ESPN_SOCCER_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const LEAGUE_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const ID_PATTERN = /^\d{1,20}$/;

function getSingleQueryValue(value) {
  return Array.isArray(value) ? null : value;
}

function createUpstreamUrl(query) {
  const resource = getSingleQueryValue(query.resource);
  const league = getSingleQueryValue(query.league);

  if (typeof league !== 'string' || !LEAGUE_CODE_PATTERN.test(league)) {
    return { error: 'Código da liga inválido.' };
  }

  const encodedLeague = encodeURIComponent(league);

  if (resource === 'team') {
    const teamId = getSingleQueryValue(query.teamId);
    if (typeof teamId !== 'string' || !ID_PATTERN.test(teamId)) {
      return { error: 'ID do time inválido.' };
    }

    const url = new URL(`${ESPN_SOCCER_API}/${encodedLeague}/teams/${teamId}`);
    url.searchParams.set('enable', 'roster');
    return { url, cacheSeconds: 600 };
  }

  if (resource === 'scoreboard') {
    const dates = getSingleQueryValue(query.dates);
    const limit = getSingleQueryValue(query.limit) || '200';
    if (typeof dates !== 'string' || !/^\d{8}(?:-\d{8})?$/.test(dates)) {
      return { error: 'Data inválida para consultar os jogos.' };
    }
    if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 200) {
      return { error: 'Limite de jogos inválido.' };
    }

    const url = new URL(`${ESPN_SOCCER_API}/${encodedLeague}/scoreboard`);
    url.searchParams.set('dates', dates);
    url.searchParams.set('limit', limit);
    return { url, cacheSeconds: 15 };
  }

  if (resource === 'summary') {
    const eventId = getSingleQueryValue(query.event);
    if (typeof eventId !== 'string' || !ID_PATTERN.test(eventId)) {
      return { error: 'ID da partida inválido.' };
    }

    const url = new URL(`${ESPN_SOCCER_API}/${encodedLeague}/summary`);
    url.searchParams.set('event', eventId);
    return { url, cacheSeconds: 15 };
  }

  return { error: 'Tipo de consulta ESPN inválido.' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido. Utilize GET.' });
  }

  const request = createUpstreamUrl(req.query || {});
  if (request.error) {
    return res.status(400).json({ error: request.error });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(request.url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    const responseText = await upstream.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      console.error(`ESPN retornou conteúdo não JSON (HTTP ${upstream.status}).`);
      return res.status(502).json({ error: 'A ESPN retornou uma resposta inválida.' });
    }

    res.setHeader('Cache-Control', `public, s-maxage=${request.cacheSeconds}, stale-while-revalidate=30`);
    return res.status(upstream.status).json(payload);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('Falha na consulta server-side à ESPN:', error);
    return res.status(502).json({
      error: timedOut ? 'A ESPN demorou para responder.' : 'Não foi possível consultar a ESPN.'
    });
  } finally {
    clearTimeout(timeout);
  }
}
