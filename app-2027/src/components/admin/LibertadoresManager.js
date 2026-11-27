import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/libertadores/${SEASON}`;
const STATUS = [['pending', 'Aguardando'], ['ready', 'Preparada'], ['active', 'Em andamento'], ['complete', 'Concluída']];
const PHASE_STATUS = [['pending', 'Aguardando'], ['ready', 'Pronta'], ['active', 'Em andamento'], ['complete', 'Concluída']];

export default function LibertadoresManager({ players = [], memberships = {}, loadingRoster, rosterError, seasonStatus, adminUid }) {
  const [data, setData] = useState({});
  const [rounds, setRounds] = useState([]);
  const [previousLeague, setPreviousLeague] = useState({});
  const [participants, setParticipants] = useState([]);
  const [qualification, setQualification] = useState({ criteria: '', agreed: false, positions: {} });
  const [phases, setPhases] = useState([]);
  const [status, setStatus] = useState('pending');
  const [championUid, setChampionUid] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stopData = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setData(value); setParticipants(asIds(value.participants));
      setQualification({ criteria: value.qualification?.criteria || '', agreed: value.qualification?.agreed === true, positions: value.qualification?.positions || {} });
      setPhases(normalizePhases(value.phases)); setStatus(value.status || 'pending'); setChampionUid(value.championUid || ''); setLoading(false);
    }, () => { setMessage('Não foi possível carregar a Libertadores 2027.'); setLoading(false); });
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => {
      const list = Object.entries(snapshot.val() || {}).map(([id, round]) => ({ id, ...round }));
      list.sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0)); setRounds(list);
    }, () => setMessage('Não foi possível carregar o calendário de 2027.'));
    const stopPrior = onValue(ref(database, 'tournaments/superliga/2026'), (snapshot) => setPreviousLeague(snapshot.val() || {}));
    return () => { stopData(); stopRounds(); stopPrior(); };
  }, []);

  const eligible = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [players, memberships]);
  const eligibleIds = useMemo(() => new Set(eligible.map((player) => player.uid)), [eligible]);
  const eligibleById = useMemo(() => Object.fromEntries(eligible.map((player) => [player.uid, player])), [eligible]);
  const subscribedIds = useMemo(() => new Set(eligible.filter((player) => memberships[player.uid]?.tournaments?.libertadores === true).map((player) => player.uid)), [eligible, memberships]);
  const previousPositions = useMemo(() => makePositionMap(findStandings(previousLeague)), [previousLeague]);
  const seasonActive = normalizeSeasonStatus(seasonStatus) === 'em_andamento';
  const rankedParticipants = [...participants].sort((a, b) => Number(qualification.positions[a] || previousPositions[a] || 9999) - Number(qualification.positions[b] || previousPositions[b] || 9999));

  function toggleParticipant(uid) { if (!subscribedIds.has(uid)) { setMessage(`${eligibleById[uid]?.name || 'Jogador'} precisa estar inscrito na Libertadores na aba Jogadores.`); return; } setParticipants((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]); }
  function updateQualification(field, value) { setQualification((current) => ({ ...current, [field]: value })); }
  function updatePosition(uid, value) { setQualification((current) => ({ ...current, positions: { ...current.positions, [uid]: value.replace(/[^0-9]/g, '') } })); }
  function importPreviousPositions() { const positions = { ...qualification.positions }; Object.entries(previousPositions).forEach(([uid, position]) => { if (eligibleIds.has(uid)) positions[uid] = String(position); }); setQualification((current) => ({ ...current, positions })); setMessage(Object.keys(previousPositions).length ? 'Classificação de 2026 importada; revise as posições dos participantes.' : 'Não encontrei classificação da Superliga 2026 no novo caminho. Você pode preencher as posições manualmente.'); }
  function addPhase() { setPhases((current) => [...current, { id: `phase-${Date.now()}`, name: `Fase ${current.length + 1}`, status: 'pending', format: 'single', matches: [] }]); }
  function updatePhase(index, field, value) { setPhases((current) => current.map((phase, itemIndex) => itemIndex === index ? { ...phase, [field]: value } : phase)); }
  function removePhase(index) { setPhases((current) => current.filter((_, itemIndex) => itemIndex !== index)); }
  function addMatch(phaseIndex) { setPhases((current) => current.map((phase, index) => index === phaseIndex ? { ...phase, matches: [...phase.matches, blankMatch()] } : phase)); }
  function updateMatch(phaseIndex, matchIndex, field, value) { setPhases((current) => current.map((phase, index) => index === phaseIndex ? { ...phase, matches: phase.matches.map((match, itemIndex) => itemIndex === matchIndex ? { ...match, [field]: value } : match) } : phase)); }
  function removeMatch(phaseIndex, matchIndex) { setPhases((current) => current.map((phase, index) => index === phaseIndex ? { ...phase, matches: phase.matches.filter((_, itemIndex) => itemIndex !== matchIndex) } : phase)); }
  function importRoundScore(phaseIndex, matchIndex, leg) {
    const match = phases[phaseIndex]?.matches[matchIndex]; const roundId = leg === 'ida' ? match?.roundIdIda : leg === 'volta' ? match?.roundIdVolta : match?.roundId;
    const round = rounds.find((item) => item.id === roundId);
    if (!round || !match?.player1Id || !match?.player2Id) { setMessage('Escolha a rodada e os dois participantes antes de importar as pontuações.'); return; }
    const first = calculateUserRoundScore(round, match.player1Id); const second = calculateUserRoundScore(round, match.player2Id);
    const suffix = leg === 'ida' ? 'Ida' : leg === 'volta' ? 'Volta' : '';
    updateMatch(phaseIndex, matchIndex, `score1${suffix}`, String(first)); updateMatch(phaseIndex, matchIndex, `score2${suffix}`, String(second));
    setMessage(`Pontuações da rodada ${round.roundNumber || round.seqNumber || ''} importadas.`);
  }

  function matchWinner(match, format) {
    if (format === 'homeAway') {
      const complete = ['score1Ida', 'score2Ida', 'score1Volta', 'score2Volta'].every((key) => match[key] !== '' && match[key] !== undefined && match[key] !== null);
      if (!complete) return '';
      const first = Number(match.score1Ida) + Number(match.score1Volta); const second = Number(match.score2Ida) + Number(match.score2Volta);
      return first === second ? match.winnerId || '' : first > second ? match.player1Id : match.player2Id;
    }
    if (match.score1 === '' || match.score1 === undefined || match.score2 === '' || match.score2 === undefined) return '';
    return Number(match.score1) === Number(match.score2) ? match.winnerId || '' : Number(match.score1) > Number(match.score2) ? match.player1Id : match.player2Id;
  }

  async function save() {
    if (!adminUid || saving) return;
    if (participants.some((uid) => !eligibleIds.has(uid) || !subscribedIds.has(uid))) { setMessage('A chave só pode incluir jogadores aptos e inscritos na Libertadores.'); return; }
    if (new Set(participants).size !== participants.length) { setMessage('Há participantes repetidos na lista.'); return; }
    if (['ready', 'active', 'complete'].includes(status)) {
      if (participants.length < 2) { setMessage('Inclua ao menos dois participantes antes de preparar a edição.'); return; }
      if (!qualification.criteria.trim()) { setMessage('Descreva o critério de classificação baseado na Superliga anterior.'); return; }
      if (!qualification.agreed) { setMessage('Confirme que o critério foi apresentado e acordado com os participantes.'); return; }
      if (participants.some((uid) => !Number.isInteger(Number(qualification.positions[uid] || previousPositions[uid])) || Number(qualification.positions[uid] || previousPositions[uid]) < 1)) { setMessage('Informe a posição na Superliga anterior de cada participante.'); return; }
    }
    const activePhases = phases.filter((phase) => ['ready', 'active', 'complete'].includes(phase.status));
    for (const phase of activePhases) {
      if (!phase.name.trim() || !phase.matches.length) { setMessage('Cada fase liberada precisa de nome e ao menos um confronto.'); return; }
      for (const match of phase.matches) {
        if (!match.player1Id || !match.player2Id || match.player1Id === match.player2Id || !participants.includes(match.player1Id) || !participants.includes(match.player2Id)) { setMessage(`Revise os participantes dos confrontos da fase ${phase.name}.`); return; }
        if (match.winnerId && ![match.player1Id, match.player2Id].includes(match.winnerId)) { setMessage(`O vencedor manual precisa ser um dos participantes do confronto na fase ${phase.name}.`); return; }
        const roundsNeeded = phase.format === 'homeAway' ? [match.roundIdIda, match.roundIdVolta] : [match.roundId];
        if (roundsNeeded.some((roundId) => !roundId)) { setMessage(`Vincule o calendário 2027 a todos os confrontos da fase ${phase.name}.`); return; }
        if (phase.status === 'complete' && !matchWinner(match, phase.format)) { setMessage(`Conclua os placares e defina o vencedor de cada confronto da fase ${phase.name}.`); return; }
      }
    }
    if (activePhases.some((phase) => phase.status === 'active' || phase.status === 'complete') && !seasonActive) { setMessage('A temporada precisa estar Em Andamento para iniciar ou atualizar as fases.'); return; }
    if (status === 'active' && !seasonActive) { setMessage('A temporada precisa estar Em Andamento para iniciar a Libertadores.'); return; }
    if (status === 'complete' && (!seasonActive || !championUid || !participants.includes(championUid))) { setMessage('Conclua a temporada em andamento e selecione um campeão participante da Libertadores.'); return; }
    if (championUid && !participants.includes(championUid)) { setMessage('O campeão precisa estar entre os participantes da Libertadores.'); return; }

    const now = Date.now();
    const finalQualification = { ...qualification, criteria: qualification.criteria.trim(), positions: Object.fromEntries(participants.map((uid) => [uid, Number(qualification.positions[uid] || previousPositions[uid])])), sourceSeason: 2026, agreedAt: qualification.agreed ? qualification.agreedAt || data.qualification?.agreedAt || now : null, agreedBy: qualification.agreed ? qualification.agreedBy || data.qualification?.agreedBy || adminUid : null };
    const next = { ...data, season: Number(SEASON), status, participants, qualification: finalQualification, phases: phases.map((phase) => ({ ...phase, name: phase.name.trim(), matches: phase.matches.map((match) => sanitizeMatch(match, phase.format)) })), championUid: championUid || null, updatedAt: now, updatedBy: adminUid };
    const oldRoundIds = collectRoundIds(data.phases); const nextRoundIds = collectRoundIds(next.phases); const touchedRoundIds = new Set([...oldRoundIds, ...nextRoundIds]);
    const updates = { [PATH]: next };
    touchedRoundIds.forEach((roundId) => {
      const round = rounds.find((item) => item.id === roundId); if (!round) return;
      const enabled = nextRoundIds.has(roundId);
      const oldConfig = round.tournamentConfig || {};
      const tournaments = Array.isArray(round.tournaments) ? round.tournaments : Object.entries(oldConfig).filter(([, config]) => (typeof config === 'boolean' ? config : config?.enabled)).map(([id]) => id);
      const nextTournaments = enabled ? [...new Set([...tournaments, 'libertadores'])] : tournaments.filter((id) => id !== 'libertadores');
      updates[`seasons/${SEASON}/rounds/${roundId}/tournamentConfig/libertadores`] = { ...(typeof oldConfig.libertadores === 'object' ? oldConfig.libertadores : {}), enabled };
      updates[`seasons/${SEASON}/rounds/${roundId}/tournaments`] = nextTournaments;
    });
    if (Object.keys(data).length) updates[`backups/tournaments/libertadores/${SEASON}/${now}`] = { reason: 'admin-config-update', createdAt: now, createdBy: adminUid, data, affectedRounds: [...touchedRoundIds].map((id) => ({ id, tournamentConfig: rounds.find((round) => round.id === id)?.tournamentConfig || null, tournaments: rounds.find((round) => round.id === id)?.tournaments || null })) };
    setSaving(true); setMessage('');
    try { await update(ref(database), updates); setMessage('Configuração da Libertadores salva com backup da versão anterior.'); }
    catch { setMessage('Não foi possível salvar. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  if (loading || loadingRoster) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.muted}>Carregando edição e participantes…</Text></View>;
  if (rosterError) return <View style={styles.panel}><Text style={styles.error}>{rosterError}</Text></View>;
  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Libertadores 2027</Text><Text style={styles.muted}>Critérios, classificados, etapas e chave definidos pelo administrador.</Text></View><MaterialDesignIcons name="trophy-variant-outline" size={25} color="#B9F276" /></View>
    <View style={styles.metrics}><Metric label="PARTICIPANTES" value={participants.length} /><Metric label="FASES" value={phases.length} /><Metric label="CONFRONTOS" value={phases.reduce((total, phase) => total + phase.matches.length, 0)} /><Metric label="STATUS" value={STATUS.find(([id]) => id === status)?.[1] || 'Aguardando'} /></View>
    <Panel title="Critério e classificação" detail="A classificação deve seguir a Superliga anterior. O formato e o número de vagas ficam registrados conforme o acordo desta edição.">
      <Field label="CRITÉRIO DE VAGAS" value={qualification.criteria} onChangeText={(value) => updateQualification('criteria', value)} placeholder="Ex.: campeão, vice e posições da classificação final" multiline />
      <Action label="Importar posições da Superliga 2026" icon="download-outline" onPress={importPreviousPositions} secondary />
      <View style={styles.agreement}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: qualification.agreed }} onPress={() => updateQualification('agreed', !qualification.agreed)}><MaterialDesignIcons name={qualification.agreed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={qualification.agreed ? '#B9F276' : '#8299B2'} /></Pressable><Text style={styles.copy}>Critério apresentado e acordado com os participantes</Text></View>
      <Text style={styles.fieldLabel}>PARTICIPANTES CLASSIFICADOS · {participants.length}</Text>
      <View style={styles.playerList}>{eligible.map((player) => { const selected = participants.includes(player.uid); const subscribed = subscribedIds.has(player.uid); const rank = qualification.positions[player.uid] || previousPositions[player.uid] || ''; return <View key={player.uid} style={[styles.playerLine, !subscribed && styles.dim]}>
        {player.shieldUrl ? <Image source={{ uri: player.shieldUrl }} style={styles.crest} resizeMode="contain" /> : <MaterialDesignIcons name="account-circle-outline" size={23} color="#AFC5DD" />}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: !subscribed }} onPress={() => toggleParticipant(player.uid)} style={styles.playerToggle}><Text numberOfLines={1} style={styles.playerName}>{player.name}</Text><Text style={styles.playerSub}>{subscribed ? 'Inscrito na Libertadores' : 'Inscrição pendente na aba Jogadores'}</Text></Pressable>
        <Field label="POS. 2026" value={String(rank)} onChangeText={(value) => updatePosition(player.uid, value)} placeholder="—" compact />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: !subscribed }} onPress={() => toggleParticipant(player.uid)}><MaterialDesignIcons name={selected ? 'checkbox-marked-circle' : subscribed ? 'checkbox-blank-circle-outline' : 'lock-outline'} size={19} color={selected ? '#B9F276' : '#8299B2'} /></Pressable>
      </View>; })}</View>
      <Text style={styles.copy}>A edição só pode ser preparada com classificação, critério e acordo registrados. Posições importadas ficam revisáveis.</Text>
    </Panel>
    <Panel title="Fases e chave" detail="Crie as etapas necessárias. Cada confronto é associado a uma rodada do bolão; os pontos podem ser importados para o placar do duelo.">
      {phases.map((phase, phaseIndex) => <View key={phase.id} style={styles.phaseCard}>
        <View style={styles.cardHeader}><Text style={styles.subheading}>ETAPA {phaseIndex + 1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remover ${phase.name}`} onPress={() => removePhase(phaseIndex)}><MaterialDesignIcons name="delete-outline" size={18} color="#FF9E91" /></Pressable></View>
        <View style={styles.fieldRow}><Field label="NOME DA FASE" value={phase.name} onChangeText={(value) => updatePhase(phaseIndex, 'name', value)} placeholder="Ex.: Fase de grupos" /><View style={[styles.field, styles.formatField]}><Text style={styles.fieldLabel}>FORMATO</Text><Text style={styles.formatValue}>{phase.format === 'homeAway' ? 'Ida e volta' : 'Jogo único'}</Text></View></View>
        <View style={styles.choices}><Choice label="Jogo único" selected={phase.format === 'single'} onPress={() => updatePhase(phaseIndex, 'format', 'single')} /><Choice label="Ida e volta" selected={phase.format === 'homeAway'} onPress={() => updatePhase(phaseIndex, 'format', 'homeAway')} /></View>
        <Text style={styles.fieldLabel}>STATUS DA FASE</Text><Choices options={PHASE_STATUS} value={phase.status} onChange={(value) => updatePhase(phaseIndex, 'status', value)} />
        {phase.matches.map((match, matchIndex) => <View key={match.id} style={styles.matchCard}>
          <View style={styles.cardHeader}><Text style={styles.subheading}>CONFRONTO {matchIndex + 1}</Text><Pressable accessibilityRole="button" accessibilityLabel="Remover confronto" onPress={() => removeMatch(phaseIndex, matchIndex)}><MaterialDesignIcons name="close-circle-outline" size={17} color="#FF9E91" /></Pressable></View>
          <Text style={styles.fieldLabel}>PARTICIPANTE 1</Text><PlayerChips ids={rankedParticipants} selected={match.player1Id} players={eligibleById} onSelect={(uid) => updateMatch(phaseIndex, matchIndex, 'player1Id', uid)} />
          <Text style={styles.fieldLabel}>PARTICIPANTE 2</Text><PlayerChips ids={rankedParticipants.filter((uid) => uid !== match.player1Id)} selected={match.player2Id} players={eligibleById} onSelect={(uid) => updateMatch(phaseIndex, matchIndex, 'player2Id', uid)} />
          {phase.format === 'homeAway' ? <>
            <Text style={styles.fieldLabel}>RODADA DA IDA</Text><RoundChips rounds={rounds} value={match.roundIdIda} onSelect={(id) => updateMatch(phaseIndex, matchIndex, 'roundIdIda', id)} />
            <LegScores first={match.score1Ida} second={match.score2Ida} onChange={(field, value) => updateMatch(phaseIndex, matchIndex, field, value)} />
            <Action label="Importar pontuação da ida" icon="download-outline" secondary onPress={() => importRoundScore(phaseIndex, matchIndex, 'ida')} />
            <Text style={styles.fieldLabel}>RODADA DA VOLTA</Text><RoundChips rounds={rounds} value={match.roundIdVolta} onSelect={(id) => updateMatch(phaseIndex, matchIndex, 'roundIdVolta', id)} />
            <LegScores volta first={match.score1Volta} second={match.score2Volta} onChange={(field, value) => updateMatch(phaseIndex, matchIndex, field, value)} />
            <Action label="Importar pontuação da volta" icon="download-outline" secondary onPress={() => importRoundScore(phaseIndex, matchIndex, 'volta')} />
            <Text style={styles.aggregate}>Agregado: {aggregate(match, phase.format)}</Text>
          </> : <>
            <Text style={styles.fieldLabel}>RODADA DO CONFRONTO</Text><RoundChips rounds={rounds} value={match.roundId} onSelect={(id) => updateMatch(phaseIndex, matchIndex, 'roundId', id)} />
            <ScoreLine first={match.score1} second={match.score2} onChange={(field, value) => updateMatch(phaseIndex, matchIndex, field, value)} />
            <Action label="Importar pontuação da rodada" icon="download-outline" secondary onPress={() => importRoundScore(phaseIndex, matchIndex, '')} />
          </>}
          <Text style={styles.fieldLabel}>DESEMPATE / VENCEDOR MANUAL</Text><PlayerChips ids={[match.player1Id, match.player2Id].filter(Boolean)} selected={match.winnerId} players={eligibleById} onSelect={(uid) => updateMatch(phaseIndex, matchIndex, 'winnerId', uid)} />
          <Text style={matchWinner(match, phase.format) ? styles.success : styles.copy}>Vencedor: {eligibleById[matchWinner(match, phase.format)]?.name || 'a definir'}</Text>
        </View>)}
        <Action label="Adicionar confronto" icon="plus" onPress={() => addMatch(phaseIndex)} secondary />
      </View>)}
      <Action label="Adicionar fase" icon="layers-plus" onPress={addPhase} />
      <Text style={styles.copy}>O pareamento entre fases é manual e revisável. Os confrontos não são avançados automaticamente.</Text>
    </Panel>
    <Panel title="Status e campeão" detail="A edição concluída exige o campeão selecionado entre os classificados.">
      <Choices options={STATUS} value={status} onChange={setStatus} />
      <Text style={styles.fieldLabel}>CAMPEÃO DA LIBERTADORES</Text><PlayerChips ids={rankedParticipants} selected={championUid} players={eligibleById} onSelect={setChampionUid} />
    </Panel>
    {!seasonActive && <Text style={styles.gate}>Temporada {seasonStatus || 'sem status'}: prepare critério, classificados e fases; para iniciar ou atualizar etapas, a temporada precisa estar Em Andamento.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') || message.includes('precisa') || message.includes('Informe') || message.includes('Confirme') || message.includes('Revise') ? styles.error : null]}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#092447" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#092447" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar configuração da Libertadores'}</Text></Pressable>
  </View>;
}

function Panel({ title, detail, children }) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.panelBody}>{children}</View></View>; }
function Metric({ label, value }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Field({ label, value, onChangeText, placeholder, compact = false, multiline = false }) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8199B3" keyboardType={compact ? 'number-pad' : 'default'} multiline={multiline} style={[styles.input, multiline && styles.textarea]} /></View>; }
function Action({ label, icon, onPress, secondary = false }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><MaterialDesignIcons name={icon} size={15} color={secondary ? '#D5E3F1' : '#092447'} /><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>; }
function Choices({ options, value, onChange }) { return <View style={styles.choices}>{options.map(([id, label]) => <Choice key={id} label={label} selected={value === id} onPress={() => onChange(id)} />)}</View>; }
function Choice({ label, selected, onPress }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}><Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>; }
function PlayerChips({ ids, selected, players, onSelect }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{ids.map((uid) => <Choice key={uid} label={players[uid]?.name || uid} selected={selected === uid} onPress={() => onSelect(selected === uid ? '' : uid)} />)}</ScrollView>; }
function RoundChips({ rounds, value, onSelect }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{rounds.map((round) => <Choice key={round.id} label={`Rodada ${round.roundNumber || round.seqNumber || '—'}`} selected={value === round.id} onPress={() => onSelect(round.id)} />)}</ScrollView>; }
function LegScores({ first, second, onChange, volta = false }) { const suffix = volta ? 'Volta' : 'Ida'; return <View style={styles.scoreRow}><TextInput value={String(first ?? '')} onChangeText={(value) => onChange(`score1${suffix}`, value.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" style={styles.score} placeholder="P1" placeholderTextColor="#8299B2" /><Text style={styles.vs}>×</Text><TextInput value={String(second ?? '')} onChangeText={(value) => onChange(`score2${suffix}`, value.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" style={styles.score} placeholder="P2" placeholderTextColor="#8299B2" /></View>; }
function ScoreLine({ first, second, onChange }) { return <View style={styles.scoreRow}><TextInput value={String(first ?? '')} onChangeText={(value) => onChange('score1', value.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" style={styles.score} placeholder="P1" placeholderTextColor="#8299B2" /><Text style={styles.vs}>×</Text><TextInput value={String(second ?? '')} onChangeText={(value) => onChange('score2', value.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" style={styles.score} placeholder="P2" placeholderTextColor="#8299B2" /></View>; }
function blankMatch() { return { id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, player1Id: '', player2Id: '', roundId: '', roundIdIda: '', roundIdVolta: '', score1: '', score2: '', score1Ida: '', score2Ida: '', score1Volta: '', score2Volta: '', winnerId: '' }; }
function normalizePhases(value) { return (Array.isArray(value) ? value : Object.values(value || {})).filter(Boolean).map((phase) => ({ id: phase.id || `phase-${Math.random().toString(36).slice(2, 8)}`, name: String(phase.name || ''), status: phase.status || 'pending', format: phase.format === 'homeAway' ? 'homeAway' : 'single', matches: asArray(phase.matches).map((match) => ({ ...blankMatch(), ...match })) })); }
function sanitizeMatch(match, format) { const keys = format === 'homeAway' ? ['score1Ida', 'score2Ida', 'score1Volta', 'score2Volta'] : ['score1', 'score2']; return Object.fromEntries(Object.entries(match).map(([key, value]) => [key, keys.includes(key) && value !== '' && value !== null && value !== undefined ? Number(value) : value])); }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }
function asIds(value) { if (Array.isArray(value)) return value.filter(Boolean); return Object.entries(value || {}).filter(([, enabled]) => enabled !== false && enabled !== null).map(([uid]) => uid); }
function collectRoundIds(phasesValue) { const ids = new Set(); normalizePhases(phasesValue).forEach((phase) => phase.matches.forEach((match) => [match.roundId, match.roundIdIda, match.roundIdVolta].filter(Boolean).forEach((id) => ids.add(id)))); return ids; }
function findStandings(data) { return data?.regular?.standings || data?.regular?.table || data?.standings || data?.table || data?.classification || {}; }
function makePositionMap(raw) { const rows = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([uid, row]) => ({ uid, ...(row || {}) })); return Object.fromEntries(rows.map((row, index) => [row.uid || row.playerId || row.userId || String(index), Number(row.position) || index + 1])); }
function normalizeSeasonStatus(value) { return ({ active: 'em_andamento', open: 'em_andamento' })[value] || value; }
function calculateUserRoundScore(round, uid) { let total = 0; let hasPrediction = false; asArray(round?.matches).forEach((match) => { const result = match.finalResult; const prediction = match.predictions?.[uid]; if (!result || !prediction || prediction.homeScore === undefined || prediction.awayScore === undefined) return; hasPrediction = true; const standard = scorePrediction(result, prediction, prediction.isStarMatch === true); const wildcard = match.wildcardPredictions?.[uid]; const wildcardScore = wildcard && wildcard.homeScore !== undefined && wildcard.awayScore !== undefined ? scorePrediction(result, wildcard, false) : null; total += wildcardScore === null ? standard : Math.max(standard, wildcardScore); }); if (hasPrediction) total += calculateArtilheiroScore(round, uid); return total; }
function scorePrediction(result, prediction, star) { const home = Number(prediction.homeScore); const away = Number(prediction.awayScore); const actualHome = Number(result.homeScore); const actualAway = Number(result.awayScore); let points = home === actualHome && away === actualAway ? 3 : Math.sign(home - away) === Math.sign(actualHome - actualAway) ? 1 : home === actualAway && away === actualHome ? -1 : 0; if (star) points *= 2; return points; }
function calculateArtilheiroScore(round, uid) { const choice = round.starPlayers?.[uid]; const chosen = Array.isArray(choice?.players) ? choice.players : choice?.athleteId ? [{ id: choice.athleteId }] : []; if (!chosen.length) return 0; const captainId = String(choice.captainId || choice.athleteId || chosen[0]?.id || ''); const metrics = chosen.map((player) => ({ id: String(player.id || player.athleteId || ''), ...goalMetrics(round.playerGoals?.[player.id || player.athleteId]) })); const goals = metrics.reduce((sum, player) => sum + player.goals, 0); const captain = metrics.find((player) => player.id === captainId); const support = metrics.filter((player) => player.id !== captainId).reduce((sum, player) => sum + player.goals, 0); const strategy = choice.strategy || 'artilheiro'; const captainPoints = !captain ? 0 : strategy === 'garcom' ? captain.goals + captain.assists : strategy === 'hatTrick' ? captain.goals >= 3 ? 8 + captain.goals - 3 : captain.goals : captain.goals * 2; return support + captainPoints + (strategy === 'hatTrick' ? goals < 3 ? -3 : 0 : goals === 0 ? -1 : 0); }
function goalMetrics(value) { if (typeof value === 'number') return { goals: value, assists: 0 }; return { goals: Number(value?.count ?? value?.goals ?? value?.goalCount ?? 0), assists: Number(value?.assists ?? value?.assistsCount ?? value?.assistCount ?? 0) }; }
function aggregate(match, format) { if (format !== 'homeAway') return `${match.score1 ?? '—'} × ${match.score2 ?? '—'}`; const complete = ['score1Ida', 'score2Ida', 'score1Volta', 'score2Volta'].every((key) => match[key] !== '' && match[key] !== undefined && match[key] !== null); return complete ? `${Number(match.score1Ida) + Number(match.score1Volta)} × ${Number(match.score2Ida) + Number(match.score2Volta)}` : 'Aguardando ida e volta'; }

const styles = StyleSheet.create({ root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }, title: { color: '#F6F8FC', fontSize: 23, fontWeight: '900' }, muted: { color: '#9FB5CB', fontSize: 9, lineHeight: 14, marginTop: 4 }, copy: { color: '#9FB5CB', fontSize: 8, lineHeight: 13 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, metric: { flexGrow: 1, minWidth: '22%', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, metricValue: { color: '#B9F276', fontSize: 15, fontWeight: '900' }, metricLabel: { color: '#AFC5DD', fontSize: 7, marginTop: 3 }, panel: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 9, lineHeight: 14, marginTop: 4 }, panelBody: { gap: 9, marginTop: 12 }, field: { flex: 1, minWidth: 80 }, fieldCompact: { flex: 0, width: 76 }, formatField: { flex: 0, width: 100, paddingBottom: 6 }, formatValue: { minHeight: 30, paddingHorizontal: 8, paddingTop: 7, color: '#D7EFC2', borderRadius: 8, borderWidth: 1, borderColor: '#55754D', backgroundColor: '#15372F', fontSize: 8, fontWeight: '800' }, fieldLabel: { color: '#9FB5CB', fontSize: 7, letterSpacing: .45, fontWeight: '900', marginBottom: 4 }, input: { minHeight: 36, paddingHorizontal: 8, color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 9 }, textarea: { minHeight: 68, textAlignVertical: 'top', paddingTop: 8 }, fieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, agreement: { flexDirection: 'row', alignItems: 'center', gap: 7 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, choice: { minHeight: 30, maxWidth: 155, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceOn: { borderColor: '#55754D', backgroundColor: '#15372F' }, choiceText: { color: '#AFC2D5', fontSize: 7, fontWeight: '800' }, choiceTextOn: { color: '#D7EFC2' }, action: { minHeight: 34, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 8, backgroundColor: '#B9F276' }, actionSecondary: { backgroundColor: '#183653', borderWidth: 1, borderColor: '#36536F' }, actionText: { color: '#092447', fontSize: 7, fontWeight: '900' }, actionTextSecondary: { color: '#D1DEEB' }, playerList: { maxHeight: 400 }, playerLine: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' }, playerToggle: { flex: 1, minWidth: 0 }, playerName: { color: '#EAF1F9', fontSize: 8, fontWeight: '800' }, playerSub: { color: '#91A9C7', fontSize: 7, marginTop: 2 }, crest: { width: 25, height: 28 }, dim: { opacity: .55 }, phaseCard: { gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, subheading: { color: '#C4D3E2', fontSize: 8, fontWeight: '900' }, matchCard: { gap: 7, padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0A1F3A' }, chips: { gap: 5, paddingVertical: 3 }, scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, score: { width: 52, height: 36, textAlign: 'center', color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 10 }, vs: { color: '#B9F276', fontWeight: '900' }, aggregate: { color: '#B9F276', fontSize: 8, fontWeight: '900' }, success: { color: '#B9F276', fontSize: 8 }, gate: { padding: 10, color: '#FFD987', fontSize: 8, lineHeight: 13, borderRadius: 9, backgroundColor: '#382F28' }, message: { color: '#B9F276', fontSize: 9, lineHeight: 14 }, error: { color: '#FFB5A9' }, save: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#B9F276' }, saveText: { color: '#092447', fontSize: 9, fontWeight: '900' }, disabled: { opacity: .5 } });
