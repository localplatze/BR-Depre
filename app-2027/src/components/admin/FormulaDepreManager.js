import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/formulaDepre/${SEASON}`;
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const COLORS = ['#1d4ed8', '#f97316', '#dc2626', '#14b8a6', '#15803d', '#2563eb', '#60a5fa', '#1e40af', '#22c55e', '#94a3b8', '#f59e0b', '#743CC1', '#D93D3D'];
const DEFAULT_TEAMS = [
  ['red-burro', 'Red Burro FC', '#1d4ed8'], ['mc-lata', 'McLata FC', '#f97316'], ['ferruja', 'Ferruja Corse', '#dc2626'],
  ['mercedao', 'Mercedao GP', '#14b8a6'], ['aston-maula', 'Aston Maula', '#15803d'], ['alpinada', 'Alpinada Racing', '#2563eb'],
  ['willi-massa', 'WilliMassa', '#60a5fa'], ['rb-bangu', 'RB Bangu', '#1e40af'], ['saube', 'Saube FC', '#22c55e'],
  ['haas-da-massa', 'Haas da Massa', '#94a3b8'], ['cadilacre', 'Cadilacre Speed Team', '#f59e0b'],
].map(([id, name, color]) => ({ id, name, color }));

export default function FormulaDepreManager({ players = [], memberships = {}, seasonStatus, adminUid }) {
  const [data, setData] = useState({});
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [assignments, setAssignments] = useState({});
  const [rounds, setRounds] = useState([]);
  const [status, setStatus] = useState('pending');
  const [stageFilter, setStageFilter] = useState('season');
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stopFormula = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setData(value); setTeams(normalizeTeams(value.teams)); setAssignments(value.assignments || {});
      setStatus(value.status || 'pending'); setStageFilter('season'); setLoading(false);
    }, () => { setMessage('Não foi possível carregar a Fórmula Deprê 2027.'); setLoading(false); });
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => setRounds(Object.entries(snapshot.val() || {}).map(([id, round]) => ({ id, ...round })).sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0))), () => setMessage('Não foi possível carregar as rodadas 2027.'));
    return () => { stopFormula(); stopRounds(); };
  }, []);

  const participants = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true && memberships[player.uid]?.tournaments?.formulaDepre === true), [players, memberships]);
  const playerById = useMemo(() => Object.fromEntries(players.map((player) => [player.uid, player])), [players]);
  const teamById = useMemo(() => Object.fromEntries(teams.map((team) => [team.id, team])), [teams]);
  const effectiveAssignments = useMemo(() => Object.fromEntries(participants.map((player) => [player.uid, Object.prototype.hasOwnProperty.call(assignments, player.uid) ? assignments[player.uid] || '' : player.formulaDepreTeamId || ''])), [participants, assignments]);
  const teamCounts = teams.map((team) => ({ ...team, drivers: participants.filter((player) => effectiveAssignments[player.uid] === team.id) }));
  const seasonActive = normalizeStatus(seasonStatus) === 'em_andamento';
  const locked = ['active', 'complete'].includes(status) || seasonActive;
  const activeRounds = useMemo(() => rounds.filter((round) => Number(round.status) === 2 && roundCountsFormula(round)), [rounds]);
  const ranking = useMemo(() => calculateFormula(activeRounds, participants, effectiveAssignments, teams, stageFilter), [activeRounds, participants, effectiveAssignments, teams, stageFilter]);

  function addTeam() {
    const name = newTeamName.trim(); if (!name) { setMessage('Digite o nome da escuderia.'); return; }
    if (teams.some((team) => team.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { setMessage('Já existe uma escuderia com esse nome.'); return; }
    const baseId = slug(name) || `equipe-${Date.now()}`; let id = baseId; let index = 2; while (teams.some((team) => team.id === id)) id = `${baseId}-${index++}`;
    setTeams((current) => [...current, { id, name, color: COLORS[current.length % COLORS.length] }]); setNewTeamName(''); setMessage('Escuderia adicionada. Salve para registrar.');
  }
  function removeTeam(teamId) {
    if (participants.some((player) => effectiveAssignments[player.uid] === teamId)) { setMessage('Transfira os pilotos antes de remover uma escuderia.'); return; }
    setTeams((current) => current.filter((team) => team.id !== teamId)); setMessage('Escuderia removida da configuração. Salve para registrar.');
  }
  function assign(uid, teamId) { if (locked) { setMessage('As escuderias e os pilotos ficam bloqueados depois do início da temporada.'); return; } setAssignments((current) => ({ ...current, [uid]: teamId })); }

  async function save() {
    if (!adminUid || saving) return;
    if (new Set(teams.map((team) => team.id)).size !== teams.length || new Set(teams.map((team) => team.name.toLocaleLowerCase('pt-BR'))).size !== teams.length) { setMessage('Nomes e códigos de escuderias precisam ser únicos.'); return; }
    const finalAssignments = { ...effectiveAssignments };
    if (locked) {
      const changed = participants.some((player) => (Object.prototype.hasOwnProperty.call(data.assignments || {}, player.uid) ? data.assignments[player.uid] || '' : player.formulaDepreTeamId || '') !== (finalAssignments[player.uid] || ''));
      const catalogChanged = JSON.stringify(normalizeTeams(data.teams)) !== JSON.stringify(teams);
      if (changed || catalogChanged) { setMessage('Não é permitido alterar a escalação depois do início da temporada.'); return; }
    }
    if (['ready', 'active', 'complete'].includes(status) && teams.length < 1) { setMessage('Cadastre ao menos uma escuderia.'); return; }
    if (['active', 'complete'].includes(status) && !seasonActive) { setMessage('A temporada precisa estar Em Andamento para iniciar ou concluir a Fórmula Deprê.'); return; }
    if (['active', 'complete'].includes(status) && participants.length < 1) { setMessage('Inclua pilotos aptos na Fórmula Deprê antes de iniciar.'); return; }
    if (['active', 'complete'].includes(status) && participants.some((player) => !teamById[finalAssignments[player.uid]])) { setMessage('Atribua uma escuderia válida a cada piloto participante antes de iniciar.'); return; }
    const counts = Object.values(finalAssignments).filter((teamId) => teamById[teamId]).reduce((result, teamId) => ({ ...result, [teamId]: (result[teamId] || 0) + 1 }), {});
    if (Object.values(counts).some((count) => count > 2)) { setMessage('Cada escuderia pode ter no máximo dois pilotos.'); return; }
    const now = Date.now();
    const computed = calculateFormula(activeRounds, participants, finalAssignments, teams, stageFilter);
    const next = { ...data, seasonYear: Number(SEASON), status, teams, assignments: finalAssignments, stageFilter: 'season', stageFilterLabel: 'Temporada completa', pointsSystem: POINTS, roundsProcessed: Object.keys(computed.rounds).length, rounds: computed.rounds, standings: computed.standings, constructors: computed.constructors, updatedAt: now, updatedBy: adminUid };
    const updates = { [PATH]: next };
    participants.forEach((player) => {
      const assigned = finalAssignments[player.uid] || null;
      updates[`users/${player.uid}/formulaDepreTeamId`] = assigned;
    });
    if (Object.keys(data).length) updates[`backups/tournaments/formulaDepre/${SEASON}/${now}`] = { reason: 'admin-config-update', createdAt: now, createdBy: adminUid, data };
    setSaving(true); setMessage('');
    try { await update(ref(database), updates); setMessage(`Fórmula Deprê salva. ${Object.keys(computed.rounds).length} rodada(s) processadas.`); }
    catch { setMessage('Não foi possível salvar a Fórmula Deprê. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.muted}>Carregando equipes e calendário…</Text></View>;
  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Fórmula Deprê 2027</Text><Text style={styles.muted}>Duplas por escuderia · sem premiação · equipes bloqueadas após a largada.</Text></View><MaterialDesignIcons name="flag-checkered" size={25} color="#8FE6FF" /></View>
    <View style={styles.metrics}><Metric label="PILOTOS INSCRITOS" value={participants.length} /><Metric label="ESCUDERIAS" value={teams.length} /><Metric label="RODADAS PROCESSADAS" value={Object.keys(data.rounds || {}).length} /><Metric label="LÍDER" value={leader(ranking.standings, playerById)} /></View>
    <Panel title="Status e cálculo" detail="A pontuação é atribuída aos dez melhores resultados de cada rodada elegível, preservando empates e saltando posições empatadas.">
      <Choices options={[["pending", "Aguardando"], ["ready", "Preparada"], ["active", "Em andamento"], ["complete", "Concluída"]]} value={status} onChange={setStatus} />
      <View style={styles.points}><Text style={styles.fieldLabel}>PONTOS POR POSIÇÃO</Text><Text style={styles.pointsText}>{POINTS.join(' · ')}</Text></View>
      <Text style={styles.fieldLabel}>RODADAS ENCERRADAS QUE CONTAM · {activeRounds.length}</Text>
      {activeRounds.map((round) => <Text key={round.id} style={styles.roundLine}>R{round.roundNumber || round.seqNumber || '—'} · {round.name || 'Rodada'} · considerada</Text>)}
      {!activeRounds.length && <Text style={styles.muted}>Nenhuma rodada encerrada marcada para a Fórmula Deprê.</Text>}
    </Panel>
    <Panel title="Escuderias" detail={locked ? 'Catálogo bloqueado após o início da temporada.' : 'Ajuste o grid antes da largada. Pode haver número ímpar de escuderias, como no formato atual.'}>
      {!locked && <View style={styles.addTeam}><TextInput value={newTeamName} onChangeText={setNewTeamName} placeholder="Nome da nova escuderia" placeholderTextColor="#8199B3" style={[styles.input, styles.teamInput]} /><Pressable accessibilityRole="button" onPress={addTeam} style={styles.addButton}><MaterialDesignIcons name="plus" size={17} color="#092447" /><Text style={styles.addText}>Adicionar</Text></Pressable></View>}
      {teamCounts.map((team) => <View key={team.id} style={styles.teamRow}><View style={[styles.teamColor, { backgroundColor: team.color }]} /><View style={styles.flex}><Text style={styles.teamName}>{team.name}</Text><Text style={styles.muted}>{team.drivers.length}/2 pilotos · {team.drivers.map((player) => player.name).join(' + ') || 'sem pilotos'}</Text></View>{!locked && <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${team.name}`} onPress={() => removeTeam(team.id)}><MaterialDesignIcons name="delete-outline" size={18} color="#FF9E91" /></Pressable>}</View>)}
      {!teams.length && <Text style={styles.muted}>Nenhuma escuderia cadastrada.</Text>}
    </Panel>
    <Panel title="Pilotos e atribuições" detail="Somente jogadores aptos e inscritos na Fórmula Deprê participam. O perfil também exibe a escuderia selecionada.">
      {participants.map((player) => <View key={player.uid} style={styles.driverCard}><View style={styles.driverHead}><Text style={styles.driverName}>{player.name}</Text><Text style={styles.driverTeam}>{teamById[effectiveAssignments[player.uid]]?.name || 'Sem escuderia'}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{teams.map((team) => <Choice key={team.id} label={team.name} selected={effectiveAssignments[player.uid] === team.id} onPress={() => assign(player.uid, team.id)} disabled={locked} />)}{effectiveAssignments[player.uid] && !locked && <Choice label="Remover" selected={false} onPress={() => assign(player.uid, '')} disabled={locked} />}</ScrollView></View>)}
      {!participants.length && <Text style={styles.muted}>Nenhum jogador apto e inscrito. Gerencie a participação na aba Jogadores.</Text>}
    </Panel>
    <Panel title="Classificação e resultados" detail="Recalcule à medida que resultados oficiais das rodadas 2027 forem encerrados.">
      {ranking.rows.map((item, index) => <View key={item.uid} style={styles.resultRow}><Text style={styles.rank}>{index + 1}</Text><View style={styles.flex}><Text style={styles.driverName}>{playerById[item.uid]?.name || item.displayName}</Text><Text style={styles.muted}>{teamById[effectiveAssignments[item.uid]]?.name || 'Sem escuderia'}</Text></View><Text style={styles.pointsValue}>{item.totalFormulaPoints} pts</Text><Text style={styles.muted}>{item.wins} vitória(s) · {item.podiums} pódio(s)</Text></View>)}
      {!ranking.rows.length && <Text style={styles.muted}>A classificação será calculada após as primeiras rodadas elegíveis.</Text>}
      <Text style={styles.fieldLabel}>CONSTRUTORES · SOMA DOS DOIS PILOTOS</Text>
      {ranking.constructors.filter((team) => team.drivers.length).map((team, index) => <View key={team.teamId} style={styles.resultRow}><Text style={styles.rank}>{index + 1}</Text><View style={styles.flex}><Text style={styles.driverName}>{team.teamName}</Text><Text style={styles.muted}>{team.drivers.map((uid) => playerById[uid]?.name || uid).join(' + ')}</Text></View><Text style={styles.pointsValue}>{team.totalFormulaPoints} pts</Text><Text style={styles.muted}>{team.wins} vitórias</Text></View>)}
      {Object.values(ranking.rounds).map((round) => <View key={round.roundId} style={styles.roundResult}><Text style={styles.roundResultTitle}>Rodada {round.roundNumber}</Text>{Object.values(round.results).sort((a, b) => a.rank - b.rank).map((entry) => <Text key={entry.userId} style={styles.roundResultLine}>{entry.rank}º {entry.displayName} · {entry.roundScore} pts · +{entry.formulaPoints} F1</Text>)}</View>)}
    </Panel>
    {!seasonActive && <Text style={styles.gate}>Temporada {seasonStatus || 'sem status'}: configure escuderias e pilotos; para iniciar ou atualizar a competição, a temporada precisa estar Em Andamento.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') || message.includes('precisa') || message.includes('Atribua') || message.includes('Digite') || message.includes('Transfira') ? styles.error : null]}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#092447" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#092447" />}<Text style={styles.saveText}>{saving ? 'Salvando e calculando…' : 'Salvar e calcular Fórmula Deprê'}</Text></Pressable>
  </View>;
}

function Panel({ title, detail, children }) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.body}>{children}</View></View>; }
function Metric({ label, value }) { return <View style={styles.metric}><Text numberOfLines={1} style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Choices({ options, value, onChange }) { return <View style={styles.choices}>{options.map(([id, label]) => <Choice key={id} label={label} selected={value === id} onPress={() => onChange(id)} />)}</View>; }
function Choice({ label, selected, onPress, disabled = false }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.choiceOn, disabled && styles.disabled]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>; }
function normalizeTeams(value) { if (!value) return DEFAULT_TEAMS; const values = Array.isArray(value) ? value : Object.entries(value).map(([id, team]) => ({ id, ...team })); return values.filter(Boolean).map((team) => ({ id: String(team.id || ''), name: String(team.name || ''), color: team.color || COLORS[0] })).filter((team) => team.id && team.name); }
function normalizeStatus(value) { return ({ active: 'em_andamento', open: 'em_andamento' })[value] || value; }
function roundCountsFormula(round) { return round?.tournamentConfig?.formulaDepre?.enabled === true || round?.tournamentConfig?.formulaDepre === true || round?.tournaments?.includes?.('formulaDepre'); }
function slug(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function displayName(player) { return player?.teamName || player?.name || player?.uid; }
function leader(standings, players) { const sorted = Object.values(standings || {}).sort((a, b) => b.totalFormulaPoints - a.totalFormulaPoints || b.wins - a.wins); return sorted[0] ? players[sorted[0].userId]?.name || sorted[0].displayName : '—'; }
function calculateFormula(rounds, participants, assignments, teams, filter) {
  const standings = {}; const roundsPayload = {};
  const orderedRounds = [...rounds].sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0));
  orderedRounds.forEach((round, roundIndex) => {
    const scores = participants.map((player) => ({ userId: player.uid, displayName: displayName(player), teamId: assignments[player.uid] || '', roundScore: roundScore(round, player.uid) }));
    const sorted = [...scores].sort((a, b) => b.roundScore - a.roundScore || a.displayName.localeCompare(b.displayName, 'pt-BR'));
    let rank = 1; let cursor = 0; const ranked = [];
    while (cursor < sorted.length) { const score = sorted[cursor].roundScore; let end = cursor + 1; while (end < sorted.length && sorted[end].roundScore === score) end += 1; sorted.slice(cursor, end).forEach((entry) => ranked.push({ ...entry, rank, formulaPoints: POINTS[rank - 1] || 0 })); rank += end - cursor; cursor = end; }
    const roundKey = round.id || `round-${roundIndex + 1}`;
    roundsPayload[roundKey] = { roundId: roundKey, roundNumber: Number(round.roundNumber || round.seqNumber || roundIndex + 1), stage: 'Temporada', label: `R${round.roundNumber || round.seqNumber || roundIndex + 1}`, results: Object.fromEntries(ranked.map((entry) => [entry.userId, { displayName: entry.displayName, teamId: entry.teamId, rank: entry.rank, formulaPoints: entry.formulaPoints, roundScore: entry.roundScore }])) };
    ranked.forEach((entry) => { if (!standings[entry.userId]) standings[entry.userId] = { userId: entry.userId, displayName: entry.displayName, teamId: entry.teamId, totalFormulaPoints: 0, wins: 0, podiums: 0, bestRank: Infinity, bestRoundScore: -Infinity, bestRoundLabel: '' }; const total = standings[entry.userId]; total.totalFormulaPoints += entry.formulaPoints; if (entry.rank === 1) total.wins += 1; if (entry.rank <= 3) total.podiums += 1; if (entry.roundScore > total.bestRoundScore || entry.roundScore === total.bestRoundScore && entry.rank < total.bestRank) { total.bestRoundScore = entry.roundScore; total.bestRank = entry.rank; total.bestRoundLabel = `R${roundsPayload[roundKey].roundNumber} (${entry.roundScore} pts)`; } });
  });
  const driverRows = Object.values(standings).sort((a, b) => b.totalFormulaPoints - a.totalFormulaPoints || b.wins - a.wins || a.displayName.localeCompare(b.displayName, 'pt-BR'));
  const constructorMap = Object.fromEntries(teams.map((team) => [team.id, { teamId: team.id, teamName: team.name, totalFormulaPoints: 0, wins: 0, podiums: 0, drivers: [] }]));
  driverRows.forEach((driver) => { const team = constructorMap[driver.teamId]; if (!team) return; team.totalFormulaPoints += driver.totalFormulaPoints; team.wins += driver.wins; team.podiums += driver.podiums; team.drivers.push(driver.userId); });
  const filtered = filter === 'season' ? roundsPayload : roundsPayload;
  return { rounds: filtered, standings, rows: driverRows, constructors: Object.values(constructorMap).sort((a, b) => b.totalFormulaPoints - a.totalFormulaPoints) };
}
function roundScore(round, uid) { let score = 0; asArray(round.matches).forEach((match) => { const prediction = match.predictions?.[uid]; const result = match.finalResult; if (!prediction || !result) return; const home = Number(prediction.homeScore); const away = Number(prediction.awayScore); const finalHome = Number(result.homeScore); const finalAway = Number(result.awayScore); if (![home, away, finalHome, finalAway].every(Number.isFinite)) return; if (home === finalHome && away === finalAway) score += 3; else if (Math.sign(home - away) === Math.sign(finalHome - finalAway)) score += 1; else if (home === finalAway && away === finalHome) score -= 1; }); const pick = round.starPlayers?.[uid]; if (pick?.athleteId) { const goals = round.playerGoals?.[pick.athleteId] || 0; score += typeof goals === 'number' ? goals : Number(goals.count || 0); } return score; }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }

const styles = StyleSheet.create({ root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { color: '#F6F8FC', fontSize: 23, fontWeight: '900' }, muted: { color: '#9FB5CB', fontSize: 8, lineHeight: 13, marginTop: 3 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, metric: { flexGrow: 1, minWidth: '22%', padding: 9, borderRadius: 10, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, metricValue: { color: '#8FE6FF', fontSize: 10, fontWeight: '900' }, metricLabel: { color: '#AFC5DD', fontSize: 7, marginTop: 3 }, panel: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 8, lineHeight: 13, marginTop: 4 }, body: { gap: 9, marginTop: 12 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, choice: { minHeight: 30, maxWidth: 160, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceOn: { borderColor: '#3E7683', backgroundColor: '#153344' }, choiceText: { color: '#AFC2D5', fontSize: 7, fontWeight: '800' }, choiceTextOn: { color: '#C5F5FF' }, points: { gap: 5, padding: 9, borderRadius: 8, backgroundColor: '#102844' }, fieldLabel: { color: '#9FB5CB', fontSize: 7, letterSpacing: .45, fontWeight: '900' }, pointsText: { color: '#8FE6FF', fontSize: 9, fontWeight: '900' }, roundLine: { color: '#DDE8F4', fontSize: 8 }, addTeam: { flexDirection: 'row', gap: 7, alignItems: 'center' }, input: { minHeight: 36, paddingHorizontal: 9, color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 9 }, teamInput: { flex: 1 }, addButton: { minHeight: 36, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, backgroundColor: '#8FE6FF' }, addText: { color: '#092447', fontSize: 8, fontWeight: '900' }, teamRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' }, teamColor: { width: 11, height: 32, borderRadius: 4 }, teamName: { color: '#EAF1F9', fontSize: 9, fontWeight: '900' }, driverCard: { gap: 5, padding: 8, borderRadius: 8, backgroundColor: '#102844' }, driverHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, driverName: { color: '#EAF1F9', fontSize: 8, fontWeight: '900' }, driverTeam: { color: '#8FE6FF', fontSize: 7, fontWeight: '800' }, chips: { gap: 5, paddingVertical: 3 }, resultRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.1)' }, rank: { width: 18, color: '#8FE6FF', fontSize: 8, fontWeight: '900' }, pointsValue: { color: '#8FE6FF', fontSize: 8, fontWeight: '900' }, roundResult: { padding: 8, borderRadius: 8, backgroundColor: '#102844' }, roundResultTitle: { color: '#8FE6FF', fontSize: 8, fontWeight: '900', marginBottom: 4 }, roundResultLine: { color: '#D1DEEB', fontSize: 7, lineHeight: 13 }, gate: { padding: 10, color: '#FFD987', fontSize: 8, lineHeight: 13, borderRadius: 9, backgroundColor: '#382F28' }, message: { color: '#8FE6FF', fontSize: 8, lineHeight: 13 }, error: { color: '#FFB5A9' }, save: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#8FE6FF' }, saveText: { color: '#092447', fontSize: 9, fontWeight: '900' }, disabled: { opacity: .5 } });
