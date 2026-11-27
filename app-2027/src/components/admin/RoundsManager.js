import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { get, onValue, push, ref, remove, set, update } from 'firebase/database';
import { database } from '../../services/firebaseDatabase';

const SEASON = '2027';
const ROUND_PATH = `seasons/${SEASON}/rounds`;
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const STATUS = [
  { id: 0, label: 'A Iniciar', icon: 'clock-outline' },
  { id: 1, label: 'Em Andamento', icon: 'play-circle-outline' },
  { id: 2, label: 'Concluída', icon: 'check-circle-outline' },
];
const LEAGUES = [
  { code: 'bra.1', label: 'Brasileirão Série A', short: 'Série A', filter: 'all' },
  { code: 'bra.2', label: 'Brasileirão Série B', short: 'Série B', filter: 'brazilBig' },
  { code: 'bra.copa_do_brazil', label: 'Copa do Brasil', short: 'Copa do Brasil', filter: 'copaBrasil' },
  { code: 'fifa.world', label: 'Copa do Mundo', short: 'Copa do Mundo', filter: 'all' },
  { code: 'fifa.cwc', label: 'Mundial de Clubes', short: 'Mundial de Clubes', filter: 'clubWorld' },
  { code: 'fifa.intercontinental', label: 'Copa Intercontinental', short: 'Intercontinental', filter: 'clubWorld' },
  { code: 'conmebol.america', label: 'Copa América', short: 'Copa América', filter: 'all' },
  { code: 'conmebol.libertadores', label: 'Libertadores', short: 'Libertadores', filter: 'southAmericaBig' },
  { code: 'conmebol.sudamericana', label: 'Sul-Americana', short: 'Sul-Americana', filter: 'southAmericaBig' },
  { code: 'uefa.champions', label: 'Champions League', short: 'Champions', filter: 'champions' },
  { code: 'eng.1', label: 'Premier League', short: 'Premier League', filter: 'europeClassic' },
  { code: 'eng.fa', label: 'FA Cup', short: 'FA Cup', filter: 'europeClassic' },
  { code: 'eng.league_cup', label: 'Copa da Liga Inglesa', short: 'Copa da Liga', filter: 'europeClassic' },
  { code: 'esp.1', label: 'La Liga', short: 'La Liga', filter: 'spainClassic' },
  { code: 'esp.copa_del_rey', label: 'Copa do Rei', short: 'Copa do Rei', filter: 'spainClassic' },
  { code: 'ita.1', label: 'Serie A Italiana', short: 'Serie A Italiana', filter: 'europeOther' },
  { code: 'ita.coppa_italia', label: 'Coppa Italia', short: 'Coppa Italia', filter: 'europeOther' },
  { code: 'ger.1', label: 'Bundesliga', short: 'Bundesliga', filter: 'europeOther' },
  { code: 'ger.dfb_pokal', label: 'DFB Pokal', short: 'DFB Pokal', filter: 'europeOther' },
  { code: 'fra.1', label: 'Ligue 1', short: 'Ligue 1', filter: 'europeOther' },
  { code: 'fra.coupe_de_france', label: 'Copa da França', short: 'Copa da França', filter: 'europeOther' },
  { code: 'por.1', label: 'Liga de Portugal', short: 'Liga de Portugal', filter: 'europeOther' },
];
const TOURNAMENTS = [
  { id: 'superliga', label: 'Superliga', defaultEnabled: true },
  { id: 'supercopa', label: 'Supercopa', defaultEnabled: false },
  { id: 'recopa', label: 'Recopa', defaultEnabled: false },
  { id: 'libertadores', label: 'Libertadores', defaultEnabled: false },
  { id: 'restaUm', label: 'Resta Um', defaultEnabled: true },
  { id: 'formulaDepre', label: 'Fórmula Deprê', defaultEnabled: true },
  { id: 'cinturao', label: 'Cinturão', defaultEnabled: true },
];
const BRAZIL_BIG_TEAMS = [
  'flamengo', 'fluminense', 'botafogo', 'vasco', 'corinthians', 'palmeiras', 'santos', 'saopaulo',
  'atleticomineiro', 'atleticomg', 'cruzeiro', 'gremio', 'internacional',
];
const BRAZIL_TEAMS = [...BRAZIL_BIG_TEAMS, 'bahia', 'fortaleza', 'ceara', 'sportrecife', 'vitoria', 'redbullbragantino', 'bragantino', 'athleticoparanaense', 'athleticopr', 'chapecoense', 'goias', 'coritiba', 'juventude', 'mirassol', 'remo', 'amazonas', 'avai', 'criciuma', 'novorizontino', 'operariopr', 'vilanova', 'cuiaba', 'santacruz', 'nautico', 'guarani', 'pontepreta', 'crb', 'abc', 'botafogosp', 'ferroviaria', 'londrina', 'tombense', 'sampaio', 'parana', 'brusque', 'ituano', 'americamg'];
const ARGENTINE_BIG_TEAMS = ['riverplate', 'bocariver', 'bocajuniors'];
const PREMIER_BIG_SIX = ['arsenal', 'chelsea', 'liverpool', 'manchestercity', 'manchesterunited', 'manutd', 'tottenham', 'spurs'];
const BLANK_TOURNAMENTS = Object.fromEntries(TOURNAMENTS.map(({ id, defaultEnabled }) => [id, { enabled: defaultEnabled }]));

export default function RoundsManager({ adminUid, seasonStatus }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState(blankRound());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  const [dateFrom, setDateFrom] = useState(localDateAfter(1));
  const [dateTo, setDateTo] = useState(localDateAfter(4));
  const [selectedLeagues, setSelectedLeagues] = useState(LEAGUES.filter((league) => league.filter !== 'europeOther').map(({ code }) => code));
  const [apiResults, setApiResults] = useState([]);
  const [resultsLimit, setResultsLimit] = useState(40);
  const [showFilteredOut, setShowFilteredOut] = useState(false);

  useEffect(() => {
    const stopRounds = onValue(ref(database, ROUND_PATH), (snapshot) => {
      const nextRounds = Object.entries(snapshot.val() || {}).map(([key, value]) => ({ key, ...(value || {}) }))
        .sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0) || toTimestamp(a.finishTimestamp) - toTimestamp(b.finishTimestamp));
      setRounds(nextRounds);
      setLoading(false);
      setError('');
    }, () => { setLoading(false); setError('Não consegui carregar as rodadas. Confira a conexão e a permissão de leitura.'); });
    return () => { stopRounds(); };
  }, []);

  const visibleRounds = useMemo(() => rounds.filter((round) => {
    const matchQuery = !query.trim() || `${round.roundNumber || round.seqNumber || ''} ${round.key} ${toArray(round.matches).map((match) => `${match.homeTeamName || match.externalHomeName || ''} ${match.awayTeamName || match.externalAwayName || ''}`).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
    const matchStatus = statusFilter === 'all' || String(round.status ?? 0) === statusFilter;
    return matchQuery && matchStatus;
  }), [rounds, query, statusFilter]);

  function openNewRound() {
    const nextNumber = rounds.reduce((highest, round) => Math.max(highest, Number(round.roundNumber || round.seqNumber) || 0), 0) + 1;
    setEditingKey(null);
    setForm({ ...blankRound(), roundNumber: String(nextNumber) });
    setFormError(''); setApiError(''); setApiSuccess(''); setApiResults([]); setEditorOpen(true);
  }

  function openEditRound(round) {
    const tournaments = { ...BLANK_TOURNAMENTS };
    if (round.tournamentConfig) {
      Object.entries(round.tournamentConfig).forEach(([id, value]) => { tournaments[id] = typeof value === 'boolean' ? { enabled: value } : { ...tournaments[id], ...value }; });
    } else if (Array.isArray(round.tournaments)) {
      TOURNAMENTS.forEach(({ id }) => { tournaments[id] = { ...tournaments[id], enabled: round.tournaments.includes(id) }; });
    }
    setEditingKey(round.key);
    setForm({ roundNumber: String(round.roundNumber || round.seqNumber || ''), status: Number(round.status || 0), tournamentConfig: tournaments, matches: toArray(round.matches).map((match) => ({ ...match, ...dateParts(match.timestamp || round.finishTimestamp) })) });
    setFormError(''); setApiError(''); setApiSuccess(''); setApiResults([]); setEditorOpen(true);
  }

  function updateForm(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  function toggleTournament(id) {
    setForm((current) => ({ ...current, tournamentConfig: { ...current.tournamentConfig, [id]: { ...current.tournamentConfig[id], enabled: !current.tournamentConfig[id]?.enabled } } }));
  }

  function updateMatchDate(index, field, value) {
    setForm((current) => ({ ...current, matches: current.matches.map((match, matchIndex) => {
      if (matchIndex !== index) return match;
      const next = { ...match, [field]: value };
      const parsed = parseManausDateTime(next.localDate, next.localTime);
      return { ...next, timestamp: parsed ? parsed.toISOString() : '' };
    }) }));
  }

  function addManualMatch() {
    const id = Date.now();
    setForm((current) => ({ ...current, matches: [...current.matches, { matchId: `manual-${id}`, homeTeam: `manual-${id}-home`, awayTeam: `manual-${id}-away`, homeTeamName: '', awayTeamName: '', timestamp: '', localDate: dateFrom || localDateAfter(2), localTime: '20:00', apiProvider: 'manual' }] }));
  }

  function removeMatch(index) {
    setForm((current) => ({ ...current, matches: current.matches.filter((_, matchIndex) => matchIndex !== index) }));
  }

  async function searchApiMatches() {
    setApiError(''); setApiSuccess(''); setApiResults([]); setResultsLimit(40);
    if (normalizeSeasonStatus(seasonStatus) === 'concluida') { setApiError('A temporada está concluída; não é possível importar jogos para novas rodadas.'); return; }
    if (!isIsoDate(dateFrom) || !isIsoDate(dateTo) || dateTo < dateFrom) { setApiError('Informe um período válido. A data final precisa ser igual ou posterior à inicial.'); return; }
    const leagueList = LEAGUES.filter((league) => selectedLeagues.includes(league.code));
    if (!leagueList.length) { setApiError('Selecione ao menos um campeonato para buscar.'); return; }
    const days = listDays(dateFrom, dateTo);
    if (days.length > 31) { setApiError('Para manter a busca rápida, consulte no máximo 31 dias por vez.'); return; }
    setApiBusy(true);
    try {
      const tasks = leagueList.flatMap((league) => days.map((day) => ({ league, day })));
      let failedQueries = 0;
      const responses = await mapConcurrent(tasks, 6, async ({ league, day }) => {
        try {
          const events = await fetchScoreboard(league.code, day);
          return events.map((event) => ({ event, league, day }));
        } catch {
          failedQueries += 1;
          return [];
        }
      });
      const byId = new Map();
      responses.flat().forEach(({ event, league }) => {
        if (event?.id) byId.set(`${league.code}:${event.id}`, { event, league });
      });
      const result = Array.from(byId.values()).map(({ event, league }) => {
        const decision = applyDefaultFixtureFilter(event, league);
        const meetsLeadTime = editingKey || toTimestamp(event.date) >= Date.now() + 18 * 60 * 60 * 1000;
        const includedByDefault = decision.include && meetsLeadTime;
        const competition = event.competitions?.[0] || {};
        const competitors = competition.competitors || [];
        const home = competitors.find((team) => team.homeAway === 'home') || competitors[0] || {};
        const away = competitors.find((team) => team.homeAway === 'away') || competitors[1] || {};
        const homeTeam = home.team || {};
        const awayTeam = away.team || {};
        return {
          id: `${league.code}:${event.id}`,
          apiFixtureId: String(event.id),
          league,
          leagueName: event.league?.name || league.label,
          timestamp: event.date,
          homeName: homeTeam.displayName || homeTeam.name || home.displayName || 'Mandante',
          awayName: awayTeam.displayName || awayTeam.name || away.displayName || 'Visitante',
          homeLogo: getEspnTeamLogo(homeTeam),
          awayLogo: getEspnTeamLogo(awayTeam),
          apiHomeTeamId: String(homeTeam.id || ''),
          apiAwayTeamId: String(awayTeam.id || ''),
          statusShort: getEspnStatusShort(event.status?.type),
          elapsed: event.status?.period || null,
          liveScore: { home: parseScore(home.score), away: parseScore(away.score) },
          includedByDefault,
          filterReason: decision.include && !meetsLeadTime ? 'jogo com menos de 18h para abrir uma nova rodada' : decision.reason,
          selected: includedByDefault,
        };
      }).sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp));
      setApiResults(result);
      const includedCount = result.filter((entry) => entry.includedByDefault).length;
      setApiSuccess(`${includedCount} jogo(s) passaram pela busca padrão; ${result.length - includedCount} ficaram fora dos critérios automáticos.${failedQueries ? ` ${failedQueries} consulta(s) à ESPN falharam.` : ''} Revise a seleção antes de adicionar.`);
      if (!result.length) setApiSuccess(failedQueries ? `Não consegui consultar ${failedQueries} combinação(ões) de campeonato e data na ESPN.` : 'A API não retornou jogos para os campeonatos e datas selecionados.');
    } catch (cause) {
      setApiError(cause?.message || 'Não foi possível consultar a ESPN agora.');
    } finally { setApiBusy(false); }
  }

  function addSelectedApiMatches() {
    const selected = apiResults.filter((fixture) => fixture.selected);
    if (!selected.length) { setApiError('Selecione pelo menos um jogo.'); return; }
    const additions = selected.map((fixture) => {
      return {
        homeTeam: `espn-${fixture.apiHomeTeamId}`, awayTeam: `espn-${fixture.apiAwayTeamId}`,
        homeTeamName: fixture.homeName, awayTeamName: fixture.awayName,
        homeTeamImage: fixture.homeLogo, awayTeamImage: fixture.awayLogo,
        externalHomeName: fixture.homeName, externalAwayName: fixture.awayName,
        timestamp: fixture.timestamp, ...dateParts(fixture.timestamp),
        matchId: `espn-${fixture.league.code}-${fixture.apiFixtureId}`,
        apiProvider: 'espn', apiFixtureId: fixture.apiFixtureId, apiLeagueCode: fixture.league.code,
        apiLeagueName: fixture.leagueName, apiHomeTeamId: fixture.apiHomeTeamId, apiAwayTeamId: fixture.apiAwayTeamId,
        liveStatus: fixture.statusShort, elapsed: fixture.elapsed, liveScore: fixture.liveScore,
      };
    });
    setForm((current) => {
      const ids = new Set(current.matches.map((match) => `${match.apiLeagueCode || ''}:${match.apiFixtureId || ''}`));
      return { ...current, matches: [...current.matches, ...additions.filter((match) => !ids.has(`${match.apiLeagueCode}:${match.apiFixtureId}`))] };
    });
    setApiSuccess(`${additions.length} partida(s) selecionada(s) adicionada(s). Confira os times vinculados e os horários.`);
    setApiError('');
  }

  async function saveRound() {
    if (saving) return;
    const errors = validateRoundForm(form, rounds, editingKey, seasonStatus);
    if (errors.length) { setFormError(errors.join('\n')); return; }
    const matchData = form.matches.map((match) => {
      const existing = findExistingMatch(rounds.find((round) => round.key === editingKey)?.matches, match);
      const { localDate, localTime, ...fields } = match;
      return { ...(existing || {}), ...fields, finalResult: match.finalResult || existing?.finalResult };
    }).map((match) => { if (!match.finalResult) delete match.finalResult; return match; });
    const sortedMatches = matchData.sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp));
    const tournamentConfig = form.tournamentConfig;
    const tournaments = TOURNAMENTS.filter(({ id }) => tournamentConfig[id]?.enabled).map(({ id }) => id);
  const roundData = {
      roundNumber: Number(form.roundNumber), seqNumber: Number(form.roundNumber),
      name: `Rodada ${Number(form.roundNumber)}`,
      status: Number(form.status),
      finishTimestamp: sortedMatches[0]?.timestamp || '',
      startTimestamp: sortedMatches[0]?.timestamp || '',
      roundDate: sortedMatches[0]?.timestamp || '',
      resultPolicy: 'regulation_time',
      tournaments,
      tournamentConfig,
      matches: sortedMatches,
      updatedAt: Date.now(), updatedBy: adminUid || null,
      ...(editingKey ? {} : { createdAt: Date.now(), createdBy: adminUid || null }),
    };
    setSaving(true); setFormError('');
    try {
      if (editingKey) {
        const oldRound = rounds.find((round) => round.key === editingKey);
        const removedPredictions = predictionCount(oldRound?.matches) - predictionCount(roundData.matches);
        if (removedPredictions > 0) {
          const confirmed = await confirmAsync('Alteração pode remover palpites', `A edição remove ${removedPredictions} palpite(s) que já estão salvos. Quer criar o backup e continuar?`);
          if (!confirmed) { setSaving(false); return; }
        }
        if (oldRound) await createRoundBackup(editingKey, oldRound, 'edit-round');
        await update(ref(database, `${ROUND_PATH}/${editingKey}`), roundData);
      } else {
        const newRef = push(ref(database, ROUND_PATH));
        await set(newRef, roundData);
      }
      setEditorOpen(false); setEditingKey(null); setForm(blankRound());
      Alert.alert('Rodada salva', `Rodada ${roundData.roundNumber} salva na temporada ${SEASON}.`);
    } catch (cause) {
      setFormError(cause?.message || 'Não foi possível salvar. Confira a conexão e as regras do Realtime Database.');
    } finally { setSaving(false); }
  }

  function requestDelete(round) {
    Alert.alert('Excluir rodada?', `Rodada ${round.roundNumber || round.seqNumber || ''} será removida da temporada 2027. Um backup será criado antes da exclusão.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir rodada', style: 'destructive', onPress: () => deleteRound(round) },
    ]);
  }

  async function deleteRound(round) {
    try {
      const snapshot = await get(ref(database, `${ROUND_PATH}/${round.key}`));
      const current = snapshot.val();
      if (!current) { Alert.alert('Rodada não encontrada', 'Atualize a lista e tente novamente.'); return; }
      const predictions = predictionCount(current.matches);
      if (predictions > 0) {
        const confirmed = await confirmAsync('A rodada tem palpites', `${predictions} palpite(s) serão removidos junto com a rodada. O backup será guardado antes. Deseja continuar?`);
        if (!confirmed) return;
      }
      await createRoundBackup(round.key, current, 'delete-round');
      await remove(ref(database, `${ROUND_PATH}/${round.key}`));
      Alert.alert('Rodada excluída', 'A cópia de segurança foi criada antes da remoção.');
    } catch (cause) { Alert.alert('Falha ao excluir', cause?.message || 'Não foi possível excluir a rodada.'); }
  }

  const filteredFixtures = useMemo(() => showFilteredOut ? apiResults : apiResults.filter((fixture) => fixture.includedByDefault), [apiResults, showFilteredOut]);
  if (editorOpen) return <View style={styles.root}>
    <View style={styles.editorHeader}>
      <Pressable accessibilityRole="button" onPress={() => setEditorOpen(false)} style={styles.backButton}><MaterialDesignIcons name="arrow-left" size={20} color="#E6F1FF" /></Pressable>
      <View style={styles.editorTitleCopy}><Text style={styles.eyebrow}>{editingKey ? 'EDIÇÃO DA TEMPORADA 2027' : 'NOVA RODADA · TEMPORADA 2027'}</Text><Text style={styles.title}>{editingKey ? `Rodada ${form.roundNumber}` : 'Configurar rodada'}</Text></View>
    </View>
    <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.sectionCard}>
        <SectionTitle icon="clipboard-text-outline" title="Informações da rodada" detail="Número, estado e competições que recebem os pontos." />
        <View style={styles.formRow}>
          <View style={styles.formField}><Text style={styles.fieldLabel}>NÚMERO</Text><TextInput value={form.roundNumber} onChangeText={(value) => updateForm('roundNumber', value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} placeholder="Ex.: 1" placeholderTextColor="#8399B2" /></View>
          <View style={[styles.formField, styles.statusField]}><Text style={styles.fieldLabel}>STATUS</Text><Text style={styles.statusSummary}>{STATUS.find((item) => item.id === Number(form.status))?.label || 'A Iniciar'}</Text></View>
        </View>
        <View style={styles.statusPills}>{STATUS.map((item) => <Pill key={item.id} label={item.label} selected={Number(form.status) === item.id} onPress={() => updateForm('status', item.id)} icon={item.icon} />)}</View>
        {Number(form.status) === 1 && normalizeSeasonStatus(seasonStatus) !== 'em_andamento' && <Text style={styles.warning}>Para colocar a rodada em andamento, primeiro altere o status da temporada para “Em Andamento”.</Text>}
        <Text style={[styles.fieldLabel, styles.subLabel]}>TORNEIOS QUE CONTAM NESTA RODADA</Text>
        <View style={styles.tournamentGrid}>{TOURNAMENTS.map(({ id, label }) => <Pressable key={id} accessibilityRole="switch" accessibilityState={{ checked: !!form.tournamentConfig[id]?.enabled }} onPress={() => toggleTournament(id)} style={[styles.tournamentToggle, form.tournamentConfig[id]?.enabled && styles.tournamentToggleOn]}>
          <MaterialDesignIcons name={form.tournamentConfig[id]?.enabled ? 'check-circle' : 'circle-outline'} size={18} color={form.tournamentConfig[id]?.enabled ? '#BAF280' : '#8198B2'} /><Text style={[styles.tournamentLabel, form.tournamentConfig[id]?.enabled && styles.tournamentLabelOn]}>{label}</Text>
        </Pressable>)}</View>
        <Text style={styles.policyNote}>Resultados oficiais consideram somente o tempo regulamentar. Prorrogação e disputa de pênaltis não contam.</Text>
      </View>

      <View style={styles.sectionCard}>
        <SectionTitle icon="cloud-download-outline" title="Busca padrão de jogos" detail="Busque por período; a seleção inteligente aplica os critérios que você definiu." />
        <Text style={styles.filterHelp}>Série A, Copa América e Copa do Mundo: todos. Série B: grandes do Brasil. Copa do Brasil: grandes nas fases iniciais, todos desde os 16 avos. Libertadores e Sul-Americana: brasileiros, River ou Boca. Champions: clubes definidos ou mata-mata completo. Ligas europeias: clássicos do Big Six ou Real × Barça. Mundial Intercontinental: semifinal e final. O primeiro jogo da rodada nova deve ter pelo menos 18h de antecedência.</Text>
        <View style={styles.dateRow}>
          <DateField label="DE" value={dateFrom} onChangeText={setDateFrom} />
          <DateField label="ATÉ" value={dateTo} onChangeText={setDateTo} />
        </View>
        <View style={styles.leagueHeader}><Text style={styles.fieldLabel}>CAMPEONATOS DA BUSCA</Text><Pressable onPress={() => setSelectedLeagues(selectedLeagues.length === LEAGUES.length ? [] : LEAGUES.map(({ code }) => code))}><Text style={styles.textAction}>{selectedLeagues.length === LEAGUES.length ? 'Limpar' : 'Selecionar todos'}</Text></Pressable></View>
        <View style={styles.leagueGrid}>{LEAGUES.map((league) => { const selected = selectedLeagues.includes(league.code); return <Pressable key={league.code} onPress={() => setSelectedLeagues((current) => selected ? current.filter((code) => code !== league.code) : [...current, league.code])} style={[styles.leagueChip, selected && styles.leagueChipSelected]}><MaterialDesignIcons name={selected ? 'check' : 'plus'} size={14} color={selected ? '#C8F79D' : '#91A9C7'} /><Text style={[styles.leagueChipText, selected && styles.leagueChipTextSelected]}>{league.short}</Text></Pressable>; })}</View>
        <PrimaryAction title={apiBusy ? 'Buscando jogos…' : 'Buscar jogos na ESPN'} icon={apiBusy ? null : 'magnify'} onPress={searchApiMatches} disabled={apiBusy} />
        {apiBusy && <ActivityIndicator color="#B9F276" style={styles.apiSpinner} />}
        {!!apiError && <Text style={styles.errorText}>{apiError}</Text>}
        {!!apiSuccess && <Text style={styles.successText}>{apiSuccess}</Text>}
        {!!apiResults.length && <>
          <View style={styles.resultsToolbar}><Text style={styles.fieldLabel}>{Math.min(filteredFixtures.length, resultsLimit)} DE {filteredFixtures.length} JOGOS</Text><Pill label={showFilteredOut ? 'Somente padrão' : 'Ver todos'} selected={showFilteredOut} onPress={() => { setShowFilteredOut((value) => !value); setResultsLimit(40); }} /></View>
          {filteredFixtures.slice(0, resultsLimit).map((fixture) => <FixtureResult key={fixture.id} fixture={fixture} onPress={() => setApiResults((current) => current.map((item) => item.id === fixture.id ? { ...item, selected: !item.selected } : item))} />)}
          {filteredFixtures.length > resultsLimit && <Pressable onPress={() => setResultsLimit((count) => count + 40)} style={styles.moreResults}><Text style={styles.textAction}>Carregar mais jogos</Text></Pressable>}
          <PrimaryAction title="Adicionar selecionados à rodada" icon="plus" onPress={addSelectedApiMatches} />
        </>}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.gamesHeading}><SectionTitle icon="soccer" title={`Jogos da rodada · ${form.matches.length}`} detail="Mínimo de dois jogos. Horários são usados para os prazos de palpite." /><Pressable accessibilityRole="button" onPress={addManualMatch} style={styles.addManual}><MaterialDesignIcons name="plus" size={16} color="#0A2345" /><Text style={styles.addManualText}>Jogo manual</Text></Pressable></View>
        {form.matches.length === 0 ? <View style={styles.emptyMatches}><MaterialDesignIcons name="soccer-field" size={27} color="#7591AF" /><Text style={styles.emptyTitle}>A rodada ainda não tem jogos</Text><Text style={styles.emptyDetail}>Busque na ESPN ou adicione os jogos manualmente.</Text></View> : form.matches.map((match, index) => <MatchEditor key={`${match.apiLeagueCode || 'manual'}-${match.apiFixtureId || index}`} match={match} index={index} onUpdateDate={updateMatchDate} onRemove={removeMatch} />)}
        {form.matches.length > 0 && <View style={styles.roundSummary}><MaterialDesignIcons name="clock-check-outline" size={18} color="#B9F276" /><Text style={styles.roundSummaryText}>{earliestMatchLabel(form.matches)}</Text></View>}
      </View>
      {!!formError && <Text style={styles.errorText}>{formError}</Text>}
      <View style={styles.actionRow}><Pressable onPress={() => setEditorOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><PrimaryAction title={saving ? 'Salvando…' : 'Salvar rodada'} icon={saving ? null : 'content-save-outline'} onPress={saveRound} disabled={saving} /></View>
    </ScrollView>
  </View>;

  return <View style={styles.root}>
    <View style={styles.listHeader}><View style={styles.listHeadingCopy}><Text style={styles.eyebrow}>CALENDÁRIO · TEMPORADA 2027</Text><Text style={styles.title}>Rodadas</Text><Text style={styles.listSubtitle}>{rounds.length} cadastrada(s) · configure jogos, prazos e torneios válidos.</Text></View><Pressable accessibilityRole="button" onPress={openNewRound} style={styles.createButton}><MaterialDesignIcons name="plus" size={19} color="#092447" /><Text style={styles.createButtonText}>Nova rodada</Text></Pressable></View>
    <View style={styles.listFilters}><TextInput value={query} onChangeText={setQuery} placeholder="Buscar número, time ou ID" placeholderTextColor="#8299B2" style={styles.searchInput} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilters}>{[['all', 'Todas'], ...STATUS.map((item) => [String(item.id), item.label])].map(([id, label]) => <Pill key={id} label={label} selected={statusFilter === id} onPress={() => setStatusFilter(id)} />)}</ScrollView></View>
    {error ? <View style={styles.emptyMatches}><MaterialDesignIcons name="cloud-alert-outline" size={28} color="#FFB5A9" /><Text style={styles.emptyTitle}>Lista indisponível</Text><Text style={styles.emptyDetail}>{error}</Text></View> : loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#B9F276" /><Text style={styles.loadingText}>Carregando calendário…</Text></View> : visibleRounds.length ? <ScrollView contentContainerStyle={styles.roundList} showsVerticalScrollIndicator={false}>{visibleRounds.map((round) => <RoundCard key={round.key} round={round} onEdit={() => openEditRound(round)} onDelete={() => requestDelete(round)} />)}</ScrollView> : <View style={styles.emptyMatches}><MaterialDesignIcons name="calendar-blank-outline" size={28} color="#7591AF" /><Text style={styles.emptyTitle}>{rounds.length ? 'Nenhuma rodada nesse filtro' : 'Ainda não há rodadas'}</Text><Text style={styles.emptyDetail}>{rounds.length ? 'Altere a busca ou o status selecionado.' : 'Crie a primeira rodada da temporada 2027.'}</Text></View>}
  </View>;
}

function blankRound() {
  return { roundNumber: '', status: 0, tournamentConfig: Object.fromEntries(Object.entries(BLANK_TOURNAMENTS).map(([id, config]) => [id, { ...config }])), matches: [] };
}

function RoundCard({ round, onEdit, onDelete }) {
  const status = STATUS.find((item) => item.id === Number(round.status || 0)) || STATUS[0];
  const tournaments = Array.isArray(round.tournaments) ? round.tournaments : Object.entries(round.tournamentConfig || {}).filter(([, value]) => (typeof value === 'boolean' ? value : value?.enabled)).map(([id]) => id);
  return <View style={styles.roundCard}>
    <View style={styles.roundCardTop}><View style={styles.numberBadge}><Text style={styles.numberBadgeLabel}>RODADA</Text><Text style={styles.numberBadgeValue}>{round.roundNumber || round.seqNumber || '—'}</Text></View><View style={styles.roundCardInfo}><View style={styles.roundCardMeta}><View style={[styles.statusDot, { backgroundColor: status.id === 1 ? '#B9F276' : status.id === 2 ? '#7DC5FF' : '#9AAFC4' }]} /><Text style={styles.roundStatus}>{status.label}</Text><Text style={styles.dotSep}>·</Text><Text style={styles.matchCount}>{toArray(round.matches).length} jogos</Text></View><Text style={styles.roundDate}>{formatDateTime(round.finishTimestamp || round.startTimestamp)}</Text><Text numberOfLines={2} style={styles.roundMatchNames}>{toArray(round.matches).slice(0, 2).map((match) => `${match.homeTeamName || match.externalHomeName || 'Time a definir'} × ${match.awayTeamName || match.externalAwayName || 'Time a definir'}`).join('  ·  ')}{toArray(round.matches).length > 2 ? `  +${toArray(round.matches).length - 2}` : ''}</Text></View><View style={styles.cardActions}><IconButton label="Editar rodada" icon="pencil-outline" onPress={onEdit} /><IconButton label="Excluir rodada" icon="delete-outline" danger onPress={onDelete} /></View></View>
    <View style={styles.roundTournamentTags}>{tournaments.map((id) => { const tournament = TOURNAMENTS.find((item) => item.id === id); return <View key={id} style={styles.roundTag}><Text style={styles.roundTagText}>{tournament?.label || id}</Text></View>; })}</View>
  </View>;
}

function MatchEditor({ match, index, onUpdateDate, onRemove }) {
  const homeName = match.homeTeamName || match.externalHomeName || 'Mandante';
  const awayName = match.awayTeamName || match.externalAwayName || 'Visitante';
  return <View style={styles.matchEditor}>
    <View style={styles.matchEditorTop}><View style={styles.matchIndex}><Text style={styles.matchIndexText}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.matchSource}><MaterialDesignIcons name={match.apiProvider === 'espn' ? 'cloud-check-outline' : 'pencil-outline'} size={14} color="#AFC5DD" /><Text style={styles.matchSourceText}>{match.apiProvider === 'espn' ? (match.apiLeagueName || 'ESPN') : 'JOGO MANUAL'}</Text></View><IconButton label="Remover jogo" icon="close" danger onPress={() => onRemove(index)} /></View>
    {match.apiProvider === 'manual' ? <View style={styles.teamsMatchRow}><TextInput value={match.homeTeamName || ''} onChangeText={(value) => onUpdateDate(index, 'homeTeamName', value)} placeholder="Mandante" placeholderTextColor="#8299B2" style={[styles.input, styles.manualTeamInput]} /><Text style={styles.matchVs}>×</Text><TextInput value={match.awayTeamName || ''} onChangeText={(value) => onUpdateDate(index, 'awayTeamName', value)} placeholder="Visitante" placeholderTextColor="#8299B2" style={[styles.input, styles.manualTeamInput]} /></View> : <View style={styles.teamsMatchRow}>{match.homeTeamImage ? <Image source={{ uri: match.homeTeamImage }} style={styles.espnTeamLogo} resizeMode="contain" /> : <MaterialDesignIcons name="shield-outline" size={21} color="#8299B2" />}<Text numberOfLines={2} style={styles.espnTeamName}>{homeName}</Text><Text style={styles.matchVs}>×</Text><Text numberOfLines={2} style={[styles.espnTeamName, styles.espnTeamNameAway]}>{awayName}</Text>{match.awayTeamImage ? <Image source={{ uri: match.awayTeamImage }} style={styles.espnTeamLogo} resizeMode="contain" /> : <MaterialDesignIcons name="shield-outline" size={21} color="#8299B2" />}</View>}
    {match.apiProvider === 'espn' && <Text style={styles.matchMappingNote}>Times, nomes e escudos registrados diretamente da ESPN.</Text>}
    <View style={styles.dateRow}><DateField label="DATA · MANAUS" value={match.localDate || ''} onChangeText={(value) => onUpdateDate(index, 'localDate', value)} /><DateField label="HORÁRIO" value={match.localTime || ''} onChangeText={(value) => onUpdateDate(index, 'localTime', value)} time /></View>
  </View>;
}

function FixtureResult({ fixture, onPress }) {
  return <Pressable onPress={onPress} style={[styles.fixtureRow, fixture.selected && styles.fixtureSelected]}>
    <MaterialDesignIcons name={fixture.selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={21} color={fixture.selected ? '#B9F276' : '#8299B2'} />
    {fixture.homeLogo ? <Image source={{ uri: fixture.homeLogo }} style={styles.espnTeamLogo} resizeMode="contain" /> : <MaterialDesignIcons name="shield-outline" size={20} color="#8299B2" />}<View style={styles.fixtureCopy}><Text style={styles.fixtureTeams}>{fixture.homeName} × {fixture.awayName}</Text><Text style={styles.fixtureMeta}>{fixture.leagueName} · {formatDateTime(fixture.timestamp)} · {fixture.statusShort}</Text><Text style={[styles.filterReason, fixture.includedByDefault ? styles.filterIncluded : styles.filterExcluded]}>{fixture.includedByDefault ? 'PADRÃO · ' : 'FORA DO PADRÃO · '}{fixture.filterReason}</Text></View>{fixture.awayLogo ? <Image source={{ uri: fixture.awayLogo }} style={styles.espnTeamLogo} resizeMode="contain" /> : <MaterialDesignIcons name="shield-outline" size={20} color="#8299B2" />}
  </Pressable>;
}

function SectionTitle({ icon, title, detail }) { return <View style={styles.sectionTitleRow}><View style={styles.sectionIcon}><MaterialDesignIcons name={icon} size={19} color="#B9F276" /></View><View style={styles.sectionTitleCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionDetail}>{detail}</Text></View></View>; }
function DateField({ label, value, onChangeText, time = false }) { return <View style={styles.formField}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={time ? '20:00' : 'AAAA-MM-DD'} placeholderTextColor="#8399B2" style={styles.input} autoCapitalize="none" keyboardType={time ? 'numbers-and-punctuation' : 'numbers-and-punctuation'} maxLength={time ? 5 : 10} /></View>; }
function Pill({ label, selected, onPress, icon }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}>{icon && <MaterialDesignIcons name={icon} size={14} color={selected ? '#092447' : '#AFC5DD'} />}<Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text></Pressable>; }
function PrimaryAction({ title, icon, onPress, disabled }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryAction, disabled && styles.disabled]}>{icon && <MaterialDesignIcons name={icon} size={17} color="#092447" />}<Text style={styles.primaryActionText}>{title}</Text></Pressable>; }
function IconButton({ label, icon, onPress, danger = false }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.iconButton, danger && styles.iconButtonDanger]}><MaterialDesignIcons name={icon} size={18} color={danger ? '#FFAAA0' : '#C8D8E8'} /></Pressable>; }

function validateRoundForm(form, rounds, editingKey, seasonStatus) {
  const errors = [];
  const number = Number(form.roundNumber);
  if (!Number.isInteger(number) || number < 1) errors.push('Informe um número inteiro de rodada, a partir de 1.');
  if (rounds.some((round) => round.key !== editingKey && Number(round.roundNumber || round.seqNumber) === number)) errors.push(`A rodada ${number} já existe.`);
  if (!TOURNAMENTS.some(({ id }) => form.tournamentConfig[id]?.enabled)) errors.push('Ative ao menos um torneio para esta rodada.');
  if (form.matches.length < 2) errors.push('A rodada precisa ter pelo menos dois jogos.');
  form.matches.forEach((match, index) => {
    if (!match.homeTeam || !match.awayTeam || !(match.homeTeamName || match.externalHomeName) || !(match.awayTeamName || match.externalAwayName)) errors.push(`Jogo ${index + 1}: os dois times precisam ter identificador e nome.`);
    if (match.homeTeam && match.homeTeam === match.awayTeam) errors.push(`Jogo ${index + 1}: os times precisam ser diferentes.`);
    if (!match.timestamp || !Number.isFinite(toTimestamp(match.timestamp))) errors.push(`Jogo ${index + 1}: informe data e horário válidos.`);
  });
  if (!editingKey && form.matches.length) {
    const firstKickoff = Math.min(...form.matches.map((match) => toTimestamp(match.timestamp)).filter(Number.isFinite));
    if (Number.isFinite(firstKickoff) && firstKickoff < Date.now() + 18 * 60 * 60 * 1000) errors.push('O primeiro jogo precisa começar pelo menos 18 horas depois da criação da rodada.');
  }
  if (Number(form.status) === 1 && normalizeSeasonStatus(seasonStatus) !== 'em_andamento') errors.push('A temporada precisa estar “Em Andamento” para abrir a rodada.');
  return errors;
}

async function fetchScoreboard(league, day) {
  const date = day.replace(/-/g, '');
  const url = Platform.OS === 'web'
    ? `/api/espn?resource=scoreboard&league=${encodeURIComponent(league)}&dates=${date}&limit=200`
    : `${ESPN}/${encodeURIComponent(league)}/scoreboard?dates=${date}&limit=200`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`ESPN ${league} (${response.status})`);
    const payload = await response.json();
    return payload.events || [];
  } finally { clearTimeout(timeout); }
}

function applyDefaultFixtureFilter(event, league) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const names = competitors.map((item) => normalizeName(item.team?.displayName || item.team?.name || item.displayName || '')).filter(Boolean);
  const stage = normalizeName([event.name, event.shortName, event.season?.name, event.competitions?.[0]?.notes?.map((note) => note.headline).join(' ')].filter(Boolean).join(' '));
  const isKnockout = /roundof32|roundof16|roundof8|roundof4|roundof2|16avos|oitavas|quartas|semifinal|final|knockout|playoff|last16|quarterfinal|fifthround/.test(stage);
  const hasBrazilBig = names.some((name) => BRAZIL_BIG_TEAMS.some((team) => name.includes(team)));
  const hasBrazil = names.some((name) => BRAZIL_TEAMS.some((team) => name.includes(team)));
  const hasSouthBig = hasBrazil || names.some((name) => ARGENTINE_BIG_TEAMS.some((team) => name.includes(team)));
  const hasPremBig = names.filter((name) => PREMIER_BIG_SIX.some((team) => name.includes(team))).length >= 2;
  const hasSpanishClassic = names.some((name) => name.includes('realmadrid')) && names.some((name) => name.includes('barcelona'));
  const includedClub = ['realmadrid', 'barcelona', 'atleticomadrid', 'parissaintgermain', 'psg', 'bayernmunich', 'bayernmunchen', 'borussiadortmund', 'juventus', 'intermilan', 'internazionale', 'acmilan', 'napoli', 'roma', 'benfica', 'porto', 'sportingcp', ...PREMIER_BIG_SIX].some((team) => names.some((name) => name.includes(team)));
  const text = normalizeName(`${league.label} ${event.name || ''} ${event.season?.name || ''}`);
  const intercontinental = league.code.includes('intercontinental') || text.includes('intercontinentalcup');
  let include = false;
  let reason = '';
  switch (league.filter) {
    case 'all': include = true; reason = 'todos os jogos deste torneio'; break;
    case 'brazilBig': include = hasBrazilBig; reason = include ? 'participação de um dos grandes do Brasil' : 'sem um dos grandes brasileiros'; break;
    case 'copaBrasil': include = /roundof32|roundof16|roundof8|roundof4|roundof2|16avos|oitavas|quartas|semifinal|final|knockout|playoff|last16|quarterfinal|fifthround/.test(stage) || hasBrazilBig; reason = include && isKnockout ? 'fase de mata-mata a partir dos 16 avos' : include ? 'participação de um dos grandes do Brasil' : 'fase inicial sem grande brasileiro'; break;
    case 'clubWorld': include = !intercontinental || /semifinal|final/.test(stage); reason = intercontinental ? (include ? 'semifinal ou final da Copa Intercontinental' : 'fase anterior à semifinal') : 'Super Mundial: todos os jogos'; break;
    case 'southAmericaBig': include = hasSouthBig; reason = include ? 'brasileiro, River Plate ou Boca Juniors' : 'sem brasileiro, River Plate ou Boca Juniors'; break;
    case 'champions': include = isKnockout || includedClub; reason = isKnockout ? 'mata-mata completo' : include ? 'participação de clube de interesse' : 'sem clube de interesse na fase de liga'; break;
    case 'europeClassic': include = hasPremBig; reason = include ? 'clássico entre clubes do Big Six' : 'somente clássicos entre clubes do Big Six'; break;
    case 'spainClassic': include = hasSpanishClassic; reason = include ? 'Real Madrid × Barcelona' : 'somente Real Madrid × Barcelona'; break;
    case 'europeOther': include = false; reason = 'nenhum clássico padrão definido para esta liga'; break;
    default: reason = 'critério padrão não configurado';
  }
  return { include, reason };
}

function getEspnStatusShort(status) {
  const name = String(status?.name || '').toUpperCase();
  if (status?.completed || name.includes('FINAL') || status?.state === 'post') return 'FT';
  if (name.includes('HALFTIME')) return 'HT';
  if (status?.state === 'in' || name.includes('IN_PROGRESS')) return 'LIVE';
  if (name.includes('POSTPONED')) return 'PST';
  return 'NS';
}

function getEspnTeamLogo(team) { return team?.logos?.[0]?.href || team?.logo || ''; }

function normalizeName(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/\b(fc|ec|sc|ac|cf|cr|cd|club|de|do|da|football|club)\b/g, '').replace(/[^a-z0-9]/g, ''); }
function normalizeSeasonStatus(status) {
  const value = String(status || '').trim().toLowerCase().replace(/[ -]/g, '_');
  return ({ active: 'em_andamento', open: 'em_andamento', draft: 'a_iniciar', preparation: 'a_iniciar', prepared: 'a_iniciar', complete: 'concluida', finished: 'concluida', closed: 'concluida' })[value] || value;
}
function isIsoDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const parsed = Date.parse(`${value}T00:00:00Z`); return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value; }
function listDays(from, to) { const days = []; const date = new Date(`${from}T00:00:00Z`); const end = new Date(`${to}T00:00:00Z`); while (date <= end) { days.push(date.toISOString().slice(0, 10)); date.setUTCDate(date.getUTCDate() + 1); } return days; }
async function mapConcurrent(values, limit, mapper) { const output = new Array(values.length); let index = 0; const workers = Array.from({ length: Math.min(limit, values.length) }, async () => { while (index < values.length) { const current = index++; output[current] = await mapper(values[current]); } }); await Promise.all(workers); return output; }
function toArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }
function toTimestamp(value) { const result = typeof value === 'number' ? value : Date.parse(value || ''); return Number.isFinite(result) ? result : Number.NaN; }
function localDateAfter(days) { const date = new Date(Date.now() + days * 86400000); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
function dateParts(value) { const date = new Date(value); if (Number.isNaN(date.getTime())) return { localDate: '', localTime: '' }; const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date); const data = Object.fromEntries(parts.map((part) => [part.type, part.value])); return { localDate: `${data.year}-${data.month}-${data.day}`, localTime: `${data.hour}:${data.minute}` }; }
function parseManausDateTime(date, time) { if (!isIsoDate(date) || !/^\d{2}:\d{2}$/.test(time || '')) return null; const [hours, minutes] = time.split(':').map(Number); if (hours > 23 || minutes > 59) return null; const parsed = new Date(`${date}T${time}:00-04:00`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function formatDateTime(value) { const time = toTimestamp(value); return Number.isFinite(time) ? new Date(time).toLocaleString('pt-BR', { timeZone: 'America/Manaus', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Data a definir'; }
function earliestMatchLabel(matches) { const earliest = matches.map((match) => match.timestamp).filter(Boolean).sort((a, b) => toTimestamp(a) - toTimestamp(b))[0]; return earliest ? `Primeiro jogo: ${formatDateTime(earliest)} · horário de Manaus` : 'Defina data e horário dos jogos'; }
function findExistingMatch(matches, next) { return toArray(matches).find((match) => next.apiFixtureId && String(match.apiFixtureId) === String(next.apiFixtureId) && match.apiLeagueCode === next.apiLeagueCode) || toArray(matches).find((match) => next.matchId && match.matchId === next.matchId) || toArray(matches).find((match) => match.homeTeam === next.homeTeam && match.awayTeam === next.awayTeam); }
function parseScore(value) { if (value === undefined || value === null || value === '') return null; const score = Number(value); return Number.isFinite(score) ? score : null; }
function predictionCount(matches) { return toArray(matches).reduce((total, match) => total + Object.keys(match.predictions || {}).length + Object.keys(match.wildcardPredictions || {}).length, 0); }
function confirmAsync(title, message) { return new Promise((resolve) => Alert.alert(title, message, [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continuar', style: 'destructive', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) })); }
async function createRoundBackup(key, data, reason) { const backup = push(ref(database, `backups/seasons/${SEASON}/rounds/${key}`)); await set(backup, { reason, createdAt: Date.now(), data }); }

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 8 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 17, marginBottom: 16 },
  listHeadingCopy: { flex: 1 },
  eyebrow: { color: '#9DB6CF', fontSize: 8, letterSpacing: 1.15, fontWeight: '900' },
  title: { color: '#F4F8FD', fontSize: 25, fontWeight: '900', marginTop: 3 },
  listSubtitle: { maxWidth: 340, color: '#9DB2C9', fontSize: 11, lineHeight: 16, marginTop: 4 },
  createButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#B9F276', borderBottomWidth: 3, borderBottomColor: '#76B44D' },
  createButtonText: { color: '#092447', fontSize: 10, fontWeight: '900' },
  listFilters: { gap: 10, marginBottom: 12 },
  searchInput: { minHeight: 44, paddingHorizontal: 12, color: '#F2F6FA', borderRadius: 10, borderWidth: 1, borderColor: '#315578', backgroundColor: '#0C2547', fontSize: 12 },
  statusFilters: { gap: 6, paddingVertical: 2 },
  roundList: { paddingBottom: 18, gap: 10 },
  roundCard: { padding: 13, borderRadius: 14, backgroundColor: '#0C2547', borderWidth: 1, borderColor: '#29496B' },
  roundCardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  numberBadge: { width: 53, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#55754D', backgroundColor: '#17392F' },
  numberBadgeLabel: { color: '#A6C798', fontSize: 6, letterSpacing: .7, fontWeight: '900' },
  numberBadgeValue: { color: '#D7F7B9', fontSize: 21, fontWeight: '900' },
  roundCardInfo: { flex: 1, minWidth: 0 },
  roundCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  roundStatus: { color: '#E1EAF4', fontSize: 9, fontWeight: '900' },
  dotSep: { color: '#718AA4', fontSize: 10 },
  matchCount: { color: '#A8BDD3', fontSize: 9 },
  roundDate: { color: '#B9F276', fontSize: 10, fontWeight: '800', marginTop: 5 },
  roundMatchNames: { color: '#9FB4CA', fontSize: 9, lineHeight: 13, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 4 },
  roundTournamentTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 11 },
  roundTag: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: '#15334C' },
  roundTagText: { color: '#BCD1E5', fontSize: 8, fontWeight: '800' },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#355677', backgroundColor: '#142F4C' },
  iconButtonDanger: { borderColor: '#67414A', backgroundColor: '#3D2A3B' },
  loading: { minHeight: 200, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: '#AFC5DD', fontSize: 11 },
  emptyMatches: { minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' },
  emptyTitle: { color: '#E9F0F8', fontSize: 13, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  emptyDetail: { color: '#9DB2C9', fontSize: 10, lineHeight: 15, marginTop: 5, textAlign: 'center' },
  pill: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#3A5570', backgroundColor: '#122D4A' },
  pillSelected: { borderColor: '#8BBF61', backgroundColor: '#B9F276' },
  pillText: { color: '#BBCBDB', fontSize: 8, fontWeight: '900' },
  pillTextSelected: { color: '#092447' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15, marginBottom: 12 },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#315578', backgroundColor: '#0C2547' },
  editorTitleCopy: { flex: 1 },
  editorContent: { paddingBottom: 34, gap: 12 },
  sectionCard: { padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  sectionIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#17392F' },
  sectionTitleCopy: { flex: 1 },
  sectionTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' },
  sectionDetail: { color: '#91A9C7', fontSize: 9, lineHeight: 13, marginTop: 3 },
  filterHelp: { color: '#AFC2D5', fontSize: 9, lineHeight: 14, marginTop: -4, marginBottom: 5 },
  formRow: { flexDirection: 'row', gap: 9 },
  formField: { flex: 1, minWidth: 0, gap: 5 },
  fieldLabel: { color: '#9FB5CB', fontSize: 8, letterSpacing: .7, fontWeight: '900' },
  input: { minHeight: 43, paddingHorizontal: 10, color: '#F2F6FA', borderRadius: 9, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 11 },
  statusField: { justifyContent: 'flex-end', paddingBottom: 11 },
  statusSummary: { color: '#B9F276', fontSize: 12, fontWeight: '900' },
  statusPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  warning: { color: '#FFD78C', fontSize: 10, lineHeight: 15, marginTop: 9 },
  subLabel: { marginTop: 17, marginBottom: 8 },
  tournamentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tournamentToggle: { minHeight: 39, width: '48%', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#112C49' },
  tournamentToggleOn: { borderColor: '#55754D', backgroundColor: '#15372F' },
  tournamentLabel: { flex: 1, color: '#AFC2D5', fontSize: 9, fontWeight: '800' },
  tournamentLabelOn: { color: '#D7EFC2' },
  policyNote: { marginTop: 11, padding: 10, color: '#D0E6B8', backgroundColor: '#15372F', borderWidth: 1, borderColor: '#426552', borderRadius: 9, fontSize: 9, lineHeight: 14 },
  stageBox: { marginTop: 10, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' },
  stageCopy: { marginBottom: 8 },
  stageTitle: { color: '#E2EDF7', fontSize: 10, fontWeight: '900' },
  stageDetail: { color: '#91A9C7', fontSize: 9, marginTop: 3 },
  stageChoices: { flexDirection: 'row', gap: 7 },
  dateRow: { flexDirection: 'row', gap: 9, marginTop: 9 },
  leagueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, marginBottom: 8 },
  textAction: { color: '#B9F276', fontSize: 9, fontWeight: '900' },
  leagueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  leagueChip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' },
  leagueChipSelected: { borderColor: '#55754D', backgroundColor: '#15372F' },
  leagueChipText: { color: '#AFC2D5', fontSize: 8, fontWeight: '800' },
  leagueChipTextSelected: { color: '#D7EFC2' },
  primaryAction: { minHeight: 43, paddingHorizontal: 13, marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#B9F276', borderBottomWidth: 3, borderBottomColor: '#76B44D' },
  primaryActionText: { color: '#092447', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: .5 },
  apiSpinner: { marginTop: 9 },
  errorText: { color: '#FFB5A9', fontSize: 10, lineHeight: 15, marginTop: 9 },
  successText: { color: '#C6EDA7', fontSize: 10, lineHeight: 15, marginTop: 9 },
  resultsToolbar: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  moreResults: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  fixtureRow: { minHeight: 64, marginTop: 6, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: '#314E69', backgroundColor: '#102844' },
  fixtureSelected: { borderColor: '#55754D', backgroundColor: '#14342F' },
  fixtureCopy: { flex: 1 },
  fixtureTeams: { color: '#E4EDF6', fontSize: 10, fontWeight: '900' },
  fixtureMeta: { color: '#9CB2C8', fontSize: 8, marginTop: 3 },
  filterReason: { fontSize: 7, fontWeight: '900', letterSpacing: .25, marginTop: 4 },
  filterIncluded: { color: '#B9F276' },
  filterExcluded: { color: '#F6C882' },
  gamesHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  addManual: { minHeight: 35, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, backgroundColor: '#B9F276' },
  addManualText: { color: '#092447', fontSize: 8, fontWeight: '900' },
  matchEditor: { marginTop: 9, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: '#314E69', backgroundColor: '#102844' },
  matchEditorTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  matchIndex: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#193A56' },
  matchIndexText: { color: '#C7D8E7', fontSize: 8, fontWeight: '900' },
  matchSource: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchSourceText: { color: '#9CB2C8', fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  teamsMatchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  teamSelect: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A' },
  teamSelectText: { flex: 1, color: '#E2EDF7', fontSize: 9, fontWeight: '800' },
  unselectedTeam: { color: '#8299B2' },
  matchMappingNote: { color: '#F3CE8A', fontSize: 8, lineHeight: 12, marginTop: 6 },
  espnTeamLogo: { width: 25, height: 25, flexShrink: 0 },
  espnTeamName: { flex: 1, color: '#E2EDF7', fontSize: 9, fontWeight: '800', textAlign: 'left' },
  espnTeamNameAway: { textAlign: 'right' },
  manualTeamInput: { flex: 1, minWidth: 0, minHeight: 38, paddingHorizontal: 7, fontSize: 9 },
  matchVs: { color: '#B9F276', fontSize: 12, fontWeight: '900' },
  roundSummary: { minHeight: 36, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  roundSummaryText: { color: '#B9F276', fontSize: 9, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 1 },
  cancelButton: { minWidth: 88, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#102844' },
  cancelText: { color: '#C7D8E7', fontSize: 10, fontWeight: '900' },
  modalShade: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,9,23,.75)' },
  teamModal: { width: '100%', maxWidth: 470, maxHeight: '80%', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#0B2140' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: '#F1F5FA', fontSize: 15, fontWeight: '900' },
  modalSubtitle: { color: '#91A9C7', fontSize: 9, marginTop: 3 },
  teamOptions: { maxHeight: 360, marginTop: 8 },
  teamOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.12)' },
  teamLogo: { width: 28, height: 28 },
  teamOptionName: { flex: 1, color: '#DFEAF4', fontSize: 11 },
  playerLogo: { width: 25, height: 25 },
});
