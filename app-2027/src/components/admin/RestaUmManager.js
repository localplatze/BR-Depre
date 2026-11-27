import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/restaUm/${SEASON}`;

export default function RestaUmManager({ players = [], memberships = {}, loadingRoster, rosterError, seasonStatus, adminUid }) {
  const [data, setData] = useState({});
  const [participants, setParticipants] = useState([]);
  const [eliminations, setEliminations] = useState({});
  const [status, setStatus] = useState('pending');
  const [eliminationsPerRound, setEliminationsPerRound] = useState('1');
  const [exceptionReason, setExceptionReason] = useState('');
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState({});
  const [manualReason, setManualReason] = useState({});
  const [auditEvents, setAuditEvents] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stopData = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setData(value); setParticipants(asIds(value.participants)); setEliminations(value.eliminations || {});
      setStatus(value.status || 'pending'); setEliminationsPerRound(String(value.config?.eliminationsPerRound ?? 1));
      setExceptionReason(value.config?.exceptionReason || ''); setLoading(false);
    }, () => { setMessage('Não foi possível carregar a edição do Resta Um.'); setLoading(false); });
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => {
      const value = snapshot.val() || {};
      const list = Object.entries(value).map(([id, round]) => ({ id, ...round })).sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0));
      setRounds(list);
      setSelectedRound((current) => current && list.some((round) => round.id === current) ? current : list.find((round) => isCompletedRound(round) && isRestaRound(round))?.id || '');
    }, () => setMessage('Não foi possível carregar o calendário 2027.'));
    const stopStandings = onValue(ref(database, `tournaments/superliga/${SEASON}/regular/standings`), (snapshot) => setStandings(snapshot.val() || {}));
    return () => { stopData(); stopRounds(); stopStandings(); };
  }, []);

  const playersById = useMemo(() => Object.fromEntries(players.map((player) => [player.uid, player])), [players]);
  const eligible = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [players, memberships]);
  const eliminated = useMemo(() => new Set(Object.values(eliminations).map((entry) => entry?.eliminatedUserId).filter(Boolean)), [eliminations]);
  const survivors = participants.filter((uid) => !eliminated.has(uid));
  const completed = rounds.filter((round) => isCompletedRound(round) && isRestaRound(round));
  const seasonActive = normalizeStatus(seasonStatus) === 'em_andamento';
  const winnerId = status === 'complete' ? data.winnerUid || (survivors.length === 1 ? survivors[0] : '') : '';

  function toggleParticipant(uid) { setParticipants((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]); }
  function toggleManual(uid) {
    if (!participants.includes(uid)) { setMessage('Inclua o jogador na edição antes de registrar uma eliminação manual.'); return; }
    if (eliminated.has(uid)) {
      setEliminations((current) => Object.fromEntries(Object.entries(current).filter(([, entry]) => entry?.eliminatedUserId !== uid)));
      setAuditEvents((current) => [...current, { action: 'reinstated', userId: uid, reason: 'Reintegração manual pelo administrador', timestamp: Date.now(), updatedBy: adminUid }]);
      setMessage(`${playersById[uid]?.name || 'Jogador'} voltou para a disputa. A alteração ficará registrada no backup da edição.`);
      return;
    }
    const reason = String(manualReason[uid] || '').trim();
    if (!reason) { setMessage('Informe o motivo antes de registrar uma eliminação manual.'); return; }
    const key = `manual_${uid}_${Date.now()}`;
    setEliminations((current) => ({ ...current, [key]: { eliminatedUserId: uid, roundNumber: 'Manual', isManual: true, reason, timestamp: Date.now(), updatedBy: adminUid } }));
    setAuditEvents((current) => [...current, { action: 'manual_elimination', userId: uid, reason, timestamp: Date.now(), updatedBy: adminUid }]);
    setMessage(`${playersById[uid]?.name || 'Jogador'} será marcado como eliminado manualmente.`);
  }

  function calculateCut(roundId) {
    const round = rounds.find((item) => item.id === roundId);
    if (!round || !isCompletedRound(round) || !isRestaRound(round)) { setMessage('Escolha uma rodada encerrada e marcada para contar no Resta Um.'); return; }
    if (eliminations[roundId]) { setMessage('Esta rodada já tem corte registrado. Remova ou revise o registro antes de calcular novamente.'); return; }
    if (survivors.length <= 1) { setMessage('A edição já tem um único sobrevivente.'); return; }
    const count = Math.max(1, Math.min(Number(eliminationsPerRound) || 1, survivors.length - 1));
    if (count > 1 && !exceptionReason.trim()) { setMessage('Informe o motivo da eliminação excepcional de mais de um participante.'); return; }
    const candidates = survivors.map((uid) => ({ uid, score: calculateUserRoundScore(round, uid), superligaPosition: getPosition(standings, uid) }))
      .sort((a, b) => a.score - b.score || b.superligaPosition - a.superligaPosition);
    setPreview({ roundId, count, candidates, reason: count > 1 ? exceptionReason.trim() : '' }); setMessage('Prévia calculada. Confira os nomes e a classificação de desempate antes de confirmar.');
  }

  function confirmCut() {
    if (!preview) return;
    const round = rounds.find(({ id }) => id === preview.roundId);
    const remove = preview.candidates.slice(0, preview.count);
    const next = { ...eliminations };
    remove.forEach(({ uid, score, superligaPosition }, index) => {
      const key = remove.length === 1 ? preview.roundId : `${preview.roundId}_${uid}`;
      next[key] = { roundKey: preview.roundId, roundId: preview.roundId, roundNumber: Number(round?.roundNumber || round?.seqNumber || 0), eliminatedUserId: uid, score, superligaPosition, tieBreakerUsed: preview.candidates.filter((item) => item.score === score).length > 1, isManual: false, reason: preview.reason || null, timestamp: Date.now(), updatedBy: adminUid, order: index + 1 };
    });
    setAuditEvents((current) => [...current, { action: 'round_elimination', roundId: preview.roundId, userIds: remove.map(({ uid }) => uid), reason: preview.reason || null, timestamp: Date.now(), updatedBy: adminUid }]);
    setEliminations(next); setPreview(null); setEliminationsPerRound('1'); setExceptionReason('');
    setMessage(`${remove.map(({ uid }) => playersById[uid]?.name || uid).join(', ')} ${remove.length === 1 ? 'foi eliminado' : 'foram eliminados'} nesta rodada.`);
  }

  async function save() {
    if (!adminUid || saving) return;
    const count = Number(eliminationsPerRound);
    const hasCompetitionChanges = status !== (data.status || 'pending') || JSON.stringify(eliminations) !== JSON.stringify(data.eliminations || {});
    if (!seasonActive && hasCompetitionChanges) { setMessage('A temporada precisa estar Em Andamento para iniciar a edição ou registrar/reverter eliminações.'); return; }
    if (participants.some((uid) => !eligible.some((player) => player.uid === uid))) { setMessage('A edição só pode incluir jogadores aptos na temporada 2027.'); return; }
    if (new Set(participants).size !== participants.length) { setMessage('Há jogadores repetidos na lista de participantes.'); return; }
    if (status !== 'pending' && (!seasonActive || participants.length < 2)) { setMessage('Para iniciar ou concluir, a temporada deve estar em andamento e a edição precisa ter ao menos dois participantes.'); return; }
    if (!Number.isInteger(count) || count < 1) { setMessage('A quantidade de eliminações por rodada deve ser um número positivo.'); return; }
    if (count > 1 && !exceptionReason.trim() && !Object.values(eliminations).some((entry) => entry?.reason)) { setMessage('Eliminações múltiplas exigem o registro de um motivo.'); return; }
    const nextSurvivors = participants.filter((uid) => !new Set(Object.values(eliminations).map((entry) => entry?.eliminatedUserId).filter(Boolean)).has(uid));
    if (status === 'complete' && nextSurvivors.length !== 1) { setMessage('Só é possível concluir quando restar exatamente um participante.'); return; }
    const finalStatus = nextSurvivors.length === 1 ? 'complete' : status;
    const now = Date.now();
    const next = { ...data, season: Number(SEASON), status: finalStatus, started: finalStatus === 'active' || finalStatus === 'complete', participants, eliminations, history: [...asArray(data.history), ...auditEvents], winnerUid: nextSurvivors.length === 1 ? nextSurvivors[0] : null, config: { ...(data.config || {}), eliminationsPerRound: count, exceptionReason: exceptionReason.trim() || null }, updatedAt: now, updatedBy: adminUid };
    setSaving(true); setMessage('');
    try {
      const updates = { [PATH]: next };
      if (Object.keys(data).length) updates[`backups/tournaments/restaUm/${SEASON}/${now}`] = { reason: 'admin-config-update', createdAt: now, createdBy: adminUid, data };
      await update(ref(database), updates);
      setAuditEvents([]);
      setMessage('Edição do Resta Um salva com backup da configuração anterior.');
    } catch { setMessage('Não foi possível salvar o Resta Um. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  if (loading || loadingRoster) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.muted}>Carregando edição e participantes…</Text></View>;
  if (rosterError) return <View style={styles.panel}><Text style={styles.error}>{rosterError}</Text></View>;
  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Resta Um 2027</Text><Text style={styles.muted}>Início manual, um corte por rodada e desempate pela pior posição atual da Superliga.</Text></View><MaterialDesignIcons name="chess-king" size={25} color="#B9F276" /></View>
    <View style={styles.metrics}><Metric label="PARTICIPANTES" value={participants.length} /><Metric label="VIVOS" value={survivors.length} /><Metric label="ELIMINADOS" value={eliminated.size} /><Metric label="RODADAS ENCERRADAS" value={completed.length} /></View>
    <Panel title="Edição e participantes" detail="A próxima edição não começa sozinha. Selecione os jogadores aptos que vão participar.">
      <View style={styles.choices}>{[['pending', 'Aguardando início'], ['active', 'Em andamento'], ['complete', 'Concluída']].map(([id, label]) => <Choice key={id} label={label} selected={status === id} onPress={() => setStatus(id)} />)}</View>
      <View style={styles.playerList}>{eligible.map((player) => <Pressable key={player.uid} accessibilityRole="button" accessibilityState={{ selected: participants.includes(player.uid) }} onPress={() => toggleParticipant(player.uid)} style={styles.playerRow}><View style={styles.flex}><Text style={styles.playerName}>{player.name}</Text><Text style={styles.muted}>{memberships[player.uid]?.tournaments?.restaUm ? 'Inscrito na aba Jogadores' : 'Apto na temporada'}</Text></View><MaterialDesignIcons name={participants.includes(player.uid) ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={19} color={participants.includes(player.uid) ? '#B9F276' : '#8299B2'} /></Pressable>)}</View>
    </Panel>
    <Panel title="Apurar eliminação" detail="Só é possível processar rodadas encerradas, marcadas para contar no Resta Um e ainda sem corte. Em empate no último lugar, sai quem estiver pior na classificação vigente da Superliga.">
      <Text style={styles.fieldLabel}>RODADA ENCERRADA</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{completed.map((round) => <Choice key={round.id} label={`Rodada ${round.roundNumber || round.seqNumber || '—'}${eliminations[round.id] ? ' · apurada' : ''}`} selected={selectedRound === round.id} onPress={() => setSelectedRound(round.id)} disabled={Boolean(eliminations[round.id])} />)}</ScrollView>
      <View style={styles.fieldRow}><View style={styles.field}><Text style={styles.fieldLabel}>ELIMINAÇÕES NESTE CORTE</Text><TextInput value={eliminationsPerRound} onChangeText={setEliminationsPerRound} keyboardType="number-pad" style={styles.input} /></View><Text style={styles.inlineHint}>Padrão: uma pessoa por rodada.</Text></View>
      {Number(eliminationsPerRound) > 1 && <Field label="MOTIVO DA EXCEÇÃO" value={exceptionReason} onChangeText={setExceptionReason} placeholder="Ex.: sincronizar o fim com o calendário" />}
      <Action label="Calcular prévia do corte" icon="calculator-variant-outline" onPress={() => calculateCut(selectedRound)} />
      {preview && <View style={styles.preview}><Text style={styles.subheading}>PRÉVIA · RODADA {roundNumber(rounds.find(({ id }) => id === preview.roundId))}</Text>{preview.candidates.slice(0, Math.max(preview.count, 4)).map((item, index) => <View key={item.uid} style={styles.previewRow}><Text style={styles.rank}>{index + 1}º</Text><Text style={styles.playerName}>{playersById[item.uid]?.name || item.uid}</Text><Text style={styles.scoreText}>{item.score} pts</Text><Text style={styles.muted}>Superliga: {Number.isFinite(item.superligaPosition) ? `${item.superligaPosition}º` : 'sem posição'}</Text></View>)}<Text style={styles.warning}>Sai: {preview.candidates.slice(0, preview.count).map(({ uid }) => playersById[uid]?.name || uid).join(', ')}</Text><Action label="Confirmar eliminação" icon="skull-outline" onPress={confirmCut} /></View>}
    </Panel>
    <Panel title="Eliminações e sobreviventes" detail="Cada corte fica registrado por rodada. As ações manuais exigem motivo e toda gravação cria backup da edição anterior.">
      {participants.map((uid, index) => { const entry = Object.values(eliminations).find((item) => item?.eliminatedUserId === uid); return <View key={uid} style={styles.playerCard}><View style={styles.playerHeader}><View style={styles.flex}><Text style={styles.playerName}>{index + 1}. {playersById[uid]?.name || uid}</Text><Text style={[styles.state, entry ? styles.out : styles.alive]}>{entry ? `ELIMINADO · ${entry.isManual ? 'MANUAL' : `RODADA ${entry.roundNumber || '?'}`}` : 'VIVO'}</Text></View><MaterialDesignIcons name={entry ? 'skull-outline' : 'heart-outline'} size={19} color={entry ? '#FF9E91' : '#B9F276'} /></View>{entry?.reason && <Text style={styles.muted}>Motivo: {entry.reason}</Text>}{!entry && <Field label="MOTIVO PARA ELIMINAÇÃO MANUAL" value={manualReason[uid] || ''} onChangeText={(value) => setManualReason((current) => ({ ...current, [uid]: value }))} placeholder="Obrigatório" />}<Pressable accessibilityRole="button" onPress={() => toggleManual(uid)} style={[styles.secondaryAction, entry && styles.revive]}><MaterialDesignIcons name={entry ? 'heart-plus-outline' : 'account-remove-outline'} size={15} color="#D5E3F1" /><Text style={styles.secondaryText}>{entry ? 'Reintegrar à edição' : 'Eliminar manualmente'}</Text></Pressable></View>; })}
      {winnerId && <View style={styles.champion}><MaterialDesignIcons name="trophy" size={20} color="#B9F276" /><Text style={styles.championText}>CAMPEÃO · {playersById[winnerId]?.name || winnerId}</Text></View>}
    </Panel>
    {!seasonActive && <Text style={styles.gate}>Temporada {seasonStatus || 'sem status'}: configure a edição; para iniciar ou apurar cortes, marque a temporada como Em Andamento.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') || message.includes('exige') || message.includes('precisa') ? styles.error : null]}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#092447" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#092447" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar edição do Resta Um'}</Text></Pressable>
  </View>;
}

function Panel({ title, detail, children }) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.body}>{children}</View></View>; }
function Choice({ label, selected, onPress, disabled = false }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.choiceOn, disabled && styles.disabled]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>; }
function Action({ label, icon, onPress }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}><MaterialDesignIcons name={icon} size={16} color="#092447" /><Text style={styles.actionText}>{label}</Text></Pressable>; }
function Field({ label, value, onChangeText, placeholder }) { return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8199B3" style={styles.input} /></View>; }
function Metric({ label, value }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }
function asIds(value) { if (Array.isArray(value)) return value.filter(Boolean); return Object.keys(value || {}); }
function isCompletedRound(round) { return Number(round?.status) === 2 || round?.status === 'complete' || round?.status === 'completed'; }
function isRestaRound(round) { return round?.tournamentConfig?.restaUm?.enabled === true || round?.tournamentConfig?.restaUm === true || round?.tournaments?.includes?.('restaUm'); }
function roundNumber(round) { return round?.roundNumber || round?.seqNumber || '?'; }
function normalizeStatus(value) { return ({ active: 'em_andamento', open: 'em_andamento' })[value] || value; }
function getPosition(raw, uid) { const rows = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([id, row]) => ({ uid: id, ...(row || {}) })); const found = rows.find((row) => (row.uid || row.playerId || row.userId) === uid); return Number(found?.position) || 9999; }
function calculateUserRoundScore(round, uid) { let total = 0; let hasPrediction = false; asArray(round?.matches).forEach((match) => { const result = match.finalResult; const prediction = match.predictions?.[uid]; if (!result || !prediction || prediction.homeScore === undefined || prediction.awayScore === undefined) return; hasPrediction = true; const standard = scorePrediction(result, prediction, prediction.isStarMatch === true); const wildcard = match.wildcardPredictions?.[uid]; const wildcardScore = wildcard && wildcard.homeScore !== undefined && wildcard.awayScore !== undefined ? scorePrediction(result, wildcard, false) : null; total += wildcardScore === null ? standard : Math.max(standard, wildcardScore); }); if (hasPrediction) total += calculateArtilheiroScore(round, uid); return total; }
function scorePrediction(result, prediction, isStar) { const home = Number(prediction.homeScore); const away = Number(prediction.awayScore); const actualHome = Number(result.homeScore); const actualAway = Number(result.awayScore); let points = home === actualHome && away === actualAway ? 3 : Math.sign(home - away) === Math.sign(actualHome - actualAway) ? 1 : home === actualAway && away === actualHome ? -1 : 0; if (isStar) points *= 2; return points; }
function calculateArtilheiroScore(round, uid) { const choice = round.starPlayers?.[uid]; const chosen = Array.isArray(choice?.players) ? choice.players : choice?.athleteId ? [{ id: choice.athleteId }] : []; if (!chosen.length) return 0; const captainId = String(choice.captainId || choice.athleteId || chosen[0]?.id || ''); const metrics = chosen.map((player) => ({ id: String(player.id || player.athleteId || ''), ...goalMetrics(round.playerGoals?.[player.id || player.athleteId]) })); const goals = metrics.reduce((sum, player) => sum + player.goals, 0); const captain = metrics.find((player) => player.id === captainId); const support = metrics.filter((player) => player.id !== captainId).reduce((sum, player) => sum + player.goals, 0); const strategy = choice.strategy || 'artilheiro'; const captainPoints = !captain ? 0 : strategy === 'garcom' ? captain.goals + captain.assists : strategy === 'hatTrick' ? captain.goals >= 3 ? 8 + captain.goals - 3 : captain.goals : captain.goals * 2; return support + captainPoints + (strategy === 'hatTrick' ? goals < 3 ? -3 : 0 : goals === 0 ? -1 : 0); }
function goalMetrics(value) { if (typeof value === 'number') return { goals: value, assists: 0 }; return { goals: Number(value?.count ?? value?.goals ?? value?.goalCount ?? 0), assists: Number(value?.assists ?? value?.assistsCount ?? value?.assistCount ?? 0) }; }

const styles = StyleSheet.create({ root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }, title: { color: '#F6F8FC', fontSize: 23, fontWeight: '900' }, muted: { color: '#9FB5CB', fontSize: 9, lineHeight: 14, marginTop: 3 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, metric: { flexGrow: 1, minWidth: '22%', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, metricValue: { color: '#B9F276', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#AFC5DD', fontSize: 7, marginTop: 3 }, panel: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 9, lineHeight: 14, marginTop: 4 }, body: { gap: 9, marginTop: 12 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choice: { minHeight: 32, paddingHorizontal: 9, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceOn: { borderColor: '#55754D', backgroundColor: '#15372F' }, choiceText: { color: '#AFC2D5', fontSize: 8, fontWeight: '800' }, choiceTextOn: { color: '#D7EFC2' }, playerList: { maxHeight: 300 }, playerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' }, playerName: { color: '#EAF1F9', fontSize: 9, fontWeight: '800' }, fieldLabel: { color: '#9FB5CB', fontSize: 8, letterSpacing: .55, fontWeight: '900' }, chips: { gap: 5, paddingVertical: 4 }, fieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, field: { width: 120 }, input: { minHeight: 38, paddingHorizontal: 9, color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 10 }, inlineHint: { flex: 1, color: '#9FB5CB', fontSize: 8, paddingBottom: 10 }, action: { minHeight: 36, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 8, backgroundColor: '#B9F276' }, actionText: { color: '#092447', fontSize: 8, fontWeight: '900' }, preview: { gap: 7, padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#55754D', backgroundColor: '#102844' }, subheading: { color: '#C4D3E2', fontSize: 9, fontWeight: '900' }, previewRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.1)' }, rank: { color: '#B9F276', fontSize: 8, fontWeight: '900' }, scoreText: { color: '#F0F5FA', fontSize: 8 }, warning: { color: '#FFD987', fontSize: 9, fontWeight: '800' }, playerCard: { gap: 6, padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#314E69', backgroundColor: '#102844' }, playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, state: { fontSize: 7, fontWeight: '900', marginTop: 3 }, out: { color: '#FF9E91' }, alive: { color: '#B9F276' }, secondaryAction: { minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 8, backgroundColor: '#183653', borderWidth: 1, borderColor: '#36536F' }, revive: { borderColor: '#55754D' }, secondaryText: { color: '#D1DEEB', fontSize: 8, fontWeight: '900' }, champion: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: '#15372F' }, championText: { color: '#D7F7B9', fontSize: 10, fontWeight: '900' }, gate: { padding: 10, color: '#FFD987', fontSize: 9, lineHeight: 14, borderRadius: 9, backgroundColor: '#382F28' }, message: { color: '#B9F276', fontSize: 9, lineHeight: 14 }, error: { color: '#FFB5A9' }, save: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#B9F276' }, saveText: { color: '#092447', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .5 } });
