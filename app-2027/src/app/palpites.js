import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { auth, onAuthStateChanged } from '../services/firebaseAuth';
import { database, equalTo, onValue, orderByChild, query, ref, update } from '../services/firebaseDatabase';

const STADIUM = require('../../assets/brand/stadium-night.jpg');
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const EMPTY = Object.freeze({});
const STRATEGIES = [
  { id: 'artilheiro', name: 'Artilheiro', detail: 'Cada gol do capitão vale 2 pontos.', icon: 'bullseye' },
  { id: 'garcom', name: 'Garçom', detail: 'Gol e assistência do capitão valem 1 ponto.', icon: 'shoe-cleat' },
  { id: 'hatTrick', name: 'Hat-trick', detail: '3 gols do capitão valem 8. Trio abaixo de 3 gols: −3.', icon: 'fire' },
];

export default function PalpitesScreen() {
  const router = useRouter();
  const [uid, setUid] = useState(null);
  const [round, setRound] = useState(null);
  const [seasonStatus, setSeasonStatus] = useState(null);
  const [teams, setTeams] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState({});
  const [wildDraft, setWildDraft] = useState({});
  const [starMatch, setStarMatch] = useState(null);
  const [wildMatch, setWildMatch] = useState(null);
  const [starTeam, setStarTeam] = useState('');
  const [roster, setRoster] = useState([]);
  const [rosterLoadedFor, setRosterLoadedFor] = useState('');
  const [selectedAthletes, setSelectedAthletes] = useState([]);
  const [captainId, setCaptainId] = useState('');
  const [strategy, setStrategy] = useState('artilheiro');
  const [saving, setSaving] = useState(false);
  const [predictionsMatch, setPredictionsMatch] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const initializedRound = useRef('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let stops = [];
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stops.forEach((stop) => stop());
      stops = [];
      if (!user) { router.replace('/entrar'); return; }
      setUid(user.uid);
      setLoading(true);
      stops.push(onValue(ref(database, 'seasons/2027/status'), (snap) => setSeasonStatus(snap.val()), () => {}));
      stops.push(onValue(query(ref(database, 'seasons/2027/rounds'), orderByChild('status'), equalTo(1)), (snap) => {
        const active = Object.entries(snap.val() || {}).map(([key, value]) => ({ ...value, key }))
          .sort((a, b) => toManausTimestamp(b.finishTimestamp) - toManausTimestamp(a.finishTimestamp))[0] || null;
        setRound(active);
        setNow(Date.now());
        const activeKey = active?.key || '';
        if (initializedRound.current !== activeKey && active) {
          initializedRound.current = activeKey;
          const activeMatches = toArray(active.matches);
          const star = active.starPlayers?.[user.uid] || {};
          const savedPlayers = Array.isArray(star.players) ? star.players : (star.athleteId ? [{ id: String(star.athleteId), name: star.athleteName, teamId: star.teamId, teamName: star.teamName }] : []);
          const legacyWildcard = activeMatches.findIndex((match) => match?.wildcardPredictions?.[user.uid]);
          setDraft(Object.fromEntries(activeMatches.map((match, index) => {
            const prediction = match?.predictions?.[user.uid] || {};
            return [index, { home: asInput(prediction.homeScore), away: asInput(prediction.awayScore) }];
          })));
          setWildDraft(Object.fromEntries(activeMatches.map((match, index) => [index, match?.wildcardPredictions?.[user.uid] || null])));
          setStarMatch(activeMatches.findIndex((match) => match?.predictions?.[user.uid]?.isStarMatch === true));
          setWildMatch(legacyWildcard >= 0 ? legacyWildcard : null);
          setStarTeam(star.teamId || savedPlayers[0]?.teamId || '');
          setRoster([]);
          setRosterLoadedFor('');
          setSelectedAthletes(savedPlayers.map((player) => String(player.id || player.athleteId)).filter(Boolean).slice(0, 3));
          setCaptainId(String(star.captainId || star.athleteId || savedPlayers[0]?.id || ''));
          setStrategy(star.strategy || 'artilheiro');
        } else if (!active && initializedRound.current) {
          initializedRound.current = '';
          setDraft({}); setWildDraft({}); setStarMatch(null); setWildMatch(null); setSelectedAthletes([]); setCaptainId(''); setStarTeam('');
        }
        setLoading(false);
      }, () => { setRound(null); setLoading(false); }));
      stops.push(onValue(ref(database, 'teams'), (snap) => setTeams(snap.val() || {})));
      stops.push(onValue(ref(database, 'users'), (snap) => setUsers(snap.val() || {})));
    });
    return () => { stopAuth(); stops.forEach((stop) => stop()); };
  }, [router]);

  const currentRound = normalizeSeasonStatus(seasonStatus) === 'em_andamento' ? round : null;
  const seasonStatusLabel = readableSeasonStatus(seasonStatus);
  const matches = useMemo(() => toArray(currentRound?.matches), [currentRound]);
  const deadlines = useMemo(() => matches.map((match) => getMatchDeadline(match, currentRound)), [matches, currentRound]);
  const startAt = useMemo(() => {
    const valid = deadlines.filter(Boolean);
    return valid.length ? Math.min(...valid) : toManausTimestamp(currentRound?.finishTimestamp);
  }, [deadlines, currentRound]);
  const started = Boolean(startAt && now >= startAt);
  const editableCount = matches.filter((match) => !isLocked(match, currentRound, now)).length;
  const nextDeadline = deadlines.filter((deadline, index) => deadline > now && !hasResult(matches[index])).sort((a, b) => a - b)[0];
  const roundNumber = getRoundNumber(currentRound);
  const roundLabel = currentRound ? cleanRoundName(currentRound.name || currentRound.label) || (roundNumber ? `Rodada ${roundNumber}` : 'Rodada atual') : '';
  const savedStar = useMemo(() => currentRound?.starPlayers?.[uid] || EMPTY, [currentRound, uid]);
  const chosenTeam = useMemo(() => teams[starTeam] || matchTeam(starTeam, matches, teams), [starTeam, matches, teams]);
  const rosterTeamId = chosenTeam?.espnTeamId;
  const rosterLeague = chosenTeam?.leagueCode || 'bra.1';
  const rosterBusy = Boolean(starTeam && chosenTeam?.espnTeamId && rosterLoadedFor !== starTeam);

  useEffect(() => {
    if (!starTeam || rosterLoadedFor === starTeam) return undefined;
    if (!rosterTeamId) return undefined;
    let alive = true;
    fetch(`${ESPN}/${encodeURIComponent(rosterLeague)}/teams/${encodeURIComponent(rosterTeamId)}?enable=roster`)
      .then((response) => { if (!response.ok) throw new Error('ESPN'); return response.json(); })
      .then((payload) => {
        if (!alive) return;
        const athletes = (payload.team?.athletes || []).map((athlete) => ({ id: String(athlete.id), name: athlete.displayName, position: athlete.position?.abbreviation || '', jersey: athlete.jersey || '' }))
          .sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
        setRoster(athletes);
        setRosterLoadedFor(starTeam);
      })
      .catch(() => {
        if (alive) { setRoster([]); setRosterLoadedFor(starTeam); Alert.alert('Elenco indisponível', 'Não foi possível carregar o elenco da ESPN agora. Tente novamente em instantes.'); }
      });
    return () => { alive = false; };
  }, [starTeam, rosterLoadedFor, rosterTeamId, rosterLeague]);

  const setScore = (index, side, value) => setDraft((previous) => ({
    ...previous,
    [index]: { ...(previous[index] || { home: '', away: '' }), [side]: value.replace(/[^0-9]/g, '').slice(0, 2) },
  }));
  const toggleStar = (index) => {
    if (started || isLocked(matches[index], currentRound, now)) return;
    const next = starMatch === index ? null : index;
    setStarMatch(next);
    if (next !== null && wildMatch === next) setWildMatch(null);
  };
  const toggleWildcard = (index) => {
    if (started || isLocked(matches[index], currentRound, now)) return;
    const next = wildMatch === index ? null : index;
    setWildMatch(next);
    if (next !== null && starMatch === next) setStarMatch(null);
  };

  const chooseStarTeam = (teamId) => {
    setStarTeam(teamId);
    setSelectedAthletes([]);
    setCaptainId('');
    setRoster([]);
    setRosterLoadedFor('');
  };

  const toggleAthlete = (athlete) => {
    setSelectedAthletes((previous) => {
      if (previous.includes(athlete.id)) {
        if (captainId === athlete.id) setCaptainId('');
        return previous.filter((id) => id !== athlete.id);
      }
      if (previous.length >= 3) return previous;
      return [...previous, athlete.id];
    });
  };

  const save = useCallback(async () => {
    if (!uid || !currentRound?.key || saving) return;
    if (!started && selectedAthletes.length > 0 && selectedAthletes.length !== 3) {
      Alert.alert('Complete o trio', 'Escolha três jogadores para o Artilheiro da Rodada.'); return;
    }
    if (!started && selectedAthletes.length === 3 && !captainId) {
      Alert.alert('Defina o capitão', 'Escolha um dos três jogadores como capitão.'); return;
    }
    if (!started && wildMatch !== null && (!wildDraft[wildMatch] || wildDraft[wildMatch].homeScore === '' || wildDraft[wildMatch].awayScore === '')) {
      Alert.alert('Complete o coringa', 'Informe o segundo placar antes de salvar.'); return;
    }
    if (!started && wildMatch !== null && wildMatch === starMatch) {
      Alert.alert('Escolha jogos diferentes', 'Estrela e Coringa precisam ser partidas diferentes.'); return;
    }
    setSaving(true);
    setSavedMessage('');
    const updates = {};
    matches.forEach((match, index) => {
      if (isLocked(match, currentRound, Date.now())) return;
      const value = draft[index] || {};
      if (value.home !== '' && value.away !== '') {
        updates[`/seasons/2027/rounds/${currentRound.key}/matches/${index}/predictions/${uid}`] = {
          homeScore: Number(value.home), awayScore: Number(value.away), isStarMatch: starMatch === index,
          updatedAt: Date.now(),
        };
      } else if (match?.predictions?.[uid]) {
        updates[`/seasons/2027/rounds/${currentRound.key}/matches/${index}/predictions/${uid}`] = null;
      }
      const wildcard = wildDraft[index];
      if (wildMatch === index && wildcard?.homeScore !== undefined && wildcard?.awayScore !== undefined) {
        updates[`/seasons/2027/rounds/${currentRound.key}/matches/${index}/wildcardPredictions/${uid}`] = {
          homeScore: Number(wildcard.homeScore), awayScore: Number(wildcard.awayScore), updatedAt: Date.now(),
        };
      } else if (wildMatch !== index && match?.wildcardPredictions?.[uid]) {
        updates[`/seasons/2027/rounds/${currentRound.key}/matches/${index}/wildcardPredictions/${uid}`] = null;
      }
    });
    if (!started && selectedAthletes.length === 3 && captainId) {
      const players = selectedAthletes.map((id) => roster.find((athlete) => athlete.id === id) || savedAthlete(id, savedStar)).filter(Boolean).map((athlete) => ({
        id: athlete.id, name: athlete.name, teamId: starTeam, teamName: chosenTeam?.name || '',
      }));
      const captain = players.find((player) => player.id === captainId);
      updates[`/seasons/2027/rounds/${currentRound.key}/starPlayers/${uid}`] = {
        players, captainId, captainName: captain?.name || '', strategy,
        // Legacy fields remain available to the current web screen.
        athleteId: captainId, athleteName: captain?.name || '', teamId: starTeam, teamName: chosenTeam?.name || '', updatedAt: Date.now(),
      };
    } else if (!started && selectedAthletes.length === 0 && currentRound.starPlayers?.[uid]) {
      updates[`/seasons/2027/rounds/${currentRound.key}/starPlayers/${uid}`] = null;
    }
    try {
      if (Object.keys(updates).length) await update(ref(database), updates);
      setSavedMessage('Salvo na rodada. Boa sorte!');
      setTimeout(() => setSavedMessage(''), 3200);
    } catch {
      Alert.alert('Não foi possível salvar', 'Confira sua conexão e tente de novo. Seus campos continuam preenchidos.');
    } finally { setSaving(false); }
  }, [uid, currentRound, saving, started, selectedAthletes, captainId, matches, draft, starMatch, wildMatch, wildDraft, strategy, roster, savedStar, starTeam, chosenTeam]);

  const eligibleTeams = useMemo(() => getRoundTeams(matches, teams), [matches, teams]);
  const unsaved = Object.values(draft).some((score) => score?.home !== '' && score?.away !== '') || selectedAthletes.length > 0 || wildMatch !== null || starMatch !== null;

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator size="large" color="#B6F477" /><Text style={styles.loadingText}>Buscando a rodada...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Image source={STADIUM} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(3,13,32,.72)', '#071735', '#071735']} locations={[0, .35, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topbar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar para início" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton}><MaterialDesignIcons name="arrow-left" size={20} color="#E7F0FA" /></Pressable>
            <View style={styles.topTitle}><Text style={styles.kicker}>BRASILEIRÃO DA DEPRESSÃO</Text><Text style={styles.title}>PALPITES</Text></View>
            <View style={styles.roundStamp}><Text style={styles.roundStampLabel}>RODADA</Text><Text style={[styles.roundStampValue, !roundNumber && styles.roundStampActive]}>{roundNumber || '—'}</Text></View>
          </View>
          <View style={styles.seasonStatusBar}><Text style={styles.seasonStatusLabel}>TEMPORADA 2027</Text><Text style={styles.seasonStatusValue}>{seasonStatusLabel}</Text></View>

          {!currentRound ? <View style={styles.empty}><MaterialDesignIcons name="calendar-blank-outline" size={38} color="#A6ED6A" /><Text style={styles.emptyTitle}>{normalizeSeasonStatus(seasonStatus) === 'em_andamento' ? 'Nenhuma rodada ativa' : `Temporada ${seasonStatusLabel}`}</Text><Text style={styles.emptyCopy}>{normalizeSeasonStatus(seasonStatus) === 'em_andamento' ? 'Assim que uma rodada for colocada em andamento, os jogos aparecem aqui para você palpitar.' : 'Os palpites ficam disponíveis quando a temporada estiver em andamento e houver uma rodada ativa.'}</Text><Pressable onPress={() => router.replace('/')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>VOLTAR AO INÍCIO</Text></Pressable></View> : <>
            <View style={[styles.clockPanel, started && styles.clockPanelLive]}>
              <View style={styles.clockCopy}><View style={styles.liveDot} /><Text style={styles.clockStatus}>{started ? 'RODADA EM ANDAMENTO' : nextDeadline ? 'PALPITES ABERTOS' : 'PRAZO ENCERRADO'}</Text><Text style={styles.clockRound}>{roundLabel}</Text></View>
              <View style={styles.clockDivider} />
              <View style={styles.clockTimeWrap}><Text style={styles.clockHint}>{started ? nextDeadline ? 'PRÓXIMO JOGO FECHA EM' : 'TODOS OS PRAZOS FECHADOS' : nextDeadline ? 'PRIMEIRO JOGO COMEÇA EM' : 'SEM PRAZO ATIVO'}</Text><Text style={styles.clockTime}>{nextDeadline ? formatCountdown(nextDeadline - now) : started ? 'FECHADO' : '—'}</Text></View>
            </View>
            {started && nextDeadline && <Text style={styles.liveDeadlineNote}>A rodada já começou. Os jogos que ainda não iniciaram continuam recebendo palpites até o horário de cada partida.</Text>}

            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>A RODADA</Text><Text style={styles.sectionSub}>{matches.length} jogos · cada partida fecha no próprio horário · só tempo regulamentar</Text></View><MaterialDesignIcons name="soccer" size={24} color="#A6ED6A" /></View>
            {matches.map((match, index) => <MatchCard key={`${currentRound.key}-${index}`} index={index} match={match} teams={teams} now={now} round={currentRound} uid={uid} draft={draft[index] || { home: '', away: '' }} wildDraft={wildDraft[index]} isStar={starMatch === index} isWildcard={wildMatch === index} roundStarted={started}
              onScore={(side, value) => setScore(index, side, value)} onStar={() => toggleStar(index)} onWildcard={() => toggleWildcard(index)} onWildcardScore={(side, value) => setWildDraft((previous) => ({ ...previous, [index]: { ...(previous[index] || { homeScore: '', awayScore: '' }), [side]: value.replace(/[^0-9]/g, '').slice(0, 2) } }))} onView={() => setPredictionsMatch(index)} />)}

            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>JOGO CORINGA</Text><Text style={styles.sectionSub}>Um segundo placar. Conta só o melhor, nunca a soma.</Text></View><MaterialDesignIcons name="cards-playing-outline" size={24} color="#FFD875" /></View>
            <View style={styles.ruleBanner}><MaterialDesignIcons name="information-outline" size={18} color="#FFD875" /><Text style={styles.ruleCopy}>Escolha o coringa em um jogo diferente da Estrela. Ambos fecham no início da rodada.</Text></View>
            {wildMatch !== null && <Text style={styles.selectionSummary}>Coringa: {teamName(matches[wildMatch]?.homeTeam, teams, matches[wildMatch])} × {teamName(matches[wildMatch]?.awayTeam, teams, matches[wildMatch])}</Text>}
            {starMatch !== null && <Text style={styles.selectionSummary}>Estrela 2×: {teamName(matches[starMatch]?.homeTeam, teams, matches[starMatch])} × {teamName(matches[starMatch]?.awayTeam, teams, matches[starMatch])}</Text>}

            <StrikerSection teams={eligibleTeams} chosenTeam={chosenTeam} starTeam={starTeam} onChooseTeam={chooseStarTeam} roster={roster} rosterBusy={rosterBusy} selected={selectedAthletes} onToggle={toggleAthlete} captainId={captainId} onCaptain={setCaptainId} strategy={strategy} onStrategy={setStrategy} savedStar={savedStar} round={currentRound} now={now} started={started} />

            <View style={styles.bottomSpace} />
          </>}
        </ScrollView>
        {currentRound && <View style={styles.saveDock}>
          <View style={styles.saveDockCopy}><Text style={styles.saveDockTitle}>{savedMessage || (editableCount ? `${editableCount} jogos ainda recebem palpites` : 'Nenhum jogo com prazo aberto')}</Text><Text style={styles.saveDockHint}>{started ? 'Artilheiro, Estrela e Coringa foram bloqueados no início.' : unsaved ? 'Confira seus placares antes de confirmar.' : 'Seus palpites ficam privados até o início.'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || (!editableCount && started) }} disabled={saving || (!editableCount && started)} onPress={save} style={({ pressed }) => [styles.saveButton, (saving || (!editableCount && started)) && styles.saveDisabled, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator color="#0A2345" size="small" /> : <><Text style={styles.saveButtonText}>SALVAR</Text><MaterialDesignIcons name="arrow-right" size={18} color="#0A2345" /></>}
          </Pressable>
        </View>}
      </KeyboardAvoidingView>

      <Modal visible={predictionsMatch !== null} transparent animationType="fade" onRequestClose={() => setPredictionsMatch(null)}>
        <View style={styles.modalBackdrop}><View style={styles.predictionModal}>
          <View style={styles.modalHead}><View><Text style={styles.modalTitle}>PALPITES DA TURMA</Text><Text style={styles.modalSub}>{predictionsMatch !== null ? `${teamName(matches[predictionsMatch]?.homeTeam, teams, matches[predictionsMatch])} × ${teamName(matches[predictionsMatch]?.awayTeam, teams, matches[predictionsMatch])}` : ''}</Text></View><Pressable onPress={() => setPredictionsMatch(null)} accessibilityLabel="Fechar" style={styles.modalClose}><MaterialDesignIcons name="close" size={20} color="#E8F0FA" /></Pressable></View>
          {!started ? <Text style={styles.hiddenPredictions}>Os palpites dos demais aparecem quando a rodada começar.</Text> : <ScrollView style={styles.modalList}>{Object.entries(matches[predictionsMatch]?.predictions || {}).map(([playerId, prediction]) => <View key={playerId} style={styles.predictionLine}><Text style={styles.predictionName}>{users[playerId]?.customTeamName || users[playerId]?.name || 'Jogador'}</Text><Text style={styles.predictionScore}>{prediction.homeScore} × {prediction.awayScore}</Text></View>)}</ScrollView>}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

function MatchCard({ index, match, teams, now, round, uid, draft, wildDraft, isStar, isWildcard, roundStarted, onScore, onStar, onWildcard, onWildcardScore, onView }) {
  const home = { ...(teams[match.homeTeam] || {}), name: match.homeTeamName || match.externalHomeName || teams[match.homeTeam]?.name, image: match.homeTeamImage || teams[match.homeTeam]?.image };
  const away = { ...(teams[match.awayTeam] || {}), name: match.awayTeamName || match.externalAwayName || teams[match.awayTeam]?.name, image: match.awayTeamImage || teams[match.awayTeam]?.image };
  const locked = isLocked(match, round, now);
  const result = hasResult(match);
  const saved = match.predictions?.[uid] || {};
  const wildPrediction = match.wildcardPredictions?.[uid] || wildDraft || {};
  const deadline = getMatchDeadline(match, round);
  const regularPoints = result && saved.homeScore !== undefined ? scorePrediction(match.finalResult, saved, saved.isStarMatch) : null;
  const wildcardPoints = result && wildPrediction.homeScore !== undefined ? scorePrediction(match.finalResult, wildPrediction, false) : null;
  const countedPoints = isWildcard && wildcardPoints !== null ? (regularPoints === null ? wildcardPoints : Math.max(regularPoints, wildcardPoints)) : regularPoints;
  return <View style={[styles.matchCard, isStar && styles.matchStar, isWildcard && styles.matchWildcard, locked && styles.matchLocked]}>
    <View style={styles.matchMeta}><Text style={styles.matchTime}>{deadline ? new Date(deadline).toLocaleString('pt-BR', { timeZone: 'America/Manaus', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'HORÁRIO A CONFIRMAR'}</Text><View style={styles.tags}>{isStar && <Text style={styles.starTag}>ESTRELA · 2×</Text>}{isWildcard && <Text style={styles.wildTag}>CORINGA</Text>}{locked && !result && <MaterialDesignIcons name="lock" size={14} color="#97AFC8" />}</View></View>
    <View style={styles.matchTeams}>
      <TeamLogo team={home} /><View style={styles.teamLabel}><Text numberOfLines={2} style={styles.teamText}>{home.name || 'Mandante'}</Text><Text style={styles.sideLabel}>CASA</Text></View>
      <View style={styles.centerScore}>{result ? <Text style={styles.finalScore}>{match.finalResult.homeScore} : {match.finalResult.awayScore}</Text> : <Text style={styles.vs}>×</Text>}</View>
      <View style={[styles.teamLabel, styles.awayLabel]}><Text numberOfLines={2} style={[styles.teamText, styles.textRight]}>{away.name || 'Visitante'}</Text><Text style={[styles.sideLabel, styles.textRight]}>FORA</Text></View><TeamLogo team={away} />
    </View>
    {result ? <View style={{ paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderColor: 'rgba(171,194,218,.14)' }}><View style={styles.resultLine}><Text style={styles.resultCaption}>SEU PALPITE</Text><Text style={styles.resultGuess}>{saved.homeScore ?? '—'} × {saved.awayScore ?? '—'}{saved.isStarMatch ? '  ·  2×' : ''}</Text><Text style={{ color: countedPoints < 0 ? '#FF988C' : '#C2F28A', fontSize: 11, fontWeight: '900' }}>{countedPoints === null ? '— pts' : `${countedPoints > 0 ? '+' : ''}${countedPoints} pts`}</Text></View>{wildcardPoints !== null && <Text style={{ color: '#E8C869', textAlign: 'center', fontSize: 8, fontWeight: '900', marginTop: 6 }}>{`CORINGA ${wildPrediction.homeScore} × ${wildPrediction.awayScore} · vale o melhor dos dois`}</Text>}<Pressable onPress={onView} style={{ alignSelf: 'center', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5, padding: 7, borderRadius: 7, backgroundColor: '#183957' }}><MaterialDesignIcons name="eye-outline" size={15} color="#BDD7F1" /><Text style={styles.viewButtonText}>VER PALPITES DA TURMA</Text></Pressable></View> : <>
      <View style={styles.scoreInputs}><ScorePicker label="MANDANTE" value={draft.home} disabled={locked} onChange={(value) => onScore('home', value)} /><Text style={styles.scoreSeparator}>–</Text><ScorePicker label="VISITANTE" value={draft.away} disabled={locked} onChange={(value) => onScore('away', value)} /></View>
      <View style={styles.matchActions}>
        <Pressable disabled={locked || roundStarted || (isWildcard && !isStar)} onPress={onStar} style={[styles.matchAction, isStar && styles.matchActionStar, (locked || roundStarted) && styles.actionLocked]}><MaterialDesignIcons name={isStar ? 'star' : 'star-outline'} size={16} color={isStar ? '#112541' : '#DDE8F5'} /><Text style={[styles.matchActionText, isStar && styles.matchActionActiveText]}>ESTRELA 2×</Text></Pressable>
        <Pressable disabled={locked || roundStarted || (isStar && !isWildcard)} onPress={onWildcard} style={[styles.matchAction, isWildcard && styles.matchActionWild, (locked || roundStarted) && styles.actionLocked]}><MaterialDesignIcons name={isWildcard ? 'cards-playing' : 'cards-playing-outline'} size={16} color={isWildcard ? '#112541' : '#DDE8F5'} /><Text style={[styles.matchActionText, isWildcard && styles.matchActionActiveText]}>CORINGA</Text></Pressable>
      </View>
      {isWildcard && <View style={styles.wildEditor}><Text style={styles.wildTitle}>SEGUNDO PLACAR DO CORINGA</Text><View style={styles.wildScores}><ScorePicker label="MANDANTE" value={asInput(wildDraft?.homeScore)} disabled={locked || roundStarted} onChange={(value) => onWildcardScore('homeScore', value)} /><Text style={styles.scoreSeparator}>–</Text><ScorePicker label="VISITANTE" value={asInput(wildDraft?.awayScore)} disabled={locked || roundStarted} onChange={(value) => onWildcardScore('awayScore', value)} /></View></View>}
      {locked && roundStarted && <Pressable onPress={onView} style={{ alignSelf: 'center', marginTop: 9, paddingHorizontal: 12, minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: '#183957' }}><MaterialDesignIcons name="eye-outline" size={15} color="#BDD7F1" /><Text style={styles.viewButtonText}>VER PALPITES DA TURMA</Text></Pressable>}
    </>}
  </View>;
}

function ScorePicker({ label, value, disabled, onChange }) {
  const parsed = Number(value || 0);
  return <View style={[styles.scorePicker, disabled && styles.scorePickerDisabled]}>
    <Text style={styles.scoreLabel}>{label}</Text>
    <View style={styles.scoreStepper}><Pressable accessibilityRole="button" accessibilityLabel={`Diminuir ${label.toLowerCase()}`} disabled={disabled || parsed <= 0} onPress={() => onChange(String(Math.max(0, parsed - 1)))} style={styles.stepButton}><MaterialDesignIcons name="minus" size={17} color="#D8E6F5" /></Pressable><TextInput accessibilityLabel={`Gols ${label.toLowerCase()}`} keyboardType="number-pad" maxLength={2} editable={!disabled} selectTextOnFocus value={String(value)} placeholder="–" placeholderTextColor="#66809E" onChangeText={onChange} style={styles.scoreInput} /><Pressable accessibilityRole="button" accessibilityLabel={`Aumentar ${label.toLowerCase()}`} disabled={disabled || parsed >= 20} onPress={() => onChange(String(Math.min(20, parsed + 1)))} style={styles.stepButton}><MaterialDesignIcons name="plus" size={17} color="#D8E6F5" /></Pressable></View>
  </View>;
}

function StrikerSection({ teams, chosenTeam, starTeam, onChooseTeam, roster, rosterBusy, selected, onToggle, captainId, onCaptain, strategy, onStrategy, savedStar, round, now, started }) {
  const locked = started || Boolean(round && getRoundStart(round, now));
  const athleteData = selected.map((id) => roster.find((player) => player.id === id) || savedAthlete(id, savedStar)).filter(Boolean);
  return <View style={styles.strikerCard}>
    <View style={styles.strikerHeading}><View style={styles.strikerMedal}><MaterialDesignIcons name="shoe-cleat" size={22} color="#102947" /></View><View style={styles.flex}><Text style={styles.strikerTitle}>ARTILHEIRO DA RODADA</Text><Text style={styles.strikerSub}>Escolha seu trio, eleja o capitão e monte a estratégia.</Text></View><Text style={styles.pickCount}>{selected.length}/3</Text></View>
    <View style={styles.pitch}>
      <View style={styles.pitchOuterLine} /><View style={styles.pitchHalfLine} /><View style={styles.pitchCircle} /><View style={styles.pitchGoalTop} /><View style={styles.pitchGoalBottom} />
      {[0, 1, 2].map((slot) => {
        const player = athleteData[slot];
        const isCaptain = player && captainId === player.id;
        return <Pressable key={slot} accessibilityRole="button" accessibilityLabel={player ? `${player.name}${isCaptain ? ', capitão' : ''}` : `Escolha jogador ${slot + 1}`} onPress={() => player && !locked && onCaptain(player.id)} style={[styles.pitchSlot, styles[`pitchSlot${slot}`], isCaptain && styles.pitchSlotCaptain, !player && styles.pitchSlotEmpty]}>
          {player ? <><View style={[styles.playerDot, isCaptain && styles.playerDotCaptain]}><MaterialDesignIcons name={isCaptain ? 'crown' : 'account'} size={18} color={isCaptain ? '#102947' : '#E8F2FC'} /></View><Text numberOfLines={1} style={styles.pitchPlayerName}>{shortName(player.name)}</Text><Text style={styles.pitchPlayerTeam}>{player.position || 'JOGADOR'}{isCaptain ? ' · C' : ''}</Text></> : <><MaterialDesignIcons name="plus" size={19} color="#9EBAD6" /><Text style={styles.pitchEmptyText}>JOGADOR {slot + 1}</Text></>}
        </Pressable>;
      })}
      {started && athleteData.map((player) => <GoalChip key={`goal-${player.id}`} player={player} goals={round?.playerGoals?.[player.id]} />)}
    </View>

    <Text style={styles.formLabel}>TIME DO CAMPEONATO</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubChoices}>
      {teams.map((team) => <Pressable key={team.id} disabled={locked} onPress={() => onChooseTeam(team.id)} style={[styles.clubChip, starTeam === team.id && styles.clubChipSelected, locked && styles.actionLocked]}><TeamLogo team={team} size={22} /><Text numberOfLines={1} style={styles.clubChipText}>{team.name}</Text></Pressable>)}
    </ScrollView>
    {chosenTeam && <Text style={styles.rosterPrompt}>{chosenTeam.name} · escolha três atletas do elenco</Text>}
    {rosterBusy ? <View style={styles.rosterLoading}><ActivityIndicator color="#A6ED6A" /><Text style={styles.rosterLoadingText}>Consultando elenco da ESPN…</Text></View> : roster.length ? <View style={styles.athleteList}>{roster.map((athlete) => {
      const active = selected.includes(athlete.id);
      return <Pressable key={athlete.id} disabled={locked || (!active && selected.length === 3)} onPress={() => onToggle(athlete)} style={[styles.athleteRow, active && styles.athleteSelected, locked && styles.actionLocked]}><View style={[styles.athleteCheck, active && styles.athleteCheckActive]}>{active && <MaterialDesignIcons name="check" size={13} color="#102947" />}</View><Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text><Text style={styles.athletePosition}>{athlete.position || '—'}{athlete.jersey ? ` · #${athlete.jersey}` : ''}</Text></Pressable>;
    })}</View> : <View style={styles.rosterEmpty}><Text style={styles.rosterEmptyText}>{starTeam ? 'O elenco não carregou. Tente selecionar o time novamente.' : 'Escolha um time que joga nesta rodada para consultar o elenco.'}</Text></View>}

    <View style={styles.strategyHeader}><Text style={styles.formLabel}>ESTRATÉGIA DO CAPITÃO</Text><Text style={styles.captainHint}>{captainId ? `${athleteData.find((player) => player.id === captainId)?.name || 'Capitão'} · toque em um jogador no campo para trocar` : 'Toque em um dos três no campo para nomear capitão'}</Text></View>
    <View style={styles.strategyList}>{STRATEGIES.map((item) => <Pressable key={item.id} disabled={locked} onPress={() => onStrategy(item.id)} style={[styles.strategyOption, strategy === item.id && styles.strategySelected, locked && styles.actionLocked]}><View style={[styles.strategyIcon, strategy === item.id && styles.strategyIconSelected]}><MaterialDesignIcons name={item.icon} size={17} color={strategy === item.id ? '#102947' : '#BCD0E5'} /></View><View style={styles.flex}><Text style={styles.strategyName}>{item.name}</Text><Text style={styles.strategyDetail}>{item.detail}</Text></View>{strategy === item.id && <MaterialDesignIcons name="check-circle" size={19} color="#B7F378" />}</Pressable>)}</View>
    {started && athleteData.length === 3 && captainId && <StrikerScoreboard athletes={athleteData} captainId={captainId} strategy={strategy} playerGoals={round?.playerGoals || {}} />}
    {started && <Text style={styles.lockedNote}>Trio e estratégia definidos. As escolhas ficam travadas durante a rodada.</Text>}
  </View>;
}

function GoalChip({ player, goals }) {
  const { goals: score, assists } = goalMetrics(goals);
  return <View style={[styles.goalChip, score > 0 && styles.goalChipScored]}><Text style={styles.goalChipName}>{shortName(player.name)}</Text><Text style={styles.goalChipResult}>{score} gol{score === 1 ? '' : 's'}{assists ? ` · ${assists} ast` : ''}</Text></View>;
}

function StrikerScoreboard({ athletes, captainId, strategy, playerGoals }) {
  const totalGoals = athletes.reduce((sum, player) => sum + goalMetrics(playerGoals[player.id]).goals, 0);
  const captain = athletes.find((player) => player.id === captainId);
  const captainStats = goalMetrics(captain ? playerGoals[captain.id] : null);
  const supportingPoints = athletes.filter((player) => player.id !== captainId).reduce((sum, player) => sum + goalMetrics(playerGoals[player.id]).goals, 0);
  let captainPoints = strategy === 'garcom' ? captainStats.goals + captainStats.assists : strategy === 'hatTrick' ? captainStats.goals >= 3 ? 8 + captainStats.goals - 3 : captainStats.goals : captainStats.goals * 2;
  let penalty = 0;
  if (strategy === 'hatTrick' && totalGoals < 3) penalty = -3;
  else if (strategy !== 'hatTrick' && totalGoals === 0) penalty = -1;
  const score = supportingPoints + captainPoints + penalty;
  return <View style={{ marginHorizontal: 12, marginTop: 9, padding: 10, borderRadius: 10, backgroundColor: '#102C3D', borderWidth: 1, borderColor: '#426552' }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: '#AFC9B8', fontSize: 8, fontWeight: '900', letterSpacing: .5 }}>PARCIAL DO ARTILHEIRO</Text><Text style={{ color: score < 0 ? '#FF9A8E' : '#C6F38E', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{score > 0 ? '+' : ''}{score} pts</Text></View><Text style={{ color: '#B1C7B8', fontSize: 8, marginTop: 4 }}>{`Trio: ${totalGoals} gols · Capitão: ${captainStats.goals} gols${strategy === 'garcom' ? ` + ${captainStats.assists} assist.` : ''}${penalty ? ` · penalidade ${penalty}` : ''}`}</Text></View>;
}

function goalMetrics(value) {
  if (typeof value === 'number') return { goals: value, assists: 0 };
  return { goals: Number(value?.count ?? value?.goals ?? value?.goalCount ?? 0), assists: Number(value?.assists ?? value?.assistsCount ?? value?.assistCount ?? 0) };
}

function TeamLogo({ team, size = 34 }) {
  return team?.image || team?.logo ? <Image source={{ uri: team.image || team.logo }} resizeMode="contain" style={{ width: size, height: size }} /> : <View style={[styles.teamLogoFallback, { width: size, height: size }]}><MaterialDesignIcons name="shield-outline" size={size * .58} color="#91AAC5" /></View>;
}

function getRoundTeams(matches, teams) {
  const seen = new Set();
  return matches.flatMap((match) => [match.homeTeam, match.awayTeam].filter(Boolean).map((id) => {
    const item = teams[id] || {};
    const home = match.homeTeam === id;
    return { id, name: (home ? match.homeTeamName : match.awayTeamName) || item.name || 'Clube', image: (home ? match.homeTeamImage : match.awayTeamImage) || item.image || '', espnTeamId: home ? match.apiHomeTeamId : match.apiAwayTeamId, leagueCode: match.apiLeagueCode || 'bra.1' };
  })).filter((team) => !seen.has(team.id) && seen.add(team.id));
}

function matchTeam(id, matches, teams) {
  if (!id) return null;
  const match = matches.find((item) => item.homeTeam === id || item.awayTeam === id);
  if (!match) return teams[id] ? { id, ...teams[id] } : null;
  const home = match.homeTeam === id;
  return { id, ...(teams[id] || {}), name: (home ? match.homeTeamName : match.awayTeamName) || teams[id]?.name || 'Clube', image: (home ? match.homeTeamImage : match.awayTeamImage) || teams[id]?.image || '', espnTeamId: home ? match.apiHomeTeamId : match.apiAwayTeamId, leagueCode: match.apiLeagueCode || 'bra.1' };
}

function savedAthlete(id, saved) {
  const players = Array.isArray(saved?.players) ? saved.players : [];
  const item = players.find((player) => String(player.id || player.athleteId) === String(id));
  return item ? { id: String(item.id || item.athleteId), name: item.name || item.athleteName || saved.athleteName || 'Jogador', position: item.position || '' } : null;
}

function toArray(value) { return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []; }
function asInput(value) { return value === null || value === undefined ? '' : String(value); }
function teamName(id, teams, match) { const isHome = match?.homeTeam === id; return (isHome ? match.homeTeamName : match?.awayTeamName) || teams[id]?.name || 'Time'; }
function hasResult(match) { return Number.isInteger(match?.finalResult?.homeScore) && Number.isInteger(match?.finalResult?.awayScore); }
function scorePrediction(result, prediction, isStar) {
  if (!result || prediction?.homeScore === undefined || prediction?.awayScore === undefined) return null;
  const home = Number(prediction.homeScore);
  const away = Number(prediction.awayScore);
  let points = home === result.homeScore && away === result.awayScore ? 3
    : Math.sign(home - away) === Math.sign(result.homeScore - result.awayScore) ? 1
      : home === result.awayScore && away === result.homeScore ? -1 : 0;
  if (isStar) points *= 2;
  return points;
}
function toManausTimestamp(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !value) return 0;
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}-04:00`).getTime() || 0;
}
function getMatchDeadline(match, round) { return toManausTimestamp(match?.timestamp) || toManausTimestamp(round?.finishTimestamp); }
function getRoundStart(round, now) {
  const deadlines = toArray(round?.matches).map((match) => getMatchDeadline(match, round)).filter(Boolean);
  return Boolean(deadlines.length && now >= Math.min(...deadlines));
}
function isLocked(match, round, now) { const deadline = getMatchDeadline(match, round); return !deadline || now >= deadline || hasResult(match); }
function formatCountdown(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms % 3600000 / 60000);
  const seconds = Math.floor(ms % 60000 / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
function shortName(name = '') { return name.trim().split(/\s+/).slice(0, 2).join(' '); }
function getRoundNumber(round) {
  const value = round?.seqNumber ?? round?.roundNumber ?? round?.number ?? round?.num ?? round?.rodada;
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}
function normalizeSeasonStatus(status) {
  const value = String(status || '').trim().toLowerCase().replace(/[ -]/g, '_');
  return ({ active: 'em_andamento', open: 'em_andamento', draft: 'a_iniciar', preparation: 'a_iniciar', prepared: 'a_iniciar', complete: 'concluida', finished: 'concluida', closed: 'concluida' })[value] || value;
}
function readableSeasonStatus(status) {
  return ({ a_iniciar: 'A Iniciar', em_andamento: 'Em Andamento', concluida: 'Concluída' })[normalizeSeasonStatus(status)] || 'Não definida';
}
function cleanRoundName(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const name = value.trim();
  return /-?[A-Za-z0-9_]{18,}/.test(name) ? '' : name;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#071735' }, flex: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: '#C2D2E2', fontSize: 13, fontWeight: '700' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }, backButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: '#365474', backgroundColor: '#102C4E', alignItems: 'center', justifyContent: 'center' }, topTitle: { flex: 1 }, kicker: { color: '#B5ED78', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#F2F6FB', fontSize: 27, lineHeight: 30, fontWeight: '900', letterSpacing: -.7 }, roundStamp: { minWidth: 53, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#48703C', backgroundColor: '#173B32', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }, roundStampLabel: { color: '#B6D1B3', fontSize: 7, fontWeight: '900', letterSpacing: .7 }, roundStampValue: { color: '#D8FFAE', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  seasonStatusBar: { minHeight: 34, marginBottom: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 9, borderWidth: 1, borderColor: '#315747', backgroundColor: '#10342F' }, seasonStatusLabel: { color: '#AFC3D3', fontSize: 8, letterSpacing: .6, fontWeight: '900' }, seasonStatusValue: { color: '#C9F0A7', fontSize: 9, fontWeight: '900' },
  clockPanel: { minHeight: 92, padding: 14, borderRadius: 16, backgroundColor: '#12355A', borderWidth: 1, borderColor: '#416386', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, clockPanelLive: { borderColor: '#E4B747', backgroundColor: '#302E24' }, clockCopy: { flex: 1 }, liveDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#A6F16A', marginBottom: 7 }, clockStatus: { color: '#B7ED79', fontSize: 8, fontWeight: '900', letterSpacing: .75 }, clockRound: { color: '#F1F6FC', fontSize: 17, fontWeight: '900', marginTop: 4 }, clockDivider: { width: 1, height: 46, backgroundColor: 'rgba(207,224,240,.22)', marginHorizontal: 14 }, clockTimeWrap: { minWidth: 108, alignItems: 'flex-end' }, clockHint: { color: '#9EB5CD', fontSize: 7, fontWeight: '900', letterSpacing: .5 }, clockTime: { color: '#D7FFAA', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 3 }, liveDeadlineNote: { color: '#AABCD0', fontSize: 9, lineHeight: 14, marginTop: 7, marginHorizontal: 3 },
  sectionHeader: { marginTop: 24, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: '#F4F7FB', fontSize: 17, fontWeight: '900', letterSpacing: -.2 }, sectionSub: { color: '#91A8C1', fontSize: 10, marginTop: 3 },
  matchCard: { marginBottom: 10, padding: 12, borderRadius: 15, backgroundColor: 'rgba(13,37,67,.96)', borderWidth: 1, borderColor: '#28496A' }, matchStar: { borderColor: '#A9D866' }, matchWildcard: { borderColor: '#D5A943' }, matchLocked: { opacity: .88 }, matchMeta: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, matchTime: { color: '#93ABC3', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, tags: { flexDirection: 'row', alignItems: 'center', gap: 5 }, starTag: { overflow: 'hidden', borderRadius: 5, backgroundColor: '#C8F18F', color: '#142B33', paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, fontWeight: '900' }, wildTag: { overflow: 'hidden', borderRadius: 5, backgroundColor: '#F4C85E', color: '#392D11', paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, fontWeight: '900' }, matchTeams: { flexDirection: 'row', alignItems: 'center', minHeight: 47 }, teamLabel: { width: 76, marginLeft: 7 }, awayLabel: { marginRight: 7, marginLeft: 0 }, teamText: { color: '#EAF1FA', fontSize: 10, lineHeight: 13, fontWeight: '800' }, sideLabel: { color: '#829DB9', fontSize: 7, fontWeight: '900', marginTop: 3 }, textRight: { textAlign: 'right' }, centerScore: { flex: 1, alignItems: 'center' }, vs: { color: '#67819C', fontSize: 15, fontWeight: '900' }, finalScore: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] }, teamLogoFallback: { alignItems: 'center', justifyContent: 'center' }, scoreInputs: { marginTop: 10, padding: 8, borderRadius: 11, backgroundColor: 'rgba(4,17,36,.62)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, scorePicker: { alignItems: 'center' }, scorePickerDisabled: { opacity: .52 }, scoreLabel: { color: '#829DB8', fontSize: 7, fontWeight: '900', letterSpacing: .45, marginBottom: 3 }, scoreStepper: { flexDirection: 'row', alignItems: 'center', gap: 7 }, stepButton: { width: 28, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#183957' }, scoreInput: { minWidth: 34, padding: 0, color: '#F4F8FE', textAlign: 'center', fontSize: 22, lineHeight: 27, fontWeight: '900', fontVariant: ['tabular-nums'] }, scoreSeparator: { color: '#68839F', fontSize: 16, fontWeight: '900', paddingTop: 10 }, matchActions: { flexDirection: 'row', gap: 8, marginTop: 9 }, matchAction: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, borderWidth: 1, borderColor: '#345373', backgroundColor: '#112D4C' }, matchActionStar: { borderColor: '#C1EA79', backgroundColor: '#C1EA79' }, matchActionWild: { borderColor: '#F0C660', backgroundColor: '#F0C660' }, matchActionText: { color: '#C6D5E5', fontSize: 8, fontWeight: '900', letterSpacing: .35 }, matchActionActiveText: { color: '#152C3E' }, actionLocked: { opacity: .5 }, wildEditor: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderColor: 'rgba(221,182,82,.25)' }, wildTitle: { color: '#F4D276', fontSize: 8, fontWeight: '900', letterSpacing: .55, textAlign: 'center' }, wildScores: { marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }, resultLine: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderColor: 'rgba(171,194,218,.14)', flexDirection: 'row', alignItems: 'center', gap: 8 }, resultCaption: { color: '#91A8BF', fontSize: 7, fontWeight: '900' }, resultGuess: { flex: 1, color: '#E4EDF7', fontSize: 12, fontWeight: '800' }, viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7, borderRadius: 7, backgroundColor: '#183957' }, viewButtonText: { color: '#BFD5EB', fontSize: 7, fontWeight: '900' },
  ruleBanner: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(227,188,86,.22)', backgroundColor: 'rgba(73,58,24,.34)' }, ruleCopy: { flex: 1, color: '#CBBF9C', fontSize: 9, lineHeight: 14 }, selectionSummary: { color: '#D5E2F0', fontSize: 9, fontWeight: '800', marginTop: 8 },
  strikerCard: { marginTop: 12, marginBottom: 18, overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#3D634E', backgroundColor: '#0C2A32' }, strikerHeading: { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#123B3A' }, strikerMedal: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#B9F274', alignItems: 'center', justifyContent: 'center' }, strikerTitle: { color: '#EAF7D9', fontSize: 12, fontWeight: '900', letterSpacing: .35 }, strikerSub: { color: '#AFC7B6', fontSize: 9, lineHeight: 13, marginTop: 3 }, pickCount: { color: '#D5F8A5', fontSize: 14, fontWeight: '900' }, pitch: { height: 198, margin: 12, borderRadius: 13, backgroundColor: '#176047', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(228,246,211,.48)' }, pitchOuterLine: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1, borderColor: 'rgba(229,246,215,.43)', borderRadius: 5 }, pitchHalfLine: { position: 'absolute', top: 0, bottom: 0, width: 1, left: '50%', backgroundColor: 'rgba(229,246,215,.38)' }, pitchCircle: { position: 'absolute', width: 82, height: 82, borderRadius: 42, borderWidth: 1, borderColor: 'rgba(229,246,215,.38)', left: '50%', top: 58, marginLeft: -41 }, pitchGoalTop: { position: 'absolute', width: 34, height: 9, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(229,246,215,.45)', top: 8, left: '50%', marginLeft: -17 }, pitchGoalBottom: { position: 'absolute', width: 34, height: 9, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(229,246,215,.45)', bottom: 8, left: '50%', marginLeft: -17 }, pitchSlot: { position: 'absolute', width: 86, height: 67, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: 'rgba(8,35,51,.82)', borderWidth: 1, borderColor: 'rgba(226,242,221,.42)', paddingHorizontal: 5 }, pitchSlot0: { top: 19, left: '50%', marginLeft: -43 }, pitchSlot1: { bottom: 17, left: '22%', marginLeft: -43 }, pitchSlot2: { bottom: 17, left: '78%', marginLeft: -43 }, pitchSlotCaptain: { borderColor: '#E5C768', backgroundColor: 'rgba(44,55,34,.95)' }, pitchSlotEmpty: { borderStyle: 'dashed', backgroundColor: 'rgba(7,36,49,.46)' }, playerDot: { width: 25, height: 25, borderRadius: 14, backgroundColor: '#1C6EB0', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }, playerDotCaptain: { backgroundColor: '#F1CF68' }, pitchPlayerName: { color: '#F5F9F2', maxWidth: '100%', fontSize: 8, fontWeight: '900' }, pitchPlayerTeam: { color: '#B5D3BA', fontSize: 6, fontWeight: '900', marginTop: 1 }, pitchEmptyText: { color: '#AEC1D2', fontSize: 7, fontWeight: '900', marginTop: 2 }, goalChip: { position: 'absolute', top: 8, right: 11, minWidth: 70, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#143344', borderWidth: 1, borderColor: 'rgba(219,237,222,.36)' }, goalChipScored: { backgroundColor: '#D9F4AC', borderColor: '#F1FFD8' }, goalChipName: { color: '#E9F4E8', fontSize: 6, fontWeight: '900' }, goalChipResult: { color: '#C3D6C4', fontSize: 6, marginTop: 2 },
  formLabel: { color: '#9EB6CC', fontSize: 8, fontWeight: '900', letterSpacing: .55, marginHorizontal: 13, marginTop: 6, marginBottom: 7 }, clubChoices: { paddingHorizontal: 13, gap: 7, paddingBottom: 2 }, clubChip: { minHeight: 38, paddingHorizontal: 9, gap: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#315348', backgroundColor: '#102F38', maxWidth: 158 }, clubChipSelected: { borderColor: '#B6EE78', backgroundColor: '#20483D' }, clubChipText: { maxWidth: 105, color: '#D6E6DA', fontSize: 8, fontWeight: '800' }, rosterPrompt: { color: '#B8D4BE', fontSize: 9, marginHorizontal: 13, marginTop: 9 }, rosterLoading: { minHeight: 63, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, rosterLoadingText: { color: '#A8C1B1', fontSize: 9 }, rosterEmpty: { minHeight: 55, justifyContent: 'center', paddingHorizontal: 14 }, rosterEmptyText: { color: '#839DB4', fontSize: 9, lineHeight: 14 }, athleteList: { marginHorizontal: 12, marginTop: 8, maxHeight: 240, borderRadius: 10, borderWidth: 1, borderColor: '#315147', overflow: 'hidden' }, athleteRow: { minHeight: 37, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(209,231,214,.08)' }, athleteSelected: { backgroundColor: 'rgba(158,224,105,.13)' }, athleteCheck: { width: 17, height: 17, borderRadius: 5, borderWidth: 1, borderColor: '#668A78', alignItems: 'center', justifyContent: 'center' }, athleteCheckActive: { backgroundColor: '#B9F274', borderColor: '#B9F274' }, athleteName: { flex: 1, color: '#DCE9E0', fontSize: 9, fontWeight: '700' }, athletePosition: { color: '#8FA99A', fontSize: 8, fontWeight: '800' }, strategyHeader: { marginTop: 12 }, captainHint: { color: '#86A398', fontSize: 8, marginHorizontal: 13, marginTop: -3, marginBottom: 8 }, strategyList: { marginHorizontal: 12, gap: 6 }, strategyOption: { minHeight: 53, paddingHorizontal: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, borderWidth: 1, borderColor: '#315147', backgroundColor: 'rgba(11,40,43,.6)' }, strategySelected: { borderColor: '#92C66C', backgroundColor: '#153F3D' }, strategyIcon: { width: 31, height: 31, borderRadius: 9, backgroundColor: '#203F43', alignItems: 'center', justifyContent: 'center' }, strategyIconSelected: { backgroundColor: '#B9F274' }, strategyName: { color: '#E6F1E3', fontSize: 9, fontWeight: '900' }, strategyDetail: { color: '#9FB5A8', fontSize: 8, lineHeight: 11, marginTop: 2 }, lockedNote: { color: '#A3B7A8', fontSize: 9, lineHeight: 14, padding: 13 },
  saveDock: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 9 : 4, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: '#254261', backgroundColor: '#091D39' }, saveDockCopy: { flex: 1 }, saveDockTitle: { color: '#E7F0FB', fontSize: 9, fontWeight: '900' }, saveDockHint: { color: '#8EA7C2', fontSize: 7, lineHeight: 10, marginTop: 3 }, saveButton: { minWidth: 111, minHeight: 46, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 12, backgroundColor: '#B8F273', borderBottomWidth: 3, borderBottomColor: '#77B94D' }, saveButtonText: { color: '#122D44', fontSize: 10, fontWeight: '900', letterSpacing: .5 }, saveDisabled: { opacity: .55 }, pressed: { opacity: .8, transform: [{ scale: .985 }] }, bottomSpace: { height: 12 },
  empty: { minHeight: 330, marginTop: 18, borderRadius: 17, borderWidth: 1, borderColor: '#2E4C6B', backgroundColor: 'rgba(13,38,69,.92)', alignItems: 'center', justifyContent: 'center', padding: 25 }, emptyTitle: { marginTop: 14, color: '#F1F6FC', fontSize: 19, fontWeight: '900' }, emptyCopy: { marginTop: 8, color: '#AFC2D6', fontSize: 11, lineHeight: 17, textAlign: 'center' }, secondaryButton: { marginTop: 20, borderRadius: 10, borderWidth: 1, borderColor: '#476989', paddingHorizontal: 16, paddingVertical: 11 }, secondaryButtonText: { color: '#D8E6F4', fontSize: 9, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(1,7,18,.8)', justifyContent: 'center', padding: 20 }, predictionModal: { maxHeight: '72%', borderRadius: 16, backgroundColor: '#102A49', borderWidth: 1, borderColor: '#426384', padding: 15 }, modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderColor: 'rgba(190,213,238,.16)' }, modalTitle: { color: '#EAF2FB', fontSize: 13, fontWeight: '900' }, modalSub: { color: '#9DB4CD', fontSize: 9, marginTop: 4 }, modalClose: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B3A5B' }, hiddenPredictions: { color: '#B8C9DB', fontSize: 11, lineHeight: 17, paddingVertical: 20, textAlign: 'center' }, modalList: { marginTop: 8 }, predictionLine: { minHeight: 43, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(190,213,238,.12)' }, predictionName: { flex: 1, color: '#D9E6F3', fontSize: 10, fontWeight: '700' }, predictionScore: { color: '#F4F8FD', fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
