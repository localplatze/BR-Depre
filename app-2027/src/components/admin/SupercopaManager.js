import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/supercopa/${SEASON}`;
const SECTIONS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'groups', label: 'Grupos e sorteio' },
  { id: 'groupRounds', label: 'Rodadas de grupos' },
  { id: 'pots', label: 'Classificação e potes' },
  { id: 'knockout', label: 'Mata-mata' },
  { id: 'results', label: 'Campeões' },
];
const SERIES = [
  { id: 'A', label: 'Série A' },
  { id: 'B', label: 'Série B' },
  { id: 'C', label: 'Série C' },
];
const PHASES = [
  { id: 'quarterFinals', label: 'Quartas de final', count: 4 },
  { id: 'semiFinals', label: 'Semifinais', count: 2 },
  { id: 'final', label: 'Final', count: 1 },
  { id: 'thirdPlace', label: '3º lugar', count: 1 },
];
const STATUS = [
  { id: 0, label: 'A iniciar' },
  { id: 1, label: 'Em andamento' },
  { id: 2, label: 'Concluída' },
];
const TIE_BREAKS = [
  { id: 'superligaPosition', label: 'Melhor posição na Superliga' },
  { id: 'groupPosition', label: 'Melhor posição no grupo' },
  { id: 'extraMatch', label: 'Rodada extra de desempate' },
  { id: 'penalties', label: 'Disputa de pênaltis' },
];

export default function SupercopaManager({ players = [], memberships = {}, loadingRoster, rosterError, seasonStatus, adminUid }) {
  const [data, setData] = useState({});
  const [rounds, setRounds] = useState([]);
  const [superligaPositions, setSuperligaPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [section, setSection] = useState('overview');
  const [groupCount, setGroupCount] = useState('4');
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState({});
  const [drawPreview, setDrawPreview] = useState(null);
  const [groupRounds, setGroupRounds] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [selectedSeries, setSelectedSeries] = useState('A');
  const [selectedPhase, setSelectedPhase] = useState('quarterFinals');
  const [seriesData, setSeriesData] = useState(emptySeries());
  const [activeStage, setActiveStage] = useState('groups');
  const [editionStatus, setEditionStatus] = useState(0);
  const [tieBreak, setTieBreak] = useState('');
  const [champions, setChampions] = useState({});

  useEffect(() => {
    const stopCopa = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setData(value);
      setGroupCount(String(value.config?.groupCount || 4));
      setParticipants(asIds(value.participants));
      setGroups(normalizeGroups(value.groups || {}, Number(value.config?.groupCount || 4)));
      setGroupRounds(normalizeRounds(value.groupRounds || value.groups?.rounds));
      setSeriesData(normalizeSeries(value.series || {}));
      setActiveStage(value.config?.activeStage || 'groups');
      setEditionStatus(Number(value.status || 0));
      setTieBreak(value.config?.aggregateTieBreak || '');
      setChampions(value.champions || {});
      setLoading(false);
      setMessage('');
    }, () => { setLoading(false); setMessage('Não consegui carregar a edição da Supercopa 2027.'); });
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => {
      const next = Object.entries(snapshot.val() || {}).map(([id, round]) => ({ id, ...round }))
        .sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0));
      setRounds(next);
    }, () => setMessage('Não consegui carregar o calendário 2027.'));
    const stopStandings = onValue(ref(database, `tournaments/superliga/${SEASON}/regular/standings`), (snapshot) => {
      setSuperligaPositions(makePositionMap(snapshot.val()));
    }, () => setSuperligaPositions({}));
    return () => { stopCopa(); stopRounds(); stopStandings(); };
  }, []);

  const eligible = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [players, memberships]);
  const eligibleById = useMemo(() => Object.fromEntries(eligible.map((player) => [player.uid, player])), [eligible]);
  const eligibleIds = useMemo(() => new Set(eligible.map((player) => player.uid)), [eligible]);
  const tournamentPlayers = useMemo(() => eligible.filter((player) => memberships[player.uid]?.tournaments?.supercopa === true), [eligible, memberships]);
  const acceptedIds = useMemo(() => new Set(participants.filter((uid) => eligibleIds.has(uid))), [participants, eligibleIds]);
  const groupNames = useMemo(() => groupLabels(Number(groupCount)), [groupCount]);
  const computedStandings = useMemo(() => calculateStandings(groups, groupRounds, superligaPositions), [groups, groupRounds, superligaPositions]);
  const canAdvance = normalizeSeasonStatus(seasonStatus) === 'em_andamento';
  const chosenSeries = seriesData[selectedSeries] || emptySeriesItem();
  const chosenPhase = chosenSeries.phases?.[selectedPhase] || { status: 0, matches: [] };

  function changeParticipants(uid) {
    setParticipants((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]);
    setGroups((current) => Object.fromEntries(Object.entries(current).map(([id, ids]) => [id, ids.filter((idValue) => idValue !== uid)])));
    setDrawPreview(null);
  }

  function changeGroupMember(uid) {
    if (!acceptedIds.has(uid)) { setMessage('Selecione o jogador como participante antes de incluí-lo em um grupo.'); return; }
    setGroups((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([id, ids]) => [id, ids.filter((idValue) => idValue !== uid)]));
      const key = `group${selectedGroup}`;
      const members = next[key] || [];
      next[key] = members.includes(uid) ? members.filter((idValue) => idValue !== uid) : [...members, uid];
      return next;
    });
    setDrawPreview(null);
  }

  function makeDrawPreview() {
    if (!Number.isInteger(Number(groupCount)) || Number(groupCount) < 2 || Number(groupCount) > 8) { setMessage('Use de 2 a 8 grupos.'); return; }
    if (participants.length < Number(groupCount) * 2) { setMessage('Para o sorteio, selecione ao menos dois participantes por grupo.'); return; }
    if (groupRounds.some((round) => round.status > 0)) { setMessage('Não é possível refazer o sorteio depois que uma rodada de grupos foi iniciada.'); return; }
    if (data.draw?.confirmedAt) {
      Alert.alert('Refazer sorteio?', 'O sorteio atual está registrado. O novo resultado só substituirá o anterior quando você confirmar; o histórico anterior será preservado.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Gerar nova prévia', style: 'destructive', onPress: () => setDrawPreview(randomGroups(participants, Number(groupCount))) },
      ]);
      return;
    }
    setDrawPreview(randomGroups(participants, Number(groupCount)));
    setMessage('Prévia criada. Revise a composição e confirme para registrar o sorteio.');
  }

  function generateGroupRounds() {
    const drawGroups = drawPreview || groups;
    if (!groupNames.some((name) => (drawGroups[name.key] || []).length >= 2)) { setMessage('Distribua pelo menos dois jogadores em um grupo antes de montar a tabela.'); return; }
    const schedule = generateRoundRobin(drawGroups, groupNames);
    setGroupRounds(schedule.map((round, index) => ({ id: `round${index + 1}`, label: `Rodada ${index + 1}`, status: 0, sourceRoundId: '', matches: round })));
    setMessage(`${schedule.length} rodada(s) de grupo foram montadas em prévia. Salve para registrar.`);
  }

  function updateGroupRound(index, field, value) {
    setGroupRounds((current) => current.map((round, roundIndex) => roundIndex === index ? { ...round, [field]: value } : round));
  }

  function updateGroupMatch(roundIndex, matchIndex, field, value) {
    setGroupRounds((current) => current.map((round, index) => index === roundIndex ? { ...round, matches: round.matches.map((match, itemIndex) => itemIndex === matchIndex ? { ...match, [field]: value, scoreSource: 'manual' } : match) } : round));
  }

  function recalculateGroupRound(roundIndex) {
    const groupRound = groupRounds[roundIndex];
    const sourceRound = rounds.find((round) => round.id === groupRound?.sourceRoundId);
    if (!sourceRound) { setMessage('Selecione uma rodada da temporada antes de importar os placares.'); return; }
    if (Number(sourceRound.status) !== 2) { setMessage('A rodada vinculada ainda não está concluída.'); return; }
    const matches = groupRound.matches.map((match) => ({
      ...match,
      player1Score: calculateUserRoundScore(sourceRound, match.player1Id),
      player2Score: calculateUserRoundScore(sourceRound, match.player2Id),
      scoreSource: 'seasonRound',
      sourceRoundId: sourceRound.id,
      calculatedAt: Date.now(),
    }));
    setGroupRounds((current) => current.map((round, index) => index === roundIndex ? { ...round, matches } : round));
    setMessage(`Placares importados da Rodada ${sourceRound.roundNumber || sourceRound.seqNumber || '2027'}. Revise antes de concluir a jornada.`);
  }

  function assignSeries(uid, seriesId) {
    setSeriesData((current) => {
      const next = normalizeSeries(current);
      SERIES.forEach(({ id }) => { next[id].participants = next[id].participants.filter((participantId) => participantId !== uid); });
      if (seriesId) next[seriesId].participants.push(uid);
      return next;
    });
  }

  function assignPot(uid, potId) {
    setSeriesData((current) => {
      const next = normalizeSeries(current);
      const series = next[selectedSeries];
      series.pots = { pot1: (series.pots?.pot1 || []).filter((id) => id !== uid), pot2: (series.pots?.pot2 || []).filter((id) => id !== uid) };
      if (potId) series.pots[potId].push(uid);
      return next;
    });
  }

  function chooseSeriesChampion(seriesId, uid) {
    setChampions((current) => {
      const nextUid = current[seriesId] === uid ? '' : uid;
      return { ...current, [seriesId]: nextUid, ...(seriesId === 'A' ? { winner: nextUid } : {}) };
    });
  }

  function updateBracketMatch(matchIndex, field, value) {
    setSeriesData((current) => {
      const next = normalizeSeries(current);
      const phaseData = next[selectedSeries].phases[selectedPhase] || { status: 0, matches: [] };
      phaseData.matches = phaseData.matches.map((match, index) => index === matchIndex ? { ...match, [field]: value } : match);
      next[selectedSeries].phases[selectedPhase] = phaseData;
      return next;
    });
  }

  function changeBracketStatus(status) {
    if (status > 0 && !canAdvance) { setMessage('A temporada precisa estar Em Andamento para iniciar ou encerrar fases.'); return; }
    setSeriesData((current) => {
      const next = normalizeSeries(current);
      next[selectedSeries].phases[selectedPhase] = { ...(next[selectedSeries].phases[selectedPhase] || {}), status };
      return next;
    });
  }

  function addBracketMatch() {
    setSeriesData((current) => {
      const next = normalizeSeries(current);
      const phaseData = next[selectedSeries].phases[selectedPhase] || { status: 0, matches: [] };
      phaseData.matches = [...phaseData.matches, blankKnockoutMatch()];
      next[selectedSeries].phases[selectedPhase] = phaseData;
      return next;
    });
  }

  function removeBracketMatch(matchIndex) {
    setSeriesData((current) => {
      const next = normalizeSeries(current);
      const phaseData = next[selectedSeries].phases[selectedPhase] || { status: 0, matches: [] };
      phaseData.matches = phaseData.matches.filter((_, index) => index !== matchIndex);
      next[selectedSeries].phases[selectedPhase] = phaseData;
      return next;
    });
  }

  async function saveCopa() {
    if (!adminUid || saving) return;
    const count = Number(groupCount);
    if (!Number.isInteger(count) || count < 2 || count > 8) { setMessage('Use de 2 a 8 grupos.'); return; }
    if (participants.some((uid) => !eligibleIds.has(uid))) { setMessage('A lista tem jogador que não está apto nesta temporada. Atualize a seleção.'); return; }
    const finalGroups = drawPreview || groups;
    const finalGroupRounds = drawPreview ? [] : groupRounds;
    const groupMembers = groupNames.flatMap(({ key }) => finalGroups[key] || []);
    if (new Set(groupMembers).size !== groupMembers.length) { setMessage('Um jogador não pode aparecer em mais de um grupo.'); return; }
    if (groupMembers.some((uid) => !acceptedIds.has(uid))) { setMessage('Todos os integrantes dos grupos precisam estar inscritos na Supercopa.'); return; }
    if (editionStatus > 0 && participants.some((uid) => !groupMembers.includes(uid))) { setMessage('Distribua todos os participantes em um grupo antes de iniciar a Supercopa.'); return; }
    if (editionStatus > 0 && groupNames.some(({ key }) => (finalGroups[key] || []).length < 2)) { setMessage('Cada grupo ativo precisa ter ao menos dois participantes.'); return; }
    if (activeStage === 'finished' && editionStatus !== 2) { setMessage('Marque a edição como Concluída para publicar a fase encerrada.'); return; }
    if (editionStatus === 2 && activeStage !== 'finished') { setMessage('Selecione a fase Encerrada antes de concluir a edição.'); return; }
    if (editionStatus === 2 && !champions.A) { setMessage('Registre o campeão da Série A antes de concluir a Supercopa.'); return; }
    if ([champions.A, champions.B, champions.C, champions.winner, champions.runnerUp, champions.third].some((uid) => uid && !eligibleIds.has(uid))) { setMessage('O pódio e os campeões precisam ser participantes aptos da temporada.'); return; }
    if (new Set([champions.winner, champions.runnerUp, champions.third].filter(Boolean)).size < [champions.winner, champions.runnerUp, champions.third].filter(Boolean).length) { setMessage('Campeão, vice e 3º lugar precisam ser jogadores diferentes.'); return; }
    if (drawPreview && Object.values(drawPreview).flat().length !== participants.length) { setMessage('A prévia do sorteio não inclui todos os participantes.'); return; }
    if (finalGroupRounds.some((round) => round.status === 2 && round.matches.some((match) => !Number.isFinite(Number(match.player1Score)) || !Number.isFinite(Number(match.player2Score)) || match.player1Score === '' || match.player2Score === ''))) { setMessage('Complete os placares de todos os confrontos antes de encerrar a rodada de grupos.'); return; }
    if (finalGroupRounds.some((round) => round.status > 0 && !round.sourceRoundId)) { setMessage('Vincule cada rodada ativa de grupos a uma rodada do calendário 2027.'); return; }
    if (editionStatus > 0 && !canAdvance) { setMessage('A temporada precisa estar Em Andamento para iniciar ou atualizar a Supercopa.'); return; }
    if (PHASES.some(({ id }) => SERIES.some(({ id: seriesId }) => seriesData[seriesId]?.phases?.[id]?.status > 0)) && !canAdvance) { setMessage('A temporada precisa estar Em Andamento para iniciar ou atualizar fases eliminatórias.'); return; }
    if (PHASES.some(({ id }) => SERIES.some(({ id: seriesId }) => seriesData[seriesId]?.phases?.[id]?.status > 0)) && !TIE_BREAKS.some(({ id }) => id === tieBreak)) { setMessage('Defina a regra para desempate no agregado antes de publicar as chaves.'); return; }
    if (SERIES.some(({ id }) => seriesData[id]?.participants?.some((uid) => !eligibleIds.has(uid)))) { setMessage('As séries contêm jogadores que não estão aptos na temporada.'); return; }
    const incompletePots = SERIES.some(({ id }) => PHASES.some(({ id: phaseId }) => seriesData[id]?.phases?.[phaseId]?.status > 0) && (() => { const series = seriesData[id] || emptySeriesItem(); const assignedPots = [...(series.pots?.pot1 || []), ...(series.pots?.pot2 || [])]; return series.participants.length < 2 || assignedPots.length !== series.participants.length || new Set(assignedPots).size !== assignedPots.length || series.participants.some((uid) => !assignedPots.includes(uid)); })());
    if (incompletePots) { setMessage('Distribua todos os classificados em um único pote antes de iniciar a chave.'); return; }
    if (['B', 'C'].some((id) => seriesData[id]?.phases?.thirdPlace?.status > 0)) { setMessage('A disputa de 3º lugar é registrada somente na Série A da Supercopa.'); return; }
    const invalidKnockout = SERIES.some(({ id: seriesId }) => PHASES.some(({ id: phaseId }) => {
      const phase = seriesData[seriesId]?.phases?.[phaseId];
      return phase?.status > 0 && (!(phase.matches || []).length || (phase.matches || []).some((match) => !match.player1Id || !match.player2Id || match.player1Id === match.player2Id || !match.roundIdIda || !match.roundIdVolta || (phase.status === 2 && (!['score1Ida', 'score2Ida', 'score1Volta', 'score2Volta'].every((key) => match[key] !== '' && match[key] !== undefined && match[key] !== null) || (aggregate(match).tied && !match.winnerId)))));
    }));
    if (invalidKnockout) { setMessage('Antes de concluir uma fase, preencha os participantes e os quatro placares de cada confronto.'); return; }

    const now = Date.now();
    const standings = calculateStandings(finalGroups, finalGroupRounds, superligaPositions);
    const next = {
      ...data,
      status: editionStatus,
      config: { ...(data.config || {}), groupCount: count, activeStage, aggregateTieBreak: tieBreak || null },
      participants,
      groups: { ...Object.fromEntries(groupNames.map(({ key }) => [key, finalGroups[key] || []])), status: editionStatus },
      series: sanitizeSeries(seriesData),
      groupRounds: finalGroupRounds.map((round) => ({ ...round, matches: round.matches.map(sanitizeGroupMatch) })),
      standings,
      champions,
      updatedAt: now,
      updatedBy: adminUid,
      ...(drawPreview ? { draw: { ...(data.draw || {}), result: drawPreview, confirmedAt: now, confirmedBy: adminUid, history: [...asArray(data.draw?.history), ...(data.draw?.result ? [{ result: data.draw.result, confirmedAt: data.draw.confirmedAt, confirmedBy: data.draw.confirmedBy }] : [])] } } : {}),
    };
    setSaving(true); setMessage('');
    try {
      const updates = { [PATH]: next };
      if (Object.keys(data).length) updates[`backups/tournaments/supercopa/${SEASON}/${now}`] = { reason: 'admin-config-update', createdAt: now, createdBy: adminUid, data };
      await update(ref(database), updates);
      setDrawPreview(null);
      setMessage('Configuração da Supercopa salva com backup da versão anterior.');
    } catch {
      setMessage('Não consegui salvar. Confira a conexão e as regras do Realtime Database.');
    } finally { setSaving(false); }
  }

  if (loading || loadingRoster) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.copyMuted}>Carregando participantes e edição…</Text></View>;
  if (rosterError) return <Notice error={rosterError} />;

  const drawResult = drawPreview || data.draw?.result || null;
  const assigned = new Set(groupNames.flatMap(({ key }) => groups[key] || []));
  const groupRoundMatches = groupRounds.reduce((countValue, round) => countValue + round.matches.length, 0);

  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Supercopa 2027</Text><Text style={styles.copy}>Grupos, sorteio, Séries A/B/C e eliminatórias configuráveis.</Text></View><View style={styles.statusPill}><Text style={styles.statusPillText}>{STATUS.find((item) => item.id === editionStatus)?.label || 'A iniciar'}</Text></View></View>
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') && styles.error]}>{message}</Text>}
    <View style={styles.sectionTabs}>{SECTIONS.map((item) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: section === item.id }} onPress={() => setSection(item.id)} style={[styles.sectionTab, section === item.id && styles.sectionTabSelected]}><Text style={[styles.sectionTabText, section === item.id && styles.sectionTabTextSelected]}>{item.label}</Text></Pressable>)}</View>

    {section === 'overview' && <>
      <Panel title="Estado da edição" detail="A edição pode ser preparada antes da temporada; publicação e andamento respeitam o status anual.">
        <StatusChoices value={editionStatus} onChange={(value) => { if (value > 0 && !canAdvance) setMessage('A temporada precisa estar Em Andamento para iniciar a Supercopa.'); else setEditionStatus(value); }} />
        <Text style={styles.fieldLabel}>FASE VISÍVEL POR PADRÃO</Text><ChoiceRow options={[['groups', 'Fase de grupos'], ['knockout', 'Mata-mata'], ['finished', 'Encerrada']]} value={activeStage} onChange={(value) => { setActiveStage(value); if (value === 'finished') setEditionStatus(2); }} />
        <Text style={styles.gateNote}>Temporada: {seasonLabel(seasonStatus)} · {eligible.length} jogadores aptos · {tournamentPlayers.length} inscritos na Supercopa</Text>
      </Panel>
      <View style={styles.metrics}><Metric label="Participantes" value={participants.length} /><Metric label="Grupos" value={groupCount} /><Metric label="Rodadas de grupo" value={groupRounds.length} /><Metric label="Confrontos" value={groupRoundMatches} /></View>
      <Panel title="Critérios da edição" detail="A fase de grupos é todos contra todos. Pontos: 3 por vitória, 1 por empate.">
        <Text style={styles.ruleText}>Desempate: pontos no grupo → vitórias → saldo de pontos → pontos feitos → posição na Superliga após a última rodada concluída.</Text>
        <Text style={styles.fieldLabel}>DESEMPATE NO AGREGADO DO MATA-MATA</Text><ChoiceRow options={TIE_BREAKS.map(({ id, label }) => [id, label])} value={tieBreak} onChange={setTieBreak} />
        <Text style={styles.hint}>O plano não fixa esse último critério. Ele precisa ser definido antes da publicação das chaves.</Text>
      </Panel>
      {!canAdvance && <Notice text="Configuração permitida. A temporada precisa estar Em Andamento para iniciar ou publicar fases." />}
    </>}

    {section === 'groups' && <>
      <Panel title="Participantes" detail="A lista só inclui jogadores aptos. A inscrição na Supercopa é marcada na aba Jogadores.">
        <View style={styles.fieldRow}><Field label="NÚMERO DE GRUPOS" value={groupCount} onChangeText={(value) => setGroupCount(value.replace(/[^0-9]/g, ''))} compact /><Text style={styles.inlineHint}>Padrão inicial: 4 grupos · limite de 2 a 8.</Text></View>
        <View style={styles.playerList}>{eligible.map((player) => { const selected = participants.includes(player.uid); const subscribed = memberships[player.uid]?.tournaments?.supercopa === true; return <Pressable key={player.uid} onPress={() => { if (!subscribed) { setMessage(`${player.name} precisa ser inscrito na aba Jogadores antes de entrar na Supercopa.`); return; } changeParticipants(player.uid); }} style={[styles.playerLine, !subscribed && styles.mutedLine]}>{player.shieldUrl ? <Image source={{ uri: player.shieldUrl }} style={styles.crest} resizeMode="contain" /> : <MaterialDesignIcons name="account-circle-outline" size={26} color="#AFC5DD" />}<View style={styles.flex}><Text style={styles.playerName}>{player.name}</Text><Text style={styles.copyMuted}>{subscribed ? 'Inscrito na Supercopa' : 'Não inscrito nesta competição'}</Text></View><MaterialDesignIcons name={selected ? 'checkbox-marked-circle' : subscribed ? 'checkbox-blank-circle-outline' : 'lock-outline'} size={19} color={selected ? '#B9F276' : '#8299B2'} /></Pressable>; })}</View>
      </Panel>
      <Panel title="Composição dos grupos" detail="Edite manualmente ou gere uma prévia aleatória para conferência antes de registrar.">
        <View style={styles.choiceRow}>{groupNames.map((group, index) => <Choice key={group.key} label={group.label} selected={selectedGroup === index + 1} onPress={() => setSelectedGroup(index + 1)} />)}</View>
        <Text style={styles.subheading}>Adicionar ou remover do {groupNames[selectedGroup - 1]?.label || 'grupo'}</Text>
        <View style={styles.playerList}>{eligible.filter((player) => acceptedIds.has(player.uid)).map((player) => { const inGroup = (groups[`group${selectedGroup}`] || []).includes(player.uid); const elsewhere = assigned.has(player.uid) && !inGroup; return <Pressable key={player.uid} disabled={elsewhere} onPress={() => changeGroupMember(player.uid)} style={[styles.playerLine, elsewhere && styles.mutedLine]}><View style={styles.flex}><Text style={styles.playerName}>{player.name}</Text><Text style={styles.copyMuted}>{elsewhere ? `Já está em ${groupFor(groups, player.uid)}` : inGroup ? 'Incluído' : 'Disponível'}</Text></View><MaterialDesignIcons name={inGroup ? 'check-circle' : elsewhere ? 'lock-outline' : 'plus-circle-outline'} size={19} color={inGroup ? '#B9F276' : '#8299B2'} /></Pressable>; })}</View>
        {groupNames.map((group) => <View key={group.key} style={styles.ruleRow}><Text style={styles.ruleLabel}>{group.label}</Text><Text style={styles.ruleValue}>{(drawResult?.[group.key] || groups[group.key] || []).map((uid) => eligibleById[uid]?.name || 'Jogador').join(' · ') || 'Sem participantes'}</Text></View>)}
        <View style={styles.actionRow}><Action label={drawPreview ? 'Gerar outra prévia' : 'Gerar prévia do sorteio'} icon="shuffle-variant" onPress={makeDrawPreview} /><Action label="Limpar prévia" icon="close" onPress={() => setDrawPreview(null)} secondary /></View>
        {drawPreview && <Text style={styles.success}>Prévia em revisão. O resultado persistido não muda até salvar.</Text>}
        <Text style={styles.drawInfo}>{data.draw?.confirmedAt ? `Último sorteio registrado em ${formatTimestamp(data.draw.confirmedAt)} por ${data.draw.confirmedBy || 'admin'}.` : 'Nenhum sorteio foi registrado ainda.'}</Text>
      </Panel>
    </>}

    {section === 'groupRounds' && <>
      <Panel title="Calendário de todos contra todos" detail="A tabela é criada a partir dos grupos. Cada rodada da Supercopa pode usar uma rodada do calendário 2027 como fonte de pontuação.">
        <View style={styles.actionRow}><Action label="Gerar prévia do calendário" icon="calendar-plus" onPress={generateGroupRounds} /><Action label="Adicionar rodada vazia" icon="plus" onPress={() => setGroupRounds((current) => [...current, { id: `round${current.length + 1}`, label: `Rodada ${current.length + 1}`, status: 0, sourceRoundId: '', matches: [] }])} secondary /></View>
        {!groupRounds.length ? <Empty text="Ainda não há rodadas de grupo. Distribua os participantes e gere o todos contra todos." /> : groupRounds.map((round, roundIndex) => <Panel key={round.id} title={round.label || `Rodada ${roundIndex + 1}`} detail={`${round.matches.length} confronto(s) · fonte: ${rounds.find((item) => item.id === round.sourceRoundId)?.name || rounds.find((item) => item.id === round.sourceRoundId)?.roundNumber ? `Rodada ${rounds.find((item) => item.id === round.sourceRoundId)?.roundNumber}` : 'a definir'}`} nested>
          <ChoiceRow options={STATUS.map(({ id, label }) => [String(id), label])} value={String(round.status || 0)} onChange={(value) => updateGroupRound(roundIndex, 'status', Number(value))} />
          <Text style={styles.fieldLabel}>RODADA 2027 VINCULADA</Text><ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>{rounds.map((item) => <Choice key={item.id} label={`Rodada ${item.roundNumber || item.seqNumber || '—'}`} selected={round.sourceRoundId === item.id} onPress={() => updateGroupRound(roundIndex, 'sourceRoundId', item.id)} compact />)}</ScrollView>
          <Action label="Importar pontuação da rodada vinculada" icon="cloud-download-outline" onPress={() => recalculateGroupRound(roundIndex)} secondary />
          {round.matches.map((match, matchIndex) => <View key={match.id || matchIndex} style={styles.matchRow}><View style={styles.matchHead}><Text style={styles.playerName}>{groupLabel(match.groupId, Number(groupCount))}</Text><Text style={styles.copyMuted}>{eligibleById[match.player1Id]?.name || 'A definir'} × {eligibleById[match.player2Id]?.name || 'A definir'}</Text></View><View style={styles.scoreInputs}><Field label="PLACAR J1" value={String(match.player1Score ?? '')} onChangeText={(value) => updateGroupMatch(roundIndex, matchIndex, 'player1Score', value.replace(/[^0-9-]/g, ''))} compact /><Text style={styles.vs}>×</Text><Field label="PLACAR J2" value={String(match.player2Score ?? '')} onChangeText={(value) => updateGroupMatch(roundIndex, matchIndex, 'player2Score', value.replace(/[^0-9-]/g, ''))} compact /></View><Text style={styles.hint}>Se vazio, o placar pode ser inserido manualmente antes de concluir a rodada.</Text></View>)}
        </Panel>)}
      </Panel>
      <Panel title="Classificação atual" detail="A tabela é derivada dos placares cadastrados das rodadas concluídas.">
        {groupNames.map((group) => <View key={group.key}><Text style={styles.subheading}>{group.label}</Text>{(computedStandings[group.key] || []).map((row, index) => <View key={row.uid} style={styles.standingRow}><Text style={styles.rank}>{index + 1}</Text><Text numberOfLines={1} style={styles.flexText}>{eligibleById[row.uid]?.name || 'Jogador'}</Text><Text style={styles.stat}>{row.points} pts</Text><Text style={styles.stat}>{row.wins}V</Text><Text style={styles.stat}>{row.goalDifference >= 0 ? '+' : ''}{row.goalDifference}</Text></View>)}</View>)}
      </Panel>
    </>}

    {section === 'pots' && <>
      <Panel title="Classificação e destino" detail="Escolha a série de cada classificado; um participante não pode estar em mais de uma série.">
        <View style={styles.subTabs}>{SERIES.map((item) => <Choice key={item.id} label={item.label} selected={selectedSeries === item.id} onPress={() => setSelectedSeries(item.id)} />)}</View>
        {groupNames.map((group) => <View key={group.key}><Text style={styles.subheading}>{group.label}</Text>{(computedStandings[group.key] || []).map((row, index) => <View key={row.uid} style={styles.assignmentRow}><Text numberOfLines={1} style={styles.flexText}>{index + 1}. {eligibleById[row.uid]?.name || 'Jogador'}</Text><View style={styles.miniChoices}>{SERIES.map(({ id }) => <Pressable key={id} onPress={() => assignSeries(row.uid, (seriesData[id]?.participants || []).includes(row.uid) ? '' : id)} style={[styles.miniChoice, seriesData[id]?.participants?.includes(row.uid) && styles.miniChoiceSelected]}><Text style={[styles.miniChoiceText, seriesData[id]?.participants?.includes(row.uid) && styles.miniChoiceTextSelected]}>{id}</Text></Pressable>)}</View></View>)}</View>)}
      </Panel>
      <Panel title={`Potes · ${SERIES.find((item) => item.id === selectedSeries)?.label}`} detail="A alocação fica visível para revisão antes do sorteio de cada chave.">
        {['pot1', 'pot2'].map((potId) => <View key={potId}><Text style={styles.subheading}>{potId === 'pot1' ? 'Pote 1' : 'Pote 2'}</Text>{(chosenSeries.participants || []).map((uid) => { const inPot = chosenSeries.pots?.[potId]?.includes(uid); const other = chosenSeries.pots?.[potId === 'pot1' ? 'pot2' : 'pot1']?.includes(uid); return <Pressable key={uid} disabled={other} onPress={() => assignPot(uid, inPot ? '' : potId)} style={[styles.playerLine, other && styles.mutedLine]}><Text style={styles.flexText}>{eligibleById[uid]?.name || 'Jogador'}</Text><MaterialDesignIcons name={inPot ? 'check-circle' : other ? 'lock-outline' : 'circle-outline'} size={18} color={inPot ? '#B9F276' : '#8299B2'} /></Pressable>; })}</View>)}
      </Panel>
    </>}

    {section === 'knockout' && <>
      <Panel title="Mata-mata por série" detail="Quartas, semifinais e final usam ida e volta. O 3º lugar da Supercopa também é configurado aqui.">
        <View style={styles.subTabs}>{SERIES.map((item) => <Choice key={item.id} label={item.label} selected={selectedSeries === item.id} onPress={() => setSelectedSeries(item.id)} />)}</View>
        <View style={styles.choiceRow}>{PHASES.filter((item) => item.id !== 'thirdPlace' || selectedSeries === 'A').map((item) => <Choice key={item.id} label={item.label} selected={selectedPhase === item.id} onPress={() => setSelectedPhase(item.id)} />)}</View>
        <Text style={styles.fieldLabel}>STATUS DA FASE</Text><StatusChoices value={chosenPhase.status || 0} onChange={changeBracketStatus} />
        <View style={styles.actionRow}><Action label="Adicionar confronto" icon="plus" onPress={addBracketMatch} secondary /><Action label="Criar confrontos padrão" icon="auto-fix" onPress={() => setSeriesData((current) => setDefaultBracketMatches(current, selectedSeries, selectedPhase))} secondary /></View>
        {(chosenPhase.matches || []).map((match, matchIndex) => <View key={match.id || matchIndex} style={styles.bracketMatch}>
          <View style={styles.matchHead}><Text style={styles.subheading}>Confronto {matchIndex + 1} · ida e volta</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remover confronto ${matchIndex + 1}`} onPress={() => removeBracketMatch(matchIndex)}><MaterialDesignIcons name="delete-outline" size={17} color="#FF9E91" /></Pressable></View>
          <View style={styles.choiceRow}>{(chosenSeries.participants || []).map((uid) => <Choice key={`home-${uid}`} label={eligibleById[uid]?.name || 'Jogador'} selected={match.player1Id === uid} onPress={() => updateBracketMatch(matchIndex, 'player1Id', uid)} compact />)}</View>
          <Text style={styles.vs}>×</Text>
          <View style={styles.choiceRow}>{(chosenSeries.participants || []).filter((uid) => uid !== match.player1Id).map((uid) => <Choice key={`away-${uid}`} label={eligibleById[uid]?.name || 'Jogador'} selected={match.player2Id === uid} onPress={() => updateBracketMatch(matchIndex, 'player2Id', uid)} compact />)}</View>
          <View style={styles.legsRow}><LegScore label="IDA" first={match.score1Ida} second={match.score2Ida} onChange={(field, value) => updateBracketMatch(matchIndex, field, value)} /><LegScore label="VOLTA" first={match.score1Volta} second={match.score2Volta} onChange={(field, value) => updateBracketMatch(matchIndex, field, value)} /></View>
          <RoundSelector label="RODADA DA IDA" value={match.roundIdIda} rounds={rounds} onSelect={(roundId) => updateBracketMatch(matchIndex, 'roundIdIda', roundId)} /><RoundSelector label="RODADA DA VOLTA" value={match.roundIdVolta} rounds={rounds} onSelect={(roundId) => updateBracketMatch(matchIndex, 'roundIdVolta', roundId)} />
          <Text style={styles.aggregate}>Agregado: {aggregate(match).text}</Text>
          {aggregate(match).tied && <><Text style={styles.hint}>Agregado empatado · critério: {TIE_BREAKS.find((item) => item.id === tieBreak)?.label || 'a definir'}</Text><View style={styles.choiceRow}>{[match.player1Id, match.player2Id].filter(Boolean).map((uid) => <Choice key={`winner-${uid}`} label={`Vence ${eligibleById[uid]?.name || 'jogador'}`} selected={match.winnerId === uid} onPress={() => updateBracketMatch(matchIndex, 'winnerId', uid)} compact />)}</View></>}
        </View>)}
        <Text style={styles.fieldLabel}>CAMPEÃO DA SÉRIE</Text><View style={styles.choiceRow}>{(chosenSeries.participants || []).map((uid) => <Choice key={uid} label={eligibleById[uid]?.name || 'Jogador'} selected={champions[selectedSeries] === uid} onPress={() => chooseSeriesChampion(selectedSeries, uid)} compact />)}</View>
      </Panel>
    </>}

    {section === 'results' && <>
      <Panel title="Campeões e pódio" detail="Registre os resultados das séries depois de finalizar as respectivas fases.">
        {SERIES.map(({ id, label }) => <View key={id} style={styles.ruleRow}><Text style={styles.ruleLabel}>{label}</Text><Text style={styles.ruleValue}>{eligibleById[champions[id]]?.name || 'Campeão a definir'}</Text></View>)}
        <Text style={styles.subheading}>Pódio da Supercopa · Série A</Text>
        {['winner', 'runnerUp', 'third'].map((key) => <View key={key}><Text style={styles.fieldLabel}>{({ winner: 'CAMPEÃO', runnerUp: 'VICE-CAMPEÃO', third: '3º LUGAR' })[key]}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{(seriesData.A?.participants || []).map((uid) => <Choice key={uid} label={eligibleById[uid]?.name || 'Jogador'} selected={champions[key] === uid} onPress={() => key === 'winner' ? chooseSeriesChampion('A', uid) : setChampions((current) => ({ ...current, [key]: current[key] === uid ? '' : uid }))} compact />)}</ScrollView></View>)}
        <Text style={styles.hint}>A disputa de 3º lugar precisa ser cadastrada na fase eliminatória para este campo poder ser confirmado.</Text>
      </Panel>
    </>}

    {!canAdvance && <Text style={styles.gateNote}>Temporada {seasonLabel(seasonStatus)}: você pode preparar a edição, mas não iniciar nem publicar fases.</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={saveCopa} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#0A2345" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#0A2345" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar configuração da Supercopa'}</Text></Pressable>
  </View>;
}

function Panel({ title, detail, children, nested = false }) { return <View style={[styles.panel, nested && styles.panelNested]}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.panelBody}>{children}</View></View>; }
function Field({ label, value, onChangeText, compact = false, placeholder }) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8199B3" keyboardType="number-pad" style={styles.input} /></View>; }
function Choice({ label, selected, onPress, compact = false }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected, compact && styles.choiceCompact]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function ChoiceRow({ options, value, onChange }) { return <View style={styles.choiceRow}>{options.map(([id, label]) => <Choice key={id} label={label} selected={value === id} onPress={() => onChange(id)} />)}</View>; }
function StatusChoices({ value, onChange }) { return <ChoiceRow options={STATUS.map(({ id, label }) => [String(id), label])} value={String(value)} onChange={(next) => onChange(Number(next))} />; }
function Action({ label, icon, onPress, secondary = false }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><MaterialDesignIcons name={icon} size={15} color={secondary ? '#C6D6E6' : '#092447'} /><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>; }
function Metric({ label, value }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Notice({ text, error }) { return <View style={styles.notice}><MaterialDesignIcons name={error ? 'cloud-alert-outline' : 'information-outline'} size={19} color={error ? '#FFB5A9' : '#FFD987'} /><Text style={[styles.noticeText, error && styles.error]}>{error || text}</Text></View>; }
function Empty({ text }) { return <View style={styles.empty}><Text style={styles.copyMuted}>{text}</Text></View>; }
function LegScore({ label, first, second, onChange }) { return <View style={styles.leg}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.scoreInputs}><TextInput value={String(first ?? '')} onChangeText={(value) => onChange('score1' + (label === 'IDA' ? 'Ida' : 'Volta'), value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.scoreInput} placeholder="J1" placeholderTextColor="#8299B2" /><Text style={styles.vs}>×</Text><TextInput value={String(second ?? '')} onChangeText={(value) => onChange('score2' + (label === 'IDA' ? 'Ida' : 'Volta'), value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.scoreInput} placeholder="J2" placeholderTextColor="#8299B2" /></View></View>; }
function RoundSelector({ label, value, rounds, onSelect }) { return <View><Text style={styles.fieldLabel}>{label}</Text><ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>{rounds.map((round) => <Choice key={round.id} label={`Rodada ${round.roundNumber || round.seqNumber || '—'}`} selected={value === round.id} onPress={() => onSelect(round.id)} compact />)}</ScrollView></View>; }

function emptySeriesItem() { return { participants: [], pots: { pot1: [], pot2: [] }, phases: {} }; }
function emptySeries() { return Object.fromEntries(SERIES.map(({ id }) => [id, emptySeriesItem()])); }
function blankKnockoutMatch() { return { id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, player1Id: '', player2Id: '', score1Ida: '', score2Ida: '', score1Volta: '', score2Volta: '', roundIdIda: '', roundIdVolta: '', winnerId: '' }; }
function normalizeSeries(value) { const next = emptySeries(); SERIES.forEach(({ id }) => { const old = value?.[id] || {}; next[id] = { ...emptySeriesItem(), ...old, participants: asIds(old.participants), pots: { pot1: asIds(old.pots?.pot1), pot2: asIds(old.pots?.pot2) }, phases: { ...(old.phases || {}) } }; PHASES.forEach(({ id: phaseId }) => { const phase = next[id].phases[phaseId]; if (phase) next[id].phases[phaseId] = { ...phase, matches: asArray(phase.matches) }; }); }); return next; }
function sanitizeSeries(value) { const next = normalizeSeries(value); SERIES.forEach(({ id }) => { next[id].participants = asIds(next[id].participants); next[id].pots = { pot1: asIds(next[id].pots.pot1), pot2: asIds(next[id].pots.pot2) }; PHASES.forEach(({ id: phaseId }) => { if (next[id].phases[phaseId]) next[id].phases[phaseId].matches = asArray(next[id].phases[phaseId].matches); }); }); return next; }
function setDefaultBracketMatches(value, seriesId, phaseId) { const next = normalizeSeries(value); const count = PHASES.find(({ id }) => id === phaseId)?.count || 1; next[seriesId].phases[phaseId] = { ...(next[seriesId].phases[phaseId] || {}), status: next[seriesId].phases[phaseId]?.status || 0, matches: Array.from({ length: count }, (_, index) => next[seriesId].phases[phaseId]?.matches?.[index] || blankKnockoutMatch()) }; return next; }
function normalizeGroups(value, count) { const groups = {}; groupLabels(count).forEach(({ key }) => { groups[key] = asIds(value[key]); }); return groups; }
function normalizeRounds(value) { const entries = Array.isArray(value) ? value.map((round, index) => [round?.id || `round${index + 1}`, round]) : Object.entries(value || {}); return entries.map(([id, round]) => ({ id, ...round, status: Number(round.status || 0), matches: asArray(round.matches).map((match) => ({ ...match, player1Score: match.player1Score === undefined ? '' : String(match.player1Score), player2Score: match.player2Score === undefined ? '' : String(match.player2Score) })) })); }
function sanitizeGroupMatch(match) { return { ...match, player1Score: match.player1Score === '' ? null : Number(match.player1Score), player2Score: match.player2Score === '' ? null : Number(match.player2Score) }; }
function groupLabels(count) { return Array.from({ length: Math.max(0, Math.min(8, count || 4)) }, (_, index) => ({ key: `group${index + 1}`, label: `Grupo ${String.fromCharCode(65 + index)}` })); }
function groupLabel(key, count) { return groupLabels(count).find((group) => group.key === key)?.label || 'Grupo'; }
function groupFor(groups, uid) { const entry = Object.entries(groups).find(([, members]) => members.includes(uid)); return entry ? groupLabel(entry[0], 8) : 'outro grupo'; }
function asIds(value) { if (Array.isArray(value)) return value.map((entry) => typeof entry === 'string' ? entry : entry?.uid || entry?.playerId).filter(Boolean); return Object.entries(value || {}).filter(([, include]) => include !== false && include !== null).map(([uid]) => uid); }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }
function randomGroups(participants, count) { const shuffled = [...participants]; for (let index = shuffled.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]; } const groups = Object.fromEntries(groupLabels(count).map(({ key }) => [key, []])); shuffled.forEach((uid, index) => { groups[`group${(index % count) + 1}`].push(uid); }); return groups; }
function generateRoundRobin(groups, groupNames) { const schedules = groupNames.map(({ key }) => ({ key, players: [...(groups[key] || [])] })).filter(({ players }) => players.length >= 2).map(({ key, players }) => { const rotation = [...players]; if (rotation.length % 2) rotation.push(null); const rounds = []; for (let round = 0; round < rotation.length - 1; round += 1) { const matches = []; for (let index = 0; index < rotation.length / 2; index += 1) { const left = rotation[index]; const right = rotation[rotation.length - 1 - index]; if (left && right) matches.push({ id: `${key}-r${round + 1}-m${index + 1}`, groupId: key, player1Id: left, player2Id: right, player1Score: '', player2Score: '' }); } rounds.push(matches); rotation.splice(1, 0, rotation.pop()); } return rounds; }); const total = Math.max(0, ...schedules.map((schedule) => schedule.length)); return Array.from({ length: total }, (_, index) => schedules.flatMap((schedule) => schedule[index] || [])); }
function calculateStandings(groups, rounds, superligaPositions) { const result = {}; Object.entries(groups).forEach(([groupId, ids]) => { const table = Object.fromEntries(ids.map((uid) => [uid, { uid, games: 0, wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, superligaPosition: superligaPositions[uid] || 999 }])); rounds.filter((round) => round.status === 2).forEach((round) => round.matches.filter((match) => match.groupId === groupId && match.player1Score !== '' && match.player2Score !== '').forEach((match) => { const home = table[match.player1Id]; const away = table[match.player2Id]; if (!home || !away) return; const first = Number(match.player1Score); const second = Number(match.player2Score); home.games += 1; away.games += 1; home.goalsFor += first; home.goalsAgainst += second; away.goalsFor += second; away.goalsAgainst += first; if (first > second) { home.points += 3; home.wins += 1; away.losses += 1; } else if (first < second) { away.points += 3; away.wins += 1; home.losses += 1; } else { home.points += 1; away.points += 1; home.draws += 1; away.draws += 1; } })); const rows = Object.values(table).map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst })).sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.superligaPosition - b.superligaPosition); result[groupId] = Object.fromEntries(rows.map((row, index) => [row.uid, { ...row, position: index + 1 }])); }); return result; }
function makePositionMap(value) { const rows = Array.isArray(value) ? value : Object.entries(value || {}).map(([uid, row]) => ({ uid, ...(row || {}) })); return Object.fromEntries(rows.map((row, index) => [row.uid || row.playerId || row.userId || String(index), Number(row.position) || index + 1])); }
function calculateUserRoundScore(round, uid) {
  if (!round || !uid) return 0;
  let total = 0;
  let hasPrediction = false;
  asArray(round.matches).forEach((match) => {
    const result = match.finalResult;
    const prediction = match.predictions?.[uid];
    if (!result || !prediction || prediction.homeScore === '' || prediction.awayScore === '' || !Number.isFinite(Number(prediction.homeScore)) || !Number.isFinite(Number(prediction.awayScore))) return;
    hasPrediction = true;
    const standard = scorePrediction(result, prediction, prediction.isStarMatch === true);
    const wildcard = match.wildcardPredictions?.[uid];
    const wildcardScore = wildcard && wildcard.homeScore !== '' && wildcard.awayScore !== '' && Number.isFinite(Number(wildcard.homeScore)) && Number.isFinite(Number(wildcard.awayScore)) ? scorePrediction(result, wildcard, false) : null;
    total += wildcardScore === null ? standard : Math.max(standard, wildcardScore);
  });
  if (hasPrediction) total += calculateArtilheiroScore(round, uid);
  return total;
}
function scorePrediction(result, prediction, isStar) { const predictedHome = Number(prediction.homeScore); const predictedAway = Number(prediction.awayScore); const actualHome = Number(result.homeScore); const actualAway = Number(result.awayScore); let points = predictedHome === actualHome && predictedAway === actualAway ? 3 : Math.sign(predictedHome - predictedAway) === Math.sign(actualHome - actualAway) ? 1 : predictedHome === actualAway && predictedAway === actualHome ? -1 : 0; if (isStar) points *= 2; return points; }
function calculateArtilheiroScore(round, uid) {
  const choice = round.starPlayers?.[uid];
  const chosen = Array.isArray(choice?.players) ? choice.players : choice?.athleteId ? [{ id: choice.athleteId }] : [];
  if (!chosen.length) return 0;
  const captainId = String(choice.captainId || choice.athleteId || chosen[0]?.id || '');
  const metrics = chosen.map((player) => ({ id: String(player.id || player.athleteId || ''), ...goalMetrics(round.playerGoals?.[player.id || player.athleteId]) }));
  const totalGoals = metrics.reduce((sum, player) => sum + player.goals, 0);
  const captain = metrics.find((player) => player.id === captainId);
  const supportGoals = metrics.filter((player) => player.id !== captainId).reduce((sum, player) => sum + player.goals, 0);
  const strategy = choice.strategy || 'artilheiro';
  const captainPoints = !captain ? 0 : strategy === 'garcom' ? captain.goals + captain.assists : strategy === 'hatTrick' ? captain.goals >= 3 ? 8 + captain.goals - 3 : captain.goals : captain.goals * 2;
  const penalty = strategy === 'hatTrick' ? (totalGoals < 3 ? -3 : 0) : (totalGoals === 0 ? -1 : 0);
  return supportGoals + captainPoints + penalty;
}
function goalMetrics(value) { if (typeof value === 'number') return { goals: value, assists: 0 }; return { goals: Number(value?.count ?? value?.goals ?? value?.goalCount ?? 0), assists: Number(value?.assists ?? value?.assistsCount ?? value?.assistCount ?? 0) }; }
function aggregate(match) { const played = ['score1Ida', 'score2Ida', 'score1Volta', 'score2Volta'].every((key) => match[key] !== '' && match[key] !== null && match[key] !== undefined); if (!played) return { text: 'Aguardando placares', tied: false }; const first = Number(match.score1Ida) + Number(match.score1Volta); const second = Number(match.score2Ida) + Number(match.score2Volta); return { text: `${first} × ${second}`, tied: first === second }; }
function formatTimestamp(value) { return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Manaus', dateStyle: 'short', timeStyle: 'short' }); }
function normalizeSeasonStatus(value) { const status = String(value || '').toLowerCase().replace(/[ -]/g, '_'); return ({ active: 'em_andamento', open: 'em_andamento', draft: 'a_iniciar', complete: 'concluida', finished: 'concluida' })[status] || status; }
function seasonLabel(status) { return ({ a_iniciar: 'A Iniciar', em_andamento: 'Em Andamento', concluida: 'Concluída' })[normalizeSeasonStatus(status)] || 'sem status'; }

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 9 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 }, title: { color: '#F6F8FC', fontSize: 24, fontWeight: '900' }, copy: { color: '#B7C9DD', fontSize: 11, lineHeight: 16, marginTop: 4 }, copyMuted: { color: '#9FB5CB', fontSize: 9, lineHeight: 14 }, statusPill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: '#17392F' }, statusPillText: { color: '#D7F7B9', fontSize: 8, fontWeight: '900' },
  sectionTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 4, borderRadius: 10, backgroundColor: '#091F3B' }, sectionTab: { minHeight: 32, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 7 }, sectionTabSelected: { backgroundColor: '#B9F276' }, sectionTabText: { color: '#AFC5DD', fontSize: 8, fontWeight: '800' }, sectionTabTextSelected: { color: '#092447' },
  panel: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelNested: { marginTop: 8, padding: 11, backgroundColor: '#102844' }, panelTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 9, lineHeight: 14, marginTop: 4 }, panelBody: { gap: 9, marginTop: 12 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, metric: { flexGrow: 1, minWidth: '22%', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, metricValue: { color: '#B9F276', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#AFC5DD', fontSize: 8, marginTop: 3 },
  field: { flex: 1, minWidth: 95 }, fieldCompact: { minWidth: 75, maxWidth: 150 }, fieldLabel: { color: '#9FB5CB', fontSize: 8, letterSpacing: .55, fontWeight: '900', marginBottom: 5 }, input: { minHeight: 39, paddingHorizontal: 9, color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 11 }, fieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, inlineHint: { flex: 1, color: '#9FB5CB', fontSize: 9, lineHeight: 14, paddingBottom: 9 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choice: { minHeight: 32, paddingHorizontal: 9, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceSelected: { borderColor: '#55754D', backgroundColor: '#15372F' }, choiceCompact: { maxWidth: 150, minHeight: 29, paddingHorizontal: 7 }, choiceText: { color: '#AFC2D5', fontSize: 8, fontWeight: '800' }, choiceTextSelected: { color: '#D7EFC2' }, subTabs: { flexDirection: 'row', gap: 6, marginBottom: 5 }, subheading: { color: '#C4D3E2', fontSize: 9, letterSpacing: .35, fontWeight: '900', marginTop: 5 },
  ruleText: { color: '#D3DFEC', fontSize: 10, lineHeight: 15 }, ruleRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' }, ruleLabel: { color: '#C4D3E2', fontSize: 9, fontWeight: '800' }, ruleValue: { flex: 1, color: '#EAF1F9', fontSize: 9, textAlign: 'right' }, playerList: { maxHeight: 340 }, playerLine: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' }, mutedLine: { opacity: .5 }, crest: { width: 27, height: 29 }, playerName: { color: '#EAF1F9', fontSize: 10, fontWeight: '800' }, drawInfo: { color: '#91A9C7', fontSize: 8, lineHeight: 13 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, action: { minHeight: 37, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, backgroundColor: '#B9F276' }, actionSecondary: { backgroundColor: '#183653', borderWidth: 1, borderColor: '#36536F' }, actionText: { color: '#092447', fontSize: 8, fontWeight: '900' }, actionTextSecondary: { color: '#D1DEEB' }, success: { color: '#B9F276', fontSize: 9, lineHeight: 14 },
  matchRow: { padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#314E69', backgroundColor: '#102844', gap: 6 }, matchHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, scoreInputs: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, vs: { color: '#B9F276', fontSize: 12, fontWeight: '900', paddingBottom: 9 }, standingRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.1)' }, rank: { width: 20, color: '#B9F276', fontSize: 9, fontWeight: '900' }, flexText: { flex: 1, minWidth: 0, color: '#DDE8F4', fontSize: 9 }, stat: { minWidth: 34, color: '#B8CADD', fontSize: 8, textAlign: 'right' },
  assignmentRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.1)' }, miniChoices: { flexDirection: 'row', gap: 4 }, miniChoice: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#36536F' }, miniChoiceSelected: { backgroundColor: '#15372F', borderColor: '#55754D' }, miniChoiceText: { color: '#AFC2D5', fontSize: 8, fontWeight: '900' }, miniChoiceTextSelected: { color: '#D7EFC2' }, chips: { gap: 5, paddingVertical: 4 }, bracketMatch: { gap: 7, padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#314E69', backgroundColor: '#102844' }, legsRow: { flexDirection: 'row', gap: 8 }, leg: { flex: 1 }, scoreInput: { flex: 1, minHeight: 38, minWidth: 40, paddingHorizontal: 7, textAlign: 'center', color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 11 }, aggregate: { color: '#B9F276', fontSize: 9, fontWeight: '900' },
  gateNote: { padding: 10, color: '#FFD987', fontSize: 9, lineHeight: 14, borderRadius: 9, backgroundColor: '#382F28' }, hint: { color: '#91A9C7', fontSize: 8, lineHeight: 13 }, notice: { padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, backgroundColor: '#102844' }, noticeText: { flex: 1, color: '#FFD987', fontSize: 9, lineHeight: 14 }, message: { color: '#B9F276', fontSize: 9, lineHeight: 14 }, error: { color: '#FFB5A9' }, empty: { minHeight: 62, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 9, backgroundColor: '#102844' },
  saveButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#B9F276' }, saveText: { color: '#092447', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .5 },
});
