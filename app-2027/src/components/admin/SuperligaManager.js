import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const PATH = `tournaments/superliga/${SEASON}`;
const PHASES = [
  { id: 'regular', label: 'Fase geral' },
  { id: 'top8', label: 'Liga do Top 8' },
  { id: 'secondary', label: 'X-Salada' },
];
const STAGES = [
  { id: '', label: 'Não conta' },
  { id: 'regular', label: 'Fase geral' },
  { id: 'top8', label: 'Top 8' },
  { id: 'secondary', label: 'X-Salada' },
];
const PHASE_STATUS = [
  { id: 'pending', label: 'Aguardando' },
  { id: 'ready', label: 'Pronta' },
  { id: 'active', label: 'Em andamento' },
  { id: 'complete', label: 'Concluída' },
];

export default function SuperligaManager({ players = [], memberships = {}, loadingRoster, rosterError, seasonStatus, adminUid }) {
  const [league, setLeague] = useState({});
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [cutoff, setCutoff] = useState('30');
  const [currentBrazilRound, setCurrentBrazilRound] = useState('0');
  const [bonuses, setBonuses] = useState(['6', '4', '2', '1']);
  const [top8Ids, setTop8Ids] = useState([]);
  const [secondaryIds, setSecondaryIds] = useState([]);
  const [roundStages, setRoundStages] = useState({});
  const [phase, setPhase] = useState('regular');
  const [champions, setChampions] = useState({});
  const [bracketSlots, setBracketSlots] = useState('');
  const [byeCount, setByeCount] = useState('0');
  const [pairingMode, setPairingMode] = useState('');
  const [secondaryWinner, setSecondaryWinner] = useState('');

  useEffect(() => {
    const stopLeague = onValue(ref(database, PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setLeague(value);
      const config = value.config || {};
      setCutoff(String(config.cutoffBrasileiraoRound || value.regular?.cutoffBrasileiraoRound || 30));
      setCurrentBrazilRound(String(value.regular?.currentBrasileiraoRound || 0));
      const bonus = config.top8BonusByPosition || {};
      setBonuses([1, 2, 3, 4].map((position, index) => String(bonus[position] ?? [6, 4, 2, 1][index])));
      setTop8Ids(asIds(value.top8?.participants));
      setSecondaryIds(asIds(value.secondary?.participants));
      setChampions(value.champions || {});
      setBracketSlots(String(value.secondary?.config?.slots ?? ''));
      setByeCount(String(value.secondary?.config?.byes ?? 0));
      setPairingMode(value.secondary?.config?.pairingMode || '');
      setSecondaryWinner(value.secondary?.championUid || '');
      setLoading(false);
      setMessage('');
    }, () => { setLoading(false); setMessage('Não foi possível carregar a configuração da Superliga.'); });
    const stopRounds = onValue(ref(database, `seasons/${SEASON}/rounds`), (snapshot) => {
      const value = snapshot.val() || {};
      const nextRounds = Object.entries(value).map(([id, round]) => ({ id, ...round }))
        .sort((a, b) => Number(a.roundNumber || a.seqNumber || 0) - Number(b.roundNumber || b.seqNumber || 0));
      setRounds(nextRounds);
      setRoundStages(Object.fromEntries(nextRounds.map((round) => [round.id, round.superligaStage || (round.tournaments?.includes?.('superliga') || round.tournamentConfig?.superliga?.enabled ? 'regular' : '')])));
    }, () => setMessage('Não foi possível carregar as rodadas para vincular às etapas.'));
    return () => { stopLeague(); stopRounds(); };
  }, []);

  const eligiblePlayers = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [players, memberships]);
  const eligibleIds = useMemo(() => new Set(eligiblePlayers.map((player) => player.uid)), [eligiblePlayers]);
  const superligaRounds = rounds;
  const canAdvance = normalizeStatus(seasonStatus) === 'em_andamento';
  const finalSecondaryIds = useMemo(() => secondaryIds.filter((uid) => eligibleIds.has(uid) && !top8Ids.includes(uid)), [secondaryIds, eligibleIds, top8Ids]);

  function toggleParticipant(which, uid) {
    const setter = which === 'top8' ? setTop8Ids : setSecondaryIds;
    setter((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]);
    if (which === 'top8') setSecondaryIds((current) => current.filter((id) => id !== uid));
  }

  function selectChampion(which, uid) {
    setChampions((current) => ({ ...current, [which]: current[which] === uid ? '' : uid }));
  }

  async function saveConfiguration() {
    if (!adminUid || saving) return;
    const cutoffRound = Number(cutoff);
    const currentRound = Number(currentBrazilRound);
    const bonusValues = bonuses.map(Number);
    const slots = Number(bracketSlots);
    const byes = Number(byeCount);
    if (!Number.isInteger(cutoffRound) || cutoffRound < 1) { setMessage('Informe uma rodada de corte válida.'); return; }
    if (!Number.isInteger(currentRound) || currentRound < 0 || currentRound > cutoffRound) { setMessage('A rodada atual precisa estar entre 0 e a rodada de corte.'); return; }
    if (bonusValues.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) { setMessage('Os bônus precisam ser números inteiros entre 0 e 100.'); return; }
    if (new Set([champions.winner, champions.runnerUp, champions.third].filter(Boolean)).size < [champions.winner, champions.runnerUp, champions.third].filter(Boolean).length) { setMessage('Campeão, vice e terceiro precisam ser jogadores diferentes.'); return; }
    if ([champions.winner, champions.runnerUp, champions.third].some((uid) => uid && !eligibleIds.has(uid))) { setMessage('O pódio precisa usar jogadores aptos da temporada.'); return; }
    if (['ready', 'active', 'complete'].includes(league.top8?.status) && top8Ids.filter((uid) => eligibleIds.has(uid)).length !== 8) { setMessage('Confirme exatamente oito classificados antes de liberar a Liga do Top 8.'); return; }
    if (['ready', 'active', 'complete'].includes(league.secondary?.status) && (!pairingMode || !finalSecondaryIds.length || (finalSecondaryIds.length - byes) <= 0 || (finalSecondaryIds.length - byes) % 2 !== 0)) { setMessage('Defina participantes, um número compatível de folgas e o formato antes de liberar o X-Salada.'); return; }
    if (normalizePhaseStatus(league.regular?.status) === 'complete' && currentRound < cutoffRound) { setMessage('A fase geral só pode ser encerrada depois de concluir a rodada de corte.'); return; }
    if (normalizePhaseStatus(league.regular?.status) === 'active' && (!eligiblePlayers.length || !Object.values(roundStages).includes('regular'))) { setMessage('Defina participantes aptos e vincule rodadas à fase geral antes de iniciar.'); return; }
    if (normalizePhaseStatus(league.top8?.status) === 'complete' && !champions.winner) { setMessage('Registre o campeão da Superliga antes de concluir o Top 8.'); return; }
    if (normalizePhaseStatus(league.secondary?.status) === 'complete' && (!secondaryWinner || !finalSecondaryIds.includes(secondaryWinner))) { setMessage('Registre como campeão um participante do X-Salada antes de concluir a etapa.'); return; }
    if (pairingMode && !['single', 'homeAway'].includes(pairingMode)) { setMessage('Formato de confronto inválido.'); return; }
    if (bracketSlots && (!Number.isInteger(slots) || slots < finalSecondaryIds.length || slots > eligiblePlayers.length)) { setMessage('As vagas do X-Salada devem comportar os participantes selecionados.'); return; }
    if (!Number.isInteger(byes) || byes < 0 || byes > finalSecondaryIds.length || (bracketSlots && byes > slots)) { setMessage('Informe um número válido de folgas (byes).'); return; }

    const stageByRound = {};
    const updates = {};
    Object.entries(roundStages).forEach(([roundId, stage]) => {
      const round = rounds.find((item) => item.id === roundId);
      if (!round) return;
      stageByRound[roundId] = stage || null;
      const oldTournaments = Array.isArray(round.tournaments) ? round.tournaments : Object.entries(round.tournamentConfig || {}).filter(([, config]) => (typeof config === 'boolean' ? config : config?.enabled)).map(([id]) => id);
      const tournaments = stage ? [...new Set([...oldTournaments, 'superliga'])] : oldTournaments.filter((id) => id !== 'superliga');
      updates[`seasons/${SEASON}/rounds/${roundId}/superligaStage`] = stage || null;
      updates[`seasons/${SEASON}/rounds/${roundId}/tournamentConfig/superliga`] = { enabled: Boolean(stage) };
      updates[`seasons/${SEASON}/rounds/${roundId}/tournaments`] = tournaments;
    });
    const bonusMap = Object.fromEntries(bonusValues.map((value, index) => [String(index + 1), value]));
    const now = Date.now();
    updates[`${PATH}/config/cutoffBrasileiraoRound`] = cutoffRound;
    updates[`${PATH}/config/top8BonusByPosition`] = bonusMap;
    updates[`${PATH}/config/relegatedCount`] = 4;
    updates[`${PATH}/config/tieBreakers`] = ['totalPoints', 'lastRoundPoints', 'previousPosition'];
    updates[`${PATH}/config/roundStages`] = stageByRound;
    updates[`${PATH}/regular/cutoffBrasileiraoRound`] = cutoffRound;
    updates[`${PATH}/regular/currentBrasileiraoRound`] = currentRound;
    updates[`${PATH}/regular/participants`] = Object.fromEntries([...eligibleIds].map((uid) => [uid, true]));
    const classifiedIds = top8Ids.filter((uid) => eligibleIds.has(uid));
    const bonusByUid = Object.fromEntries(classifiedIds.map((uid, index) => [uid, bonusValues[index] ?? 0]));
    updates[`${PATH}/top8/participants`] = classifiedIds;
    updates[`${PATH}/top8/startingBonus`] = bonusByUid;
    updates[`${PATH}/top8/startingBonusByPosition`] = bonusMap;
    updates[`${PATH}/secondary/participants`] = finalSecondaryIds;
    updates[`${PATH}/secondary/championUid`] = secondaryWinner || null;
    updates[`${PATH}/secondary/config`] = { ...(league.secondary?.config || {}), slots: bracketSlots ? slots : null, byes, pairingMode: pairingMode || null, preliminaryPairings: makePairings(finalSecondaryIds, byes) };
    updates[`${PATH}/champions`] = { winner: champions.winner || null, runnerUp: champions.runnerUp || null, third: champions.third || null };
    PHASES.forEach(({ id }) => { updates[`${PATH}/${id}/status`] = league[id]?.status || 'pending'; });
    updates[`${PATH}/adminAudit/config`] = { updatedAt: now, updatedBy: adminUid };
    if (Object.keys(league).length || rounds.length) {
      updates[`backups/tournaments/superliga/${SEASON}/${now}`] = {
        reason: 'admin-config-update', createdAt: now, createdBy: adminUid,
        data: {
          league,
          rounds: rounds.map(({ id, roundNumber, seqNumber, superligaStage, tournaments, tournamentConfig }) => ({ id, roundNumber, seqNumber, superligaStage, tournaments, tournamentConfig })),
        },
      };
    }
    setSaving(true); setMessage('');
    try {
      await update(ref(database), updates);
      setMessage('Configuração da Superliga salva.');
    } catch {
      setMessage('Não foi possível salvar. Confira a conexão e as regras do Realtime Database.');
    } finally { setSaving(false); }
  }

  if (loading || loadingRoster) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.copyMuted}>Carregando dados da Superliga…</Text></View>;
  if (rosterError) return <View style={styles.notice}><Text style={styles.error}>{rosterError}</Text></View>;

  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Gestão da Superliga</Text><Text style={styles.copy}>Participantes aptos, calendário das fases, corte e decisões finais da temporada.</Text></View><View style={styles.counter}><Text style={styles.counterValue}>{eligiblePlayers.length}</Text><Text style={styles.counterLabel}>APTOS</Text></View></View>
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.noticeText, message.startsWith('Não') && styles.error]}>{message}</Text>}
    <View style={styles.phaseTabs}>{PHASES.map((item) => <Pressable key={item.id} onPress={() => setPhase(item.id)} accessibilityRole="tab" accessibilityState={{ selected: phase === item.id }} style={[styles.phaseTab, phase === item.id && styles.phaseTabSelected]}><Text style={[styles.phaseTabText, phase === item.id && styles.phaseTabTextSelected]}>{item.label}</Text></Pressable>)}</View>

    <Section title="Participantes da Superliga" detail="A fase geral inclui automaticamente todos os jogadores aptos na aba Jogadores.">
      {eligiblePlayers.length ? eligiblePlayers.map((player) => <PlayerLine key={player.uid} player={player} label="FASE GERAL" selected />) : <Text style={styles.copyMuted}>Nenhum jogador está apto. Defina os participantes na aba Jogadores.</Text>}
      <Text style={styles.hint}>Depois do corte, selecione os oito classificados para o Top 8 e os participantes do X-Salada. Apenas jogadores ainda aptos podem ser selecionados.</Text>
    </Section>

    <Section title="Etapas e corte" detail="A fase geral termina na rodada indicada do Brasileirão; o número de rodadas do bolão pode ser diferente.">
      <View style={styles.formRow}><Field label="CORTE DO BRASILEIRÃO" value={cutoff} onChangeText={(value) => setCutoff(value.replace(/[^0-9]/g, ''))} suffix="ª rodada" /><Field label="RODADA ATUAL DO BRASILEIRÃO" value={currentBrazilRound} onChangeText={(value) => setCurrentBrazilRound(value.replace(/[^0-9]/g, ''))} compact /></View>
      <View style={styles.ruleSummary}><RuleLine label="Classificados" value="8 jogadores · Top 8" /><RuleLine label="Bônus de largada" value="Configurável por posição" /><RuleLine label="Rebaixamento" value="4 últimos após o corte" /><RuleLine label="Desempate" value="Pontos · última rodada · posição anterior" /></View>
      <Text style={styles.subheading}>Vincular rodadas do bolão a uma etapa</Text>
      {superligaRounds.length ? superligaRounds.map((round) => <View key={round.id} style={styles.roundStageRow}><View style={styles.flex}><Text style={styles.playerName}>Rodada {round.roundNumber || round.seqNumber || '—'}</Text><Text style={styles.copyMuted}>{roundMatchCount(round)} jogos</Text></View><View style={styles.stageChoices}>{STAGES.map((stage) => <Pressable key={stage.id || 'none'} onPress={() => setRoundStages((current) => ({ ...current, [round.id]: stage.id }))} style={[styles.stageChoice, (roundStages[round.id] || '') === stage.id && styles.stageChoiceSelected]}><Text style={[styles.stageChoiceText, (roundStages[round.id] || '') === stage.id && styles.stageChoiceTextSelected]}>{stage.label}</Text></Pressable>)}</View></View>) : <Text style={styles.copyMuted}>Cadastre rodadas na aba Rodadas para vinculá-las às etapas da Superliga.</Text>}
    </Section>

    <Section title="Liga do Top 8" detail="Confirme os classificados e os pontos de largada quando a fase geral for encerrada.">
      <View style={styles.bonusGrid}>{bonuses.map((value, index) => <Field key={index} label={`${index + 1}º LUGAR`} value={value} onChangeText={(next) => setBonuses((current) => current.map((item, itemIndex) => index === itemIndex ? next.replace(/[^0-9]/g, '') : item))} suffix="pts" compact />)}</View>
      <ParticipantPicker title={`Classificados · ${top8Ids.length}/8`} players={eligiblePlayers} selected={top8Ids} onToggle={(uid) => toggleParticipant('top8', uid)} limit={8} ranked />
      <Text style={styles.hint}>A ordem da seleção define as posições de 1º a 8º para aplicar os bônus. Selecione na ordem da classificação após o corte.</Text>
      <StatusControls value={league.top8?.status || 'pending'} onChange={setPhaseStatusFor('top8', setLeague, league, seasonStatus, setMessage)} canAdvance={canAdvance} />
    </Section>

    <Section title="Chave do X-Salada" detail="Defina os participantes fora do Top 8, as vagas, folgas e o formato antes de iniciar.">
      <ParticipantPicker title={`Participantes · ${secondaryIds.length}`} players={eligiblePlayers.filter((player) => !top8Ids.includes(player.uid))} selected={secondaryIds} onToggle={(uid) => toggleParticipant('secondary', uid)} ranked />
      <View style={styles.formRow}><Field label="VAGAS NA CHAVE" value={bracketSlots} onChangeText={(value) => setBracketSlots(value.replace(/[^0-9]/g, ''))} placeholder={`${secondaryIds.length || Math.max(eligiblePlayers.length - 8, 0)} (todos fora do Top 8)`} compact /><Field label="FOLGAS (BYE)" value={byeCount} onChangeText={(value) => setByeCount(value.replace(/[^0-9]/g, ''))} compact /></View>
      <Text style={styles.fieldLabel}>FORMATO DO CONFRONTO</Text><View style={styles.choiceRow}>{[['single', 'Jogo único'], ['homeAway', 'Ida e volta']].map(([id, label]) => <Choice key={id} label={label} selected={pairingMode === id} onPress={() => setPairingMode((current) => current === id ? '' : id)} />)}</View>
      <Text style={styles.subheading}>Prévia dos confrontos iniciais</Text>
      {makePairings(finalSecondaryIds, Number(byeCount) || 0).pairs.map((pair, index) => <View key={`pair-${index}`} style={styles.ruleLine}><Text style={styles.playerName}>{index + 1}. {playerName(pair[0], players)}</Text><Text style={styles.ruleValue}>× {playerName(pair[1], players)}</Text></View>)}
      {!!makePairings(finalSecondaryIds, Number(byeCount) || 0).byes.length && <Text style={styles.hint}>Folga: {makePairings(finalSecondaryIds, Number(byeCount) || 0).byes.map((uid) => playerName(uid, players)).join(', ')}</Text>}
      {!!makePairings(finalSecondaryIds, Number(byeCount) || 0).unpaired.length && <Text style={styles.error}>Sem par: {makePairings(finalSecondaryIds, Number(byeCount) || 0).unpaired.map((uid) => playerName(uid, players)).join(', ')}</Text>}
      <Text style={styles.hint}>A ordem de seleção define a ordem do chaveamento. Remova e selecione novamente para ajustar a ordem.</Text>
      <Text style={styles.fieldLabel}>CAMPEÃO DO X-SALADA</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playerChips}>{eligiblePlayers.filter((player) => finalSecondaryPlayers(secondaryIds, top8Ids, eligibleIds).includes(player.uid)).map((player) => <Choice key={player.uid} label={player.name} selected={secondaryWinner === player.uid} onPress={() => setSecondaryWinner((current) => current === player.uid ? '' : player.uid)} compact />)}</ScrollView>
      <Text style={styles.hint}>Escolha o formato antes de liberar a chave. A configuração não cria placares nem avança confrontos automaticamente.</Text>
      <StatusControls value={league.secondary?.status || 'pending'} onChange={setPhaseStatusFor('secondary', setLeague, league, seasonStatus, setMessage)} canAdvance={canAdvance} />
    </Section>

    <Section title="Fase geral e decisões" detail="Controle o estado da disputa e registre o pódio ao final da temporada.">
      <StatusControls value={league.regular?.status || 'pending'} onChange={setPhaseStatusFor('regular', setLeague, league, seasonStatus, setMessage)} canAdvance={canAdvance} />
      <View style={styles.ruleSummary}><RuleLine label="Campeão" value={playerName(champions.winner, players)} /><RuleLine label="Vice-campeão" value={playerName(champions.runnerUp, players)} /><RuleLine label="3º lugar" value={playerName(champions.third, players)} /></View>
      {['winner', 'runnerUp', 'third'].map((which) => <View key={which}><Text style={styles.fieldLabel}>{({ winner: 'CAMPEÃO', runnerUp: 'VICE-CAMPEÃO', third: '3º LUGAR' })[which]}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playerChips}>{eligiblePlayers.map((player) => <Choice key={player.uid} label={player.name} selected={champions[which] === player.uid} onPress={() => selectChampion(which, player.uid)} compact />)}</ScrollView></View>)}
    </Section>

    {!canAdvance && <Text style={styles.gateNote}>A temporada está {readableStatus(seasonStatus)}. Você pode preparar as regras; liberar etapas fica disponível quando estiver Em Andamento.</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={saveConfiguration} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#0A2345" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#0A2345" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar configuração da Superliga'}</Text></Pressable>
  </View>;
}

function setPhaseStatusFor(id, setLeague, league, seasonStatus, setMessage) {
  return (status) => {
    if (status !== 'pending' && normalizeStatus(seasonStatus) !== 'em_andamento') { setMessage('A temporada precisa estar Em Andamento para liberar ou encerrar uma etapa.'); return; }
    if (status !== 'pending' && id !== 'regular' && !['complete', 'finished', 'closed', '2'].includes(String(league.regular?.status || '').toLowerCase())) { setMessage('Encerre a fase geral antes de liberar o Top 8 ou o X-Salada.'); return; }
    setLeague((current) => ({ ...current, [id]: { ...(current[id] || {}), status } }));
  };
}

function Section({ title, detail, children }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionDetail}>{detail}</Text><View style={styles.sectionContent}>{children}</View></View>; }
function Field({ label, value, onChangeText, suffix, placeholder, compact = false }) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputLine}><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8199B3" keyboardType="number-pad" style={styles.input} /><Text style={styles.suffix}>{suffix}</Text></View></View>; }
function RuleLine({ label, value }) { return <View style={styles.ruleLine}><Text style={styles.copyMuted}>{label}</Text><Text style={styles.ruleValue}>{value}</Text></View>; }
function PlayerLine({ player, label, selected }) { return <View style={styles.playerLine}>{player.shieldUrl ? <Image source={{ uri: player.shieldUrl }} style={styles.crest} resizeMode="contain" /> : <MaterialDesignIcons name="account-circle-outline" size={27} color="#AFC5DD" />}<View style={styles.flex}><Text style={styles.playerName}>{player.name}</Text><Text style={styles.copyMuted}>{player.teamName || label}</Text></View><Text style={styles.eligibleBadge}>{selected ? 'APTO' : label}</Text></View>; }
function ParticipantPicker({ title, players, selected, onToggle, limit, ranked = false }) { return <View style={styles.participantPicker}><Text style={styles.subheading}>{title}</Text>{players.length ? players.map((player) => { const checked = selected.includes(player.uid); const blocked = !checked && limit && selected.length >= limit; const rank = selected.indexOf(player.uid); return <Pressable key={player.uid} disabled={blocked} onPress={() => onToggle(player.uid)} style={[styles.playerLine, blocked && styles.disabled]}>{player.shieldUrl ? <Image source={{ uri: player.shieldUrl }} style={styles.crest} resizeMode="contain" /> : <MaterialDesignIcons name="account-circle-outline" size={27} color="#AFC5DD" />}<View style={styles.flex}><Text style={styles.playerName}>{player.name}</Text><Text style={styles.copyMuted}>{player.teamName || 'Jogador apto'}</Text></View>{ranked && rank >= 0 && <Text style={styles.rankBadge}>{rank + 1}º · +{[6, 4, 2, 1][rank] ?? 0}</Text>}<MaterialDesignIcons name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={20} color={checked ? '#B9F276' : '#91A9C7'} /></Pressable>; }) : <Text style={styles.copyMuted}>Nenhum jogador disponível para esta etapa.</Text>}</View>; }
function StatusControls({ value, onChange, canAdvance }) { const statusValue = normalizePhaseStatus(value); return <View style={styles.statusBlock}><Text style={styles.fieldLabel}>STATUS DA ETAPA</Text><View style={styles.choiceRow}>{PHASE_STATUS.map((status) => { const gated = status.id !== 'pending' && !canAdvance; return <Choice key={status.id} label={status.label} selected={statusValue === status.id} disabled={gated} onPress={() => onChange(status.id)} />; })}</View></View>; }
function Choice({ label, selected, onPress, disabled = false, compact = false }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled, compact && styles.choiceCompact]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function asIds(value) { if (Array.isArray(value)) return value.map((entry) => typeof entry === 'string' ? entry : entry?.uid || entry?.playerId).filter(Boolean); return Object.entries(value || {}).filter(([, included]) => included !== false && included !== null).map(([uid]) => uid); }
function roundMatchCount(round) { return Array.isArray(round.matches) ? round.matches.length : Object.keys(round.matches || {}).length; }
function finalSecondaryPlayers(ids, top8, eligible) { return ids.filter((uid) => eligible.has(uid) && !top8.includes(uid)); }
function makePairings(ids, byes) { const validByes = Number.isInteger(byes) && byes > 0 && byes <= ids.length ? byes : 0; const participants = ids.slice(validByes); const pairs = []; for (let index = 0; index + 1 < participants.length; index += 2) pairs.push([participants[index], participants[index + 1]]); return { pairs, byes: ids.slice(0, validByes), unpaired: participants.length % 2 ? [participants[participants.length - 1]] : [] }; }
function playerName(uid, players) { return players.find((player) => player.uid === uid)?.name || 'Não definido'; }
function normalizePhaseStatus(status) { if (status === 1 || status === true) return 'active'; if (status === 2) return 'complete'; return String(status || 'pending').toLowerCase(); }
function normalizeStatus(status) { const value = String(status || '').trim().toLowerCase().replace(/[ -]/g, '_'); return ({ active: 'em_andamento', open: 'em_andamento', draft: 'a_iniciar', finished: 'concluida', complete: 'concluida' })[value] || value; }
function readableStatus(status) { return ({ a_iniciar: 'A Iniciar', em_andamento: 'Em Andamento', concluida: 'Concluída' })[normalizeStatus(status)] || 'sem status definido'; }

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 },
  loading: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 9 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  title: { color: '#F6F8FC', fontSize: 24, fontWeight: '900' }, copy: { color: '#B7C9DD', fontSize: 11, lineHeight: 16, marginTop: 4 },
  counter: { minWidth: 56, paddingVertical: 7, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#55754D', backgroundColor: '#15372F' }, counterValue: { color: '#D7F7B9', fontSize: 19, fontWeight: '900' }, counterLabel: { color: '#A6C798', fontSize: 7, letterSpacing: .7, fontWeight: '900' },
  phaseTabs: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 11, backgroundColor: '#091F3B' }, phaseTab: { flex: 1, minHeight: 40, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, phaseTabSelected: { backgroundColor: '#B9F276' }, phaseTabText: { color: '#AFC5DD', fontSize: 8, fontWeight: '900', textAlign: 'center' }, phaseTabTextSelected: { color: '#0A2345' },
  section: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, sectionTitle: { color: '#F0F5FA', fontSize: 13, fontWeight: '900' }, sectionDetail: { color: '#91A9C7', fontSize: 9, lineHeight: 14, marginTop: 4 }, sectionContent: { gap: 8, marginTop: 12 },
  playerLine: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' }, crest: { width: 28, height: 30 }, playerName: { color: '#EAF1F9', fontSize: 10, fontWeight: '800' }, copyMuted: { color: '#9FB5CB', fontSize: 9, lineHeight: 14 }, eligibleBadge: { color: '#B9F276', fontSize: 7, letterSpacing: .5, fontWeight: '900' }, rankBadge: { color: '#B9F276', fontSize: 8, fontWeight: '900' }, hint: { color: '#91A9C7', fontSize: 9, lineHeight: 14, marginTop: 4 },
  field: { flex: 1, minWidth: 110 }, fieldCompact: { minWidth: 70 }, fieldLabel: { color: '#9FB5CB', fontSize: 8, letterSpacing: .5, fontWeight: '900', marginBottom: 5 }, inputLine: { minHeight: 41, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A' }, input: { flex: 1, minWidth: 30, color: '#F2F6FA', fontSize: 11, paddingVertical: 8 }, suffix: { color: '#9FB5CB', fontSize: 9 },
  ruleSummary: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9, backgroundColor: '#102844' }, ruleLine: { minHeight: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.1)' }, ruleValue: { color: '#DFEAF4', fontSize: 9, fontWeight: '800', textAlign: 'right', flexShrink: 1 }, subheading: { color: '#C4D3E2', fontSize: 9, letterSpacing: .4, fontWeight: '900', marginTop: 5 },
  roundStageRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)', gap: 7 }, stageChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, stageChoice: { minHeight: 29, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, stageChoiceSelected: { borderColor: '#55754D', backgroundColor: '#15372F' }, stageChoiceText: { color: '#AFC2D5', fontSize: 8, fontWeight: '800' }, stageChoiceTextSelected: { color: '#D7EFC2' },
  bonusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, participantPicker: { gap: 2, marginTop: 3 }, formRow: { flexDirection: 'row', gap: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choice: { minHeight: 33, maxWidth: '100%', paddingHorizontal: 9, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceSelected: { borderColor: '#55754D', backgroundColor: '#15372F' }, choiceCompact: { minHeight: 30, maxWidth: 150 }, choiceText: { color: '#AFC2D5', fontSize: 8, fontWeight: '800' }, choiceTextSelected: { color: '#D7EFC2' }, statusBlock: { gap: 6, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' },
  playerChips: { gap: 6, paddingVertical: 5 }, gateNote: { padding: 10, borderRadius: 9, backgroundColor: '#382F28', color: '#FFD987', fontSize: 9, lineHeight: 14 }, notice: { padding: 12, borderRadius: 10, backgroundColor: '#102844' }, noticeText: { color: '#B9F276', fontSize: 10, lineHeight: 15 }, error: { color: '#FFB5A9' }, saveButton: { minHeight: 45, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#B9F276' }, saveText: { color: '#092447', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .48 },
});
