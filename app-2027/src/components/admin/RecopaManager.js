import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/recopa/${SEASON}`;
const PHASES = [['pending', 'Aguardando'], ['ready', 'Preparada'], ['active', 'Em andamento'], ['complete', 'Concluída'], ['cancelled', 'Não haverá edição']];

export default function RecopaManager({ players = [], seasonStatus, adminUid }) {
  const [data, setData] = useState({});
  const [lastSuperliga, setLastSuperliga] = useState({});
  const [lastSupercopa, setLastSupercopa] = useState({});
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [decision, setDecision] = useState('pending');
  const [status, setStatus] = useState('pending');
  const [superligaChampion, setSuperligaChampion] = useState('');
  const [supercopaChampion, setSupercopaChampion] = useState('');
  const [scheduledRounds, setScheduledRounds] = useState([]);
  const [scores, setScores] = useState({});
  const [winnerId, setWinnerId] = useState('');

  useEffect(() => {
    const stopCurrent = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setData(value);
      setDecision(value.decision || 'pending'); setStatus(value.status || 'pending');
      setSuperligaChampion(value.participants?.superligaChampion || ''); setSupercopaChampion(value.participants?.supercopaChampion || '');
      setScheduledRounds(asArray(value.scheduledRounds)); setScores(value.scores || {}); setWinnerId(value.winnerId || ''); setLoading(false);
    }, () => { setMessage('Não foi possível carregar a edição da Recopa.'); setLoading(false); });
    const stopSuperliga = onValue(ref(database, 'tournaments/superliga/2026'), (snapshot) => setLastSuperliga(snapshot.val() || {}));
    const stopSupercopa = onValue(ref(database, 'tournaments/supercopa/2026'), (snapshot) => setLastSupercopa(snapshot.val() || {}));
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => setRounds(Object.entries(snapshot.val() || {}).map(([id, round]) => ({ id, ...round })).sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0))));
    return () => { stopCurrent(); stopSuperliga(); stopSupercopa(); stopRounds(); };
  }, []);

  const playersById = useMemo(() => Object.fromEntries(players.map((player) => [player.uid, player])), [players]);
  const sameChampion = decision === 'yes' && Boolean(superligaChampion && superligaChampion === supercopaChampion);
  const seasonActive = normalizeStatus(seasonStatus) === 'em_andamento';
  const previousWinnerA = championFrom(lastSuperliga, ['champions.winner', 'regular.championUid', 'championUid', 'winnerId']);
  const previousWinnerB = championFrom(lastSupercopa, ['champions.winner', 'champions.A', 'championUid', 'winnerId']);

  function addRound() { setScheduledRounds((current) => [...current, `round-${Date.now()}`]); }
  function updateRound(index, id) { setScheduledRounds((current) => current.map((item, itemIndex) => itemIndex === index ? id : item)); }
  function removeRound(index) { setScheduledRounds((current) => current.filter((_, itemIndex) => itemIndex !== index)); }
  function setScore(roundId, field, value) { setScores((current) => ({ ...current, [roundId]: { ...(current[roundId] || {}), [field]: value.replace(/[^0-9-]/g, '') } })); }
  function importScore(roundId) {
    const round = rounds.find((item) => item.id === roundId);
    if (!round || !superligaChampion || !supercopaChampion) { setMessage('Selecione os dois campeões e uma rodada do calendário antes de importar.'); return; }
    setScores((current) => ({ ...current, [roundId]: { home: String(calculateUserRoundScore(round, superligaChampion)), away: String(calculateUserRoundScore(round, supercopaChampion)), source: 'season-round' } }));
    setMessage('Pontuações importadas dos palpites e resultados da rodada selecionada.');
  }

  async function save() {
    if (!adminUid || saving) return;
    const participants = { superligaChampion, supercopaChampion };
    if (decision === 'yes' && (!superligaChampion || !supercopaChampion)) { setMessage('Confirme os campeões da Superliga e da Supercopa anteriores.'); return; }
    if (status === 'complete' && decision !== 'yes') { setMessage('Confirme a realização da edição antes de concluí-la.'); return; }
    if (decision === 'yes' && !sameChampion && scheduledRounds.length === 0) { setMessage('Cadastre ao menos uma rodada para a partida da Recopa.'); return; }
    if (new Set(scheduledRounds).size !== scheduledRounds.length) { setMessage('Uma rodada não pode aparecer mais de uma vez no calendário da Recopa.'); return; }
    if (status === 'active' && (!seasonActive || decision !== 'yes')) { setMessage('A temporada precisa estar Em Andamento e a edição confirmada para iniciar a Recopa.'); return; }
    if (status === 'complete' && decision === 'yes' && !winnerId && !sameChampion) { setMessage('Registre o campeão antes de concluir a edição.'); return; }
    if (status === 'complete' && !seasonActive && !sameChampion) { setMessage('A temporada precisa estar Em Andamento para concluir a Recopa.'); return; }
    if (!seasonActive && !sameChampion && Object.values(scores).some((score) => (score?.home !== '' && score?.home !== undefined) || (score?.away !== '' && score?.away !== undefined))) { setMessage('A temporada precisa estar Em Andamento para registrar ou atualizar placares da Recopa.'); return; }
    const normalizedScores = Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { ...score, home: score.home === '' ? null : Number(score.home), away: score.away === '' ? null : Number(score.away) }]));
    const inferredWinner = sameChampion ? superligaChampion : resolveWinner(scheduledRounds, normalizedScores, superligaChampion, supercopaChampion) || winnerId || null;
    if (decision === 'no') { setStatus('cancelled'); }
    const now = Date.now();
    const next = { ...data, season: Number(SEASON), decision, status: decision === 'no' ? 'cancelled' : sameChampion ? 'complete' : status, participants, scheduledRounds: decision === 'yes' && !sameChampion ? scheduledRounds : [], scores: normalizedScores, winnerId: decision === 'yes' ? inferredWinner : null, autoChampion: sameChampion, updatedAt: now, updatedBy: adminUid };
    setSaving(true); setMessage('');
    try {
      const updates = { [PATH]: next };
      if (Object.keys(data).length) updates[`backups/tournaments/recopa/${SEASON}/${now}`] = { reason: 'admin-config-update', createdAt: now, createdBy: adminUid, data };
      await update(ref(database), updates);
      setMessage('Configuração da Recopa salva com backup da versão anterior.');
    } catch { setMessage('Não foi possível salvar a Recopa. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.muted}>Carregando configuração da Recopa…</Text></View>;
  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Recopa 2027</Text><Text style={styles.muted}>Disputa entre os campeões de 2026, com jogo único e rodadas extras em caso de empate.</Text></View><MaterialDesignIcons name="trophy-outline" size={25} color="#B9F276" /></View>
    <Panel title="Decisão da edição" detail="Defina se a Recopa acontecerá nesta temporada."><Choices options={[["pending", "A definir"], ["yes", "Haverá edição"], ["no", "Sem edição"]]} value={decision} onChange={(value) => { setDecision(value); if (value === 'no') setStatus('cancelled'); else if (status === 'cancelled') setStatus('pending'); }} /></Panel>
    {decision !== 'no' && <>
      <Panel title="Campeões classificados" detail="A origem sugerida é a edição 2026. Você pode corrigir a seleção conforme o resultado oficial.">
        <PlayerSelect label="CAMPEÃO DA SUPERLIGA 2026" value={superligaChampion} suggested={previousWinnerA} players={players} onSelect={setSuperligaChampion} />
        <PlayerSelect label="CAMPEÃO DA SUPERCOPA 2026" value={supercopaChampion} suggested={previousWinnerB} players={players} onSelect={setSupercopaChampion} />
        {sameChampion && <View style={styles.notice}><MaterialDesignIcons name="check-decagram" size={18} color="#B9F276" /><Text style={styles.noticeText}>Mesmo campeão nas duas competições: título da Recopa atribuído automaticamente, sem partida.</Text></View>}
      </Panel>
      {!sameChampion && <Panel title="Calendário e placares" detail="Cada rodada extra só é necessária se a anterior terminar empatada. A pontuação pode ser importada da rodada vinculada.">
        {scheduledRounds.map((roundId, index) => { const selected = rounds.find((round) => round.id === roundId); const score = scores[roundId] || {}; return <View key={`${roundId}-${index}`} style={styles.roundCard}>
          <View style={styles.cardHeader}><Text style={styles.subheading}>{index === 0 ? 'PARTIDA' : `DESEMPATE ${index}`}</Text><Pressable accessibilityRole="button" accessibilityLabel="Remover rodada" onPress={() => removeRound(index)}><MaterialDesignIcons name="delete-outline" size={18} color="#FF9E91" /></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{rounds.map((round) => <Choice key={round.id} label={`Rodada ${round.roundNumber || round.seqNumber || '—'}`} selected={round.id === roundId} onPress={() => { updateRound(index, round.id); if (roundId !== round.id) setScores((current) => ({ ...current, [round.id]: current[round.id] || {} })); }} />)}</ScrollView>
          {selected && <Text style={styles.muted}>Selecionada: rodada {selected.roundNumber || selected.seqNumber || '—'}</Text>}
          <View style={styles.scoreLine}><Text style={styles.playerLabel}>{playersById[superligaChampion]?.name || 'Campeão da Superliga'}</Text><Score value={score.home} onChange={(value) => setScore(roundId, 'home', value)} /><Text style={styles.vs}>×</Text><Score value={score.away} onChange={(value) => setScore(roundId, 'away', value)} /><Text style={styles.playerLabel}>{playersById[supercopaChampion]?.name || 'Campeão da Supercopa'}</Text></View>
          <Pressable accessibilityRole="button" onPress={() => importScore(roundId)} style={styles.secondaryAction}><MaterialDesignIcons name="download-outline" size={16} color="#D5E3F1" /><Text style={styles.secondaryText}>Importar pontuação da rodada</Text></Pressable>
          {score.home !== undefined && score.away !== undefined && score.home !== '' && score.away !== '' && <Text style={Number(score.home) === Number(score.away) ? styles.drawText : styles.success}>{Number(score.home) === Number(score.away) ? 'Empate · precisa de outra rodada para decidir' : `Vencedor: ${Number(score.home) > Number(score.away) ? playersById[superligaChampion]?.name : playersById[supercopaChampion]?.name}`}</Text>}
        </View>; })}
        <Pressable accessibilityRole="button" onPress={addRound} style={styles.secondaryAction}><MaterialDesignIcons name="plus" size={16} color="#D5E3F1" /><Text style={styles.secondaryText}>{scheduledRounds.length ? 'Adicionar rodada de desempate' : 'Adicionar jogo da Recopa'}</Text></Pressable>
        <Text style={styles.fieldLabel}>CAMPEÃO (CORREÇÃO ADMINISTRATIVA)</Text><Choices options={[[superligaChampion, playersById[superligaChampion]?.name || 'Superliga'], [supercopaChampion, playersById[supercopaChampion]?.name || 'Supercopa']].filter(([id]) => id)} value={winnerId} onChange={setWinnerId} />
      </Panel>}
      <Panel title="Status" detail="As fases só podem ser iniciadas com a temporada em andamento."><Choices options={PHASES} value={status} onChange={setStatus} /><Text style={styles.muted}>Atual: {PHASES.find(([id]) => id === (sameChampion ? 'complete' : status))?.[1] || 'Aguardando'}</Text></Panel>
    </>}
    {!seasonActive && <Text style={styles.gate}>Temporada {seasonStatus || 'sem status'}: prepare os dados; para iniciar ou concluir a disputa, marque a temporada como Em Andamento.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') || message.includes('precisa') || message.includes('Confirme') ? styles.error : null]}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#092447" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#092447" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar configuração da Recopa'}</Text></Pressable>
  </View>;
}

function PlayerSelect({ label, value, suggested, players, onSelect }) { return <View style={styles.playerSelect}><Text style={styles.fieldLabel}>{label}</Text>{suggested && <Text style={styles.suggestion}>Sugestão da edição anterior: {players.find((player) => player.uid === suggested)?.name || suggested}</Text>}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{players.map((player) => <Choice key={player.uid} label={player.name} selected={value === player.uid} onPress={() => onSelect(player.uid)} />)}</ScrollView></View>; }
function Panel({ title, detail, children }) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.body}>{children}</View></View>; }
function Choices({ options, value, onChange }) { return <View style={styles.choices}>{options.map(([id, label]) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: value === id }} onPress={() => onChange(id)} style={[styles.choice, value === id && styles.choiceOn]}><Text style={[styles.choiceText, value === id && styles.choiceTextOn]}>{label}</Text></Pressable>)}</View>; }
function Choice({ label, selected, onPress }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>; }
function Score({ value, onChange }) { return <TextInput value={String(value ?? '')} keyboardType="number-pad" onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))} style={styles.score} placeholder="0" placeholderTextColor="#8299B2" />; }
function asArray(value) { if (Array.isArray(value)) return value.filter(Boolean); return Object.entries(value || {}).map(([id, item]) => ({ id, ...(item || {}) })); }
function normalizeStatus(value) { return ({ active: 'em_andamento', open: 'em_andamento' })[value] || value; }
function championFrom(data, paths) { for (const path of paths) { const value = path.split('.').reduce((current, key) => current?.[key], data); if (typeof value === 'string' && value) return value; } return ''; }
function resolveWinner(roundIds, scores, superligaId, supercopaId) { for (const id of roundIds) { const score = scores[id]; if (!score || score.home == null || score.away == null) return ''; if (score.home !== score.away) return score.home > score.away ? superligaId : supercopaId; } return ''; }
function calculateUserRoundScore(round, uid) { let total = 0; let hasPrediction = false; asArray(round?.matches).forEach((match) => { const result = match.finalResult; const prediction = match.predictions?.[uid]; if (!result || !prediction || prediction.homeScore === undefined || prediction.awayScore === undefined) return; hasPrediction = true; const standard = scorePrediction(result, prediction, prediction.isStarMatch === true); const wildcard = match.wildcardPredictions?.[uid]; const wildcardScore = wildcard && wildcard.homeScore !== undefined && wildcard.awayScore !== undefined ? scorePrediction(result, wildcard, false) : null; total += wildcardScore === null ? standard : Math.max(standard, wildcardScore); }); if (hasPrediction) total += calculateArtilheiroScore(round, uid); return total; }
function scorePrediction(result, prediction, isStar) { const home = Number(prediction.homeScore); const away = Number(prediction.awayScore); const actualHome = Number(result.homeScore); const actualAway = Number(result.awayScore); let points = home === actualHome && away === actualAway ? 3 : Math.sign(home - away) === Math.sign(actualHome - actualAway) ? 1 : home === actualAway && away === actualHome ? -1 : 0; if (isStar) points *= 2; return points; }
function calculateArtilheiroScore(round, uid) { const choice = round.starPlayers?.[uid]; const chosen = Array.isArray(choice?.players) ? choice.players : choice?.athleteId ? [{ id: choice.athleteId }] : []; if (!chosen.length) return 0; const captainId = String(choice.captainId || choice.athleteId || chosen[0]?.id || ''); const metrics = chosen.map((player) => ({ id: String(player.id || player.athleteId || ''), ...goalMetrics(round.playerGoals?.[player.id || player.athleteId]) })); const goals = metrics.reduce((sum, player) => sum + player.goals, 0); const captain = metrics.find((player) => player.id === captainId); const support = metrics.filter((player) => player.id !== captainId).reduce((sum, player) => sum + player.goals, 0); const strategy = choice.strategy || 'artilheiro'; const captainPoints = !captain ? 0 : strategy === 'garcom' ? captain.goals + captain.assists : strategy === 'hatTrick' ? captain.goals >= 3 ? 8 + captain.goals - 3 : captain.goals : captain.goals * 2; return support + captainPoints + (strategy === 'hatTrick' ? goals < 3 ? -3 : 0 : goals === 0 ? -1 : 0); }
function goalMetrics(value) { if (typeof value === 'number') return { goals: value, assists: 0 }; return { goals: Number(value?.count ?? value?.goals ?? value?.goalCount ?? 0), assists: Number(value?.assists ?? value?.assistsCount ?? value?.assistCount ?? 0) }; }

const styles = StyleSheet.create({ root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }, title: { color: '#F6F8FC', fontSize: 23, fontWeight: '900' }, muted: { color: '#9FB5CB', fontSize: 9, lineHeight: 14, marginTop: 4 }, panel: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 9, lineHeight: 14, marginTop: 4 }, body: { gap: 10, marginTop: 12 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choice: { minHeight: 32, paddingHorizontal: 9, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceOn: { borderColor: '#55754D', backgroundColor: '#15372F' }, choiceText: { color: '#AFC2D5', fontSize: 8, fontWeight: '800' }, choiceTextOn: { color: '#D7EFC2' }, playerSelect: { gap: 5 }, fieldLabel: { color: '#9FB5CB', fontSize: 8, letterSpacing: .55, fontWeight: '900' }, suggestion: { color: '#B9F276', fontSize: 9 }, chips: { gap: 5, paddingVertical: 4 }, notice: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, backgroundColor: '#102844' }, noticeText: { flex: 1, color: '#D7F7B9', fontSize: 9, lineHeight: 14 }, roundCard: { gap: 8, padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#314E69', backgroundColor: '#102844' }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between' }, subheading: { color: '#C4D3E2', fontSize: 9, fontWeight: '900' }, scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }, playerLabel: { flexGrow: 1, flexBasis: '28%', color: '#DDE8F4', fontSize: 8, fontWeight: '800' }, score: { width: 42, height: 36, textAlign: 'center', color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A' }, vs: { color: '#B9F276', fontWeight: '900' }, secondaryAction: { minHeight: 34, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 8, backgroundColor: '#183653', borderWidth: 1, borderColor: '#36536F' }, secondaryText: { color: '#D1DEEB', fontSize: 8, fontWeight: '900' }, success: { color: '#B9F276', fontSize: 9 }, drawText: { color: '#FFD987', fontSize: 9 }, gate: { padding: 10, color: '#FFD987', fontSize: 9, lineHeight: 14, borderRadius: 9, backgroundColor: '#382F28' }, message: { color: '#B9F276', fontSize: 9, lineHeight: 14 }, error: { color: '#FFB5A9' }, save: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#B9F276' }, saveText: { color: '#092447', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .5 } });
