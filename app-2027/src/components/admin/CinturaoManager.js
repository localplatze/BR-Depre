import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/cinturao/${SEASON}`;
const MATCH_STATUS = [['0', 'Agendado'], ['1', 'Em andamento'], ['2', 'Finalizado']];

export default function CinturaoManager({ players = [], seasonStatus, adminUid }) {
  const [data, setData] = useState({});
  const [supercopa, setSupercopa] = useState({});
  const [rounds, setRounds] = useState([]);
  const [championId, setChampionId] = useState('');
  const [challengerId, setChallengerId] = useState('');
  const [defenses, setDefenses] = useState('0');
  const [queue, setQueue] = useState([]);
  const [currentMatch, setCurrentMatch] = useState({ status: 0, champScore: '', challengerScore: '' });
  const [period, setPeriod] = useState(() => currentManausMonth());
  const [queueCandidate, setQueueCandidate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stopBelt = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {}; const match = value.currentMatch || {};
      setData(value); setChampionId(value.championId || ''); setChallengerId(value.challengerId || ''); setDefenses(String(value.defenses || 0));
      setQueue(asArray(value.challengerQueue)); setCurrentMatch({ ...match, status: Number(match.status || 0), champScore: match.champScore == null ? '' : String(match.champScore), challengerScore: match.challengerScore == null ? '' : String(match.challengerScore) });
      setPeriod(match.processedMonth || currentManausMonth()); setLoading(false);
    }, () => { setMessage('Não foi possível carregar a edição do Cinturão.'); setLoading(false); });
    const stopSupercopa = onValue(ref(database, `tournaments/supercopa/${SEASON}`), (snapshot) => setSupercopa(snapshot.val() || {}));
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => setRounds(Object.entries(snapshot.val() || {}).map(([id, round]) => ({ id, ...round }))));
    return () => { stopBelt(); stopSupercopa(); stopRounds(); };
  }, []);

  const playersById = useMemo(() => Object.fromEntries(players.map((player) => [player.uid, player])), [players]);
  const available = players.filter((player) => player.uid !== championId && !queue.includes(player.uid));
  const completedDuels = useMemo(() => {
    const enabledRoundIds = new Set(rounds.filter((round) => round.tournamentConfig?.cinturao?.enabled === true || round.tournamentConfig?.cinturao === true || round.tournaments?.includes?.('cinturao')).map((round) => round.id));
    return asArray(supercopa.groupRounds).flatMap((round) => asArray(round.matches).filter((match) => round.status === 2 && enabledRoundIds.has(round.sourceRoundId) && match.player1Id && match.player2Id && match.player1Score !== '' && match.player2Score !== '').map((match) => ({ ...match, roundLabel: round.label || round.id, sourceRoundId: round.sourceRoundId, sourceSupercopaRoundId: round.id })));
  }, [supercopa, rounds]);
  const champion = playersById[championId];
  const challenger = playersById[challengerId];
  const resultReady = currentMatch.status === 2 && currentMatch.champScore !== '' && currentMatch.challengerScore !== '' && challengerId;
  const resultWinner = resultReady ? Number(currentMatch.champScore) >= Number(currentMatch.challengerScore) ? championId : challengerId : '';
  const seasonActive = normalizeStatus(seasonStatus) === 'em_andamento';

  function importSupercopaDuel(duel) {
    if (!championId || ![duel.player1Id, duel.player2Id].includes(championId)) { setMessage('O duelo selecionado precisa incluir o detentor atual do Cinturão.'); return; }
    const isPlayer1Champion = duel.player1Id === championId;
    setChallengerId(isPlayer1Champion ? duel.player2Id : duel.player1Id);
    setCurrentMatch((current) => ({ ...current, status: 2, champScore: String(isPlayer1Champion ? duel.player1Score : duel.player2Score), challengerScore: String(isPlayer1Champion ? duel.player2Score : duel.player1Score), sourceRoundId: duel.sourceRoundId || null, sourceSupercopaRoundId: duel.sourceSupercopaRoundId, processedFromSupercopaMatchKey: duel.id, matchKey: `supercopa-${duel.sourceSupercopaRoundId}-${duel.id}` }));
    setMessage(`Duelo encerrado importado: ${duel.roundLabel}. Confira o mês antes de salvar.`);
  }

  function addToQueue() {
    if (!queueCandidate) { setMessage('Selecione um desafiante para adicionar à fila.'); return; }
    if (queueCandidate === championId || queue.includes(queueCandidate)) { setMessage('O campeão ou um nome já na fila não pode ser adicionado novamente.'); return; }
    setQueue((current) => [...current, queueCandidate]); setQueueCandidate(''); setMessage('Desafiante adicionado à fila.');
  }
  function moveQueue(index, direction) { const target = index + direction; if (target < 0 || target >= queue.length) return; setQueue((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }

  async function save() {
    if (!adminUid || saving) return;
    if (!championId || !playersById[championId]) { setMessage('Defina o detentor do Cinturão.'); return; }
    if (challengerId && (challengerId === championId || !playersById[challengerId])) { setMessage('O desafiante deve ser diferente do campeão.'); return; }
    if (new Set(queue).size !== queue.length || queue.some((uid) => uid === championId || !playersById[uid])) { setMessage('Revise a fila de desafiantes; ela deve conter jogadores diferentes do campeão.'); return; }
    if (!Number.isInteger(Number(defenses)) || Number(defenses) < 0) { setMessage('Informe um número válido de defesas.'); return; }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) { setMessage('Use o período no formato AAAA-MM.'); return; }
    if (Number(currentMatch.status) > 0 && !seasonActive) { setMessage('A temporada precisa estar Em Andamento para iniciar ou atualizar o duelo.'); return; }
    if (Number(currentMatch.status) === 2 && (!challengerId || currentMatch.champScore === '' || currentMatch.challengerScore === '')) { setMessage('Para finalizar o duelo, informe desafiante e os dois placares.'); return; }
    const now = Date.now();
    const currentMatchKey = currentMatch.matchKey || `belt-2027-${now}`;
    let finalChampionId = championId; let finalChallengerId = challengerId; let finalDefenses = Number(defenses); let finalQueue = [...queue];
    const history = { ...(data.history || {}) };
    if (Number(currentMatch.status) === 2) {
      const previousHistory = Object.values(history).find((item) => item?.matchKey === currentMatchKey);
      if (!previousHistory && Object.values(history).some((item) => item?.processedMonth === period)) { setMessage('Já existe uma disputa do Cinturão registrada neste mês de Manaus.'); return; }
      if (!previousHistory) {
        const champScore = Number(currentMatch.champScore); const challengerScore = Number(currentMatch.challengerScore);
        const winner = challengerScore > champScore ? challengerId : championId;
        const outcomeLabel = winner === challengerId ? 'Troca de cinturão: o desafiante venceu.' : 'Defesa bem-sucedida: o campeão manteve o cinturão.';
        finalChampionId = winner; finalDefenses = winner === challengerId ? 1 : finalDefenses + 1;
        finalQueue = finalQueue.filter((uid) => uid !== challengerId && uid !== finalChampionId);
        let nextChallengerId = '';
        while (finalQueue.length && !nextChallengerId) { const candidate = finalQueue.shift(); if (candidate && candidate !== finalChampionId) nextChallengerId = candidate; }
        finalChallengerId = nextChallengerId;
        const historyKey = `belt-${now}`;
        history[historyKey] = { matchKey: currentMatchKey, period, previousChampionId: championId, championId: winner, challengerId, championName: displayName(playersById[championId]), challengerName: displayName(playersById[challengerId]), champScore, challengerScore, result: `${champScore} x ${challengerScore}`, outcomeLabel, defensesAfter: finalDefenses, processedMonth: period, sourceRoundId: currentMatch.sourceRoundId || null, sourceSupercopaRoundId: currentMatch.sourceSupercopaRoundId || null, timestamp: now, updatedBy: adminUid };
      }
    }
    const nowMatch = Number(currentMatch.status) === 2 && !Object.values(data.history || {}).some((item) => item?.matchKey === currentMatchKey)
      ? { ...currentMatch, championId: finalChampionId, challengerId: finalChallengerId, champScore: '', challengerScore: '', status: 0, timestamp: now }
      : { ...currentMatch, matchKey: currentMatchKey, championId, challengerId, status: Number(currentMatch.status), champScore: currentMatch.champScore === '' ? null : Number(currentMatch.champScore), challengerScore: currentMatch.challengerScore === '' ? null : Number(currentMatch.challengerScore), processedMonth: period, timestamp: now };
    const next = { ...data, season: Number(SEASON), championId: finalChampionId, challengerId: finalChallengerId, defenses: finalDefenses, challengerQueue: finalQueue, currentMatch: nowMatch, history, updatedAt: now, updatedBy: adminUid };
    setSaving(true); setMessage('');
    try {
      const updates = { [PATH]: next };
      if (Object.keys(data).length) updates[`backups/tournaments/cinturao/${SEASON}/${now}`] = { reason: 'admin-config-update', createdAt: now, createdBy: adminUid, data };
      await update(ref(database), updates); setMessage('Estado do Cinturão salvo com backup da versão anterior.');
    } catch { setMessage('Não foi possível salvar o Cinturão. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.muted}>Carregando o Cinturão…</Text></View>;
  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Cinturão 2027</Text><Text style={styles.muted}>Detentor, defesa mensal, fila de desafiantes e histórico.</Text></View><MaterialDesignIcons name="belt" size={25} color="#F5D05A" /></View>
    <View style={styles.summary}><Stat label="DETENTOR" value={displayName(champion)} /><Stat label="DESAFIANTE" value={displayName(challenger)} /><Stat label="DEFESAS" value={Number(defenses) || 0} /><Stat label="FILA" value={queue.length} /></View>
    <Panel title="Campeão e próximo desafio" detail="A ordem da fila define o próximo desafiante quando uma defesa for processada.">
      <PlayerChoices label="DETENTOR DO CINTURÃO" players={players} selected={championId} onSelect={(id) => { setChampionId(id); if (id === challengerId) setChallengerId(''); }} />
      <PlayerChoices label="DESAFIANTE DA VEZ" players={players.filter((player) => player.uid !== championId)} selected={challengerId} onSelect={setChallengerId} />
      <Field label="DEFESAS CONSECUTIVAS" value={defenses} onChangeText={setDefenses} keyboardType="number-pad" />
    </Panel>
    <Panel title="Duelo atual" detail="O mês é registrado no fuso de Manaus; só é permitido um resultado por mês.">
      <Text style={styles.fieldLabel}>PERÍODO (MANAUS)</Text><TextInput value={period} onChangeText={setPeriod} placeholder="2027-01" placeholderTextColor="#8199B3" style={styles.input} />
      <Text style={styles.fieldLabel}>STATUS DO CONFRONTO</Text><Choices options={MATCH_STATUS} value={String(currentMatch.status)} onChange={(value) => setCurrentMatch((current) => ({ ...current, status: Number(value) }))} />
      <View style={styles.scoreLine}><Text style={styles.sideLabel}>{displayName(champion)}</Text><Score value={currentMatch.champScore} onChange={(value) => setCurrentMatch((current) => ({ ...current, champScore: value }))} /><Text style={styles.vs}>×</Text><Score value={currentMatch.challengerScore} onChange={(value) => setCurrentMatch((current) => ({ ...current, challengerScore: value }))} /><Text style={styles.sideLabel}>{displayName(challenger)}</Text></View>
      {resultReady && <Text style={styles.winner}>Resultado: {displayName(playersById[resultWinner])} {resultWinner === championId ? 'defende o cinturão' : 'assume o cinturão'}</Text>}
      <Text style={styles.fieldLabel}>IMPORTAR UM DUELO ENCERRADO DA SUPERCOPA 2027</Text>
      {completedDuels.filter((match) => [match.player1Id, match.player2Id].includes(championId)).map((match) => <Pressable key={`${match.sourceSupercopaRoundId}-${match.id}`} accessibilityRole="button" onPress={() => importSupercopaDuel(match)} style={styles.importRow}><MaterialDesignIcons name="download-outline" size={16} color="#B9F276" /><Text style={styles.importText}>{match.roundLabel} · {roundName(match.sourceRoundId)} · {displayName(playersById[match.player1Id])} {match.player1Score} × {match.player2Score} {displayName(playersById[match.player2Id])}</Text></Pressable>)}
      {!completedDuels.some((match) => [match.player1Id, match.player2Id].includes(championId)) && <Text style={styles.muted}>Nenhum duelo encerrado do detentor está disponível para importar.</Text>}
      {!!currentMatch.sourceRoundId && <Text style={styles.muted}>Vinculado à rodada 2027: {roundName(currentMatch.sourceRoundId)}</Text>}
    </Panel>
    <Panel title="Fila de desafiantes" detail="Reordene a fila; o próximo jogador será chamado após a defesa ser finalizada.">
      <PlayerChoices label="ADICIONAR À FILA" players={available} selected={queueCandidate} onSelect={setQueueCandidate} />
      <Action label="Adicionar desafiante" icon="plus" onPress={addToQueue} />
      {queue.map((uid, index) => <View key={`${uid}-${index}`} style={styles.queueRow}><Text style={styles.queueRank}>{index + 1}</Text><Text style={styles.queueName}>{displayName(playersById[uid])}</Text><Pressable accessibilityRole="button" accessibilityLabel="Mover para cima" disabled={index === 0} onPress={() => moveQueue(index, -1)}><MaterialDesignIcons name="arrow-up" size={18} color={index === 0 ? '#647A91' : '#D4E1ED'} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Mover para baixo" disabled={index === queue.length - 1} onPress={() => moveQueue(index, 1)}><MaterialDesignIcons name="arrow-down" size={18} color={index === queue.length - 1 ? '#647A91' : '#D4E1ED'} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remover da fila" onPress={() => setQueue((current) => current.filter((_, itemIndex) => itemIndex !== index))}><MaterialDesignIcons name="delete-outline" size={18} color="#FF9E91" /></Pressable></View>)}
      {!queue.length && <Text style={styles.muted}>A fila ainda está vazia.</Text>}
    </Panel>
    <Panel title="Histórico de defesas" detail="Resultados preservados com desafiante, placar, período e consequência no cinturão.">
      {Object.entries(data.history || {}).map(([id, item]) => ({ id, ...item })).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).map((item) => <View key={item.id} style={styles.historyRow}><Text style={styles.historyTitle}>{item.championName || displayName(playersById[item.championId])} {item.result || ''} {item.challengerName || displayName(playersById[item.challengerId])}</Text><Text style={styles.muted}>{item.period || 'Período sem registro'} · {item.outcomeLabel || 'Duelo processado'} · {item.defensesAfter || 0} defesa(s)</Text></View>)}
      {!Object.keys(data.history || {}).length && <Text style={styles.muted}>Ainda não há histórico nesta edição.</Text>}
    </Panel>
    {!seasonActive && <Text style={styles.gate}>Temporada {seasonStatus || 'sem status'}: prepare detentor e fila; para iniciar ou finalizar um duelo, a temporada precisa estar Em Andamento.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') || message.includes('precisa') || message.includes('Defina') || message.includes('informe') ? styles.error : null]}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#092447" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#092447" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar estado do Cinturão'}</Text></Pressable>
  </View>;
}

function displayName(player) { return player?.teamName ? `${player.teamName} (${player.name})` : player?.name || 'A definir'; }
function roundName(id) { return String(id || '').replace(/^round/i, 'Rodada '); }
function currentManausMonth() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit' }).format(new Date()); }
function normalizeStatus(value) { return ({ active: 'em_andamento', open: 'em_andamento' })[value] || value; }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.entries(value || {}).map(([id, item]) => ({ id, ...(item || {}) })); }
function Panel({ title, detail, children }) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.body}>{children}</View></View>; }
function Field({ label, value, onChangeText, keyboardType }) { return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput value={String(value ?? '')} onChangeText={onChangeText} keyboardType={keyboardType || 'default'} style={styles.input} /></View>; }
function Choices({ options, value, onChange }) { return <View style={styles.choices}>{options.map(([id, label]) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: value === id }} onPress={() => onChange(id)} style={[styles.choice, value === id && styles.choiceOn]}><Text style={[styles.choiceText, value === id && styles.choiceTextOn]}>{label}</Text></Pressable>)}</View>; }
function PlayerChoices({ label, players, selected, onSelect }) { return <View><Text style={styles.fieldLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{players.map((player) => <Pressable key={player.uid} accessibilityRole="button" accessibilityState={{ selected: selected === player.uid }} onPress={() => onSelect(selected === player.uid ? '' : player.uid)} style={[styles.choice, selected === player.uid && styles.choiceOn]}><Text numberOfLines={1} style={[styles.choiceText, selected === player.uid && styles.choiceTextOn]}>{displayName(player)}</Text></Pressable>)}</ScrollView></View>; }
function Score({ value, onChange }) { return <TextInput value={String(value ?? '')} onChangeText={(text) => onChange(text.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" style={styles.score} placeholder="0" placeholderTextColor="#8299B2" />; }
function Action({ label, icon, onPress }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}><MaterialDesignIcons name={icon} size={16} color="#092447" /><Text style={styles.actionText}>{label}</Text></Pressable>; }
function Stat({ label, value }) { return <View style={styles.stat}><Text numberOfLines={1} style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { color: '#F6F8FC', fontSize: 23, fontWeight: '900' }, muted: { color: '#9FB5CB', fontSize: 8, lineHeight: 13, marginTop: 3 }, summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, stat: { flexGrow: 1, minWidth: '22%', padding: 9, borderRadius: 10, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, statValue: { color: '#F5D05A', fontSize: 10, fontWeight: '900' }, statLabel: { color: '#AFC5DD', fontSize: 7, marginTop: 3 }, panel: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 8, lineHeight: 13, marginTop: 4 }, body: { gap: 9, marginTop: 12 }, fieldLabel: { color: '#9FB5CB', fontSize: 7, letterSpacing: .45, fontWeight: '900', marginTop: 3 }, input: { minHeight: 36, paddingHorizontal: 9, color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 10 }, chips: { gap: 5, paddingVertical: 4 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, choice: { maxWidth: 190, minHeight: 30, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceOn: { borderColor: '#756C40', backgroundColor: '#383321' }, choiceText: { color: '#AFC2D5', fontSize: 7, fontWeight: '800' }, choiceTextOn: { color: '#F8E7A1' }, scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 5 }, sideLabel: { flex: 1, color: '#DDE8F4', fontSize: 7, fontWeight: '800' }, score: { width: 46, height: 36, textAlign: 'center', color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 10 }, vs: { color: '#F5D05A', fontWeight: '900' }, winner: { color: '#F5D05A', fontSize: 9, fontWeight: '900' }, importRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#102844' }, importText: { flex: 1, color: '#D1DEEB', fontSize: 7 }, action: { minHeight: 34, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 8, backgroundColor: '#F5D05A' }, actionText: { color: '#092447', fontSize: 8, fontWeight: '900' }, queueRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#102844' }, queueRank: { color: '#F5D05A', fontSize: 9, fontWeight: '900' }, queueName: { flex: 1, color: '#DDE8F4', fontSize: 8, fontWeight: '800' }, historyRow: { gap: 3, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#102844' }, historyTitle: { color: '#F0F5FA', fontSize: 8, fontWeight: '900' }, gate: { padding: 10, color: '#FFD987', fontSize: 8, lineHeight: 13, borderRadius: 9, backgroundColor: '#382F28' }, message: { color: '#F5D05A', fontSize: 8, lineHeight: 13 }, error: { color: '#FFB5A9' }, save: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#F5D05A' }, saveText: { color: '#092447', fontSize: 9, fontWeight: '900' }, disabled: { opacity: .5 } });
