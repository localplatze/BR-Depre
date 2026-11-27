import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { auth, onAuthStateChanged, signOut } from '../services/firebaseAuth';
import { database, equalTo, get, limitToFirst, onValue, orderByChild, query, ref } from '../services/firebaseDatabase';
import { isPlayerSetupComplete } from '../services/onboardingSession';
import { PlayerAvatar, PlayerCrest, makeTeamInitials } from '../components/IdentityArt';

const STADIUM = require('../../assets/brand/stadium-night.jpg');
const AVATAR_PLACEHOLDER = require('../../assets/brand/avatar-placeholder.png');

const formulaTeams = [
  ['red-burro', 'Red Burro FC'], ['mc-lata', 'McLata FC'], ['ferruja', 'Ferruja Corse'],
  ['mercedao', 'Mercedao GP'], ['aston-maula', 'Aston Maula'], ['alpinada', 'Alpinada Racing'],
  ['willi-massa', 'WilliMassa'], ['rb-bangu', 'RB Bangu'], ['saube', 'Saube FC'],
  ['haas-da-massa', 'Haas da Massa'], ['cadilacre', 'Cadilacre Speed Team'],
];
const campaign = [
  { name: 'Superliga', key: 'superliga', detail: 'Classificação geral' },
  { name: 'Supercopa', key: 'supercopa', detail: 'Fase atual' },
  { name: 'Resta Um', key: 'restaUm', detail: 'Situação na disputa' },
];
const tournaments = [
  { name: 'Superliga', detail: 'Top 8 até a última rodada', mark: 'cup', tone: 'green', featured: true },
  { name: 'Supercopa', detail: 'Grupos e mata-mata', mark: 'shield', tone: 'blue' },
  { name: 'Libertadores', detail: 'Vagas por temporada', mark: 'globe', tone: 'gold' },
  { name: 'Recopa', detail: 'Duelo dos campeões', mark: 'star', tone: 'blue' },
  { name: 'Resta Um', detail: 'Sobreviva à rodada', mark: 'chess', tone: 'green' },
  { name: 'Cinturão', detail: 'Disputa mensal', mark: 'belt', tone: 'gold' },
  { name: 'Fórmula Deprê', detail: 'Sua equipe na pista', mark: 'flag', tone: 'blue' },
  { name: 'Séries B e C', detail: 'Fases e classificação', mark: 'bracket', tone: 'green' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [playerProfile, setPlayerProfile] = useState(null);
  const [seasonStatus, setSeasonStatus] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [homeRound, setHomeRound] = useState(null);
  const [homeSummary, setHomeSummary] = useState(null);
  const [competitionSummary, setCompetitionSummary] = useState(null);
  const [syncError, setSyncError] = useState(false);
  const player = auth.currentUser;
  const playerName = playerProfile?.name || player?.displayName || player?.email?.split('@')[0] || 'Seu perfil';
  const teamName = playerProfile?.customTeamName || playerProfile?.teamName || 'Meu time';
  const formulaName = playerProfile?.formulaTeamName || 'Escuderia não escolhida';
  const teamImage = asPlayerShield(playerProfile?.shieldUrl) || asRemoteImage(playerProfile?.teamImage);
  const avatarUri = asRemoteImage(playerProfile?.avatarUrl || player?.photoURL);

  useEffect(() => {
    if (!isRoundOpen(homeRound) || !getDeadline(homeRound)) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [homeRound]);

  useEffect(() => {
    let alive = true;
    let stopSummary = () => {};
    let stopSeasonStatus = () => {};
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/entrar');
        return;
      }
      stopSeasonStatus();
      stopSeasonStatus = onValue(ref(database, 'seasons/2027/status'), (snapshot) => {
        if (alive) setSeasonStatus(snapshot.val());
      }, () => {});
      try {
        const profile = await loadPlayerProfile(user.uid);
        if (!alive) return;
        if (!isPlayerSetupComplete(profile)) {
          router.replace('/configurar-perfil');
          return;
        }
        setPlayerProfile(profile);
        setProfileReady(true);
      } catch {
        if (alive) setSyncError(true);
      }
      if (!alive) return;
      const refreshRound = async () => {
        try {
          const result = await loadHomeDashboardData(user.uid);
          if (alive) {
            setHomeRound(result.round);
            setCompetitionSummary(result.competitions);
            setSyncError(false);
          }
        } catch {
          if (alive) setSyncError(true);
        }
      };
      refreshRound();
      stopSummary = onValue(ref(database, `appHome/users/${user.uid}`), (snapshot) => {
        if (alive) setHomeSummary(snapshot.val());
      }, () => { if (alive) setSyncError(true); });
    });
    return () => {
      alive = false;
      stopAuth();
      stopSummary();
      stopSeasonStatus();
    };
  }, [router]);

  function comingSoon(screen) {
    Alert.alert(screen, 'Esta tela será conectada na próxima etapa.');
  }

  function openTournament(screen) {
    if (screen === 'Resenha') {
      router.push('/resenha');
      return;
    }
    if (screen === 'Notificações') {
      router.push('/notificacoes');
      return;
    }
    if (screen === 'Sala de troféus' || screen === 'Conquistas') {
      router.push('/conquistas');
      return;
    }
    if (screen === 'Palpites') {
      router.push('/palpites');
      return;
    }
    if (screen === 'Superliga') {
      router.push('/superliga');
      return;
    }
    comingSoon(screen);
  }

  async function handleSignOut() {
    await signOut(auth);
    router.replace('/');
  }

  function openProfile() {
    Alert.alert('Perfil', 'A tela de perfil será construída na próxima etapa.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Sair da conta', style: 'destructive', onPress: handleSignOut },
    ]);
  }

  if (!profileReady) {
    return <SafeAreaView style={styles.root}><View style={styles.loading}><ActivityIndicator color="#A5EF65" size="large" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={STADIUM} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(4,15,42,.38)', 'rgba(4,15,42,.72)', '#071735']} locations={[0, .62, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.topbar}>
            <View style={styles.identity}>
              <View style={styles.clubMark} accessibilityLabel="Escudo do time">
                {playerProfile?.useCustomShield && playerProfile?.shieldConfig
                  ? <PlayerCrest config={playerProfile.shieldConfig} initials={makeTeamInitials(teamName)} size={48} />
                  : teamImage ? <Image source={{ uri: teamImage }} resizeMode="contain" style={styles.teamImage} /> : <TeamShield />}
              </View>
              <View style={styles.playerCopy}>
                <Text numberOfLines={1} style={styles.playerName}>{playerName}</Text>
                <Text numberOfLines={1} style={styles.clubName}>{teamName}</Text>
                <Text numberOfLines={1} style={styles.supportingTeams}>{formulaName}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Notificações" onPress={() => router.push('/notificacoes')} style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}>
                <AppIcon name="bell" color="#F4F8FF" size={21} />
              </Pressable>
              {playerProfile?.isAdmin === true && <Pressable accessibilityRole="button" accessibilityLabel="Painel administrativo" onPress={() => router.push('/administrativo')} style={({ pressed }) => [styles.adminButton, pressed && styles.pressed]}>
                <AppIcon name="shield" color="#C9F5A3" size={21} />
              </Pressable>}
            </View>
          </View>
        </View>

        <View style={styles.seasonStatusBanner} accessibilityLiveRegion="polite">
          <AppIcon name="flag" color="#B8F276" size={17} />
          <Text style={styles.seasonStatusText}>TEMPORADA 2027</Text>
          <Text style={styles.seasonStatusValue}>{readableSeasonStatus(seasonStatus)}</Text>
        </View>

        <View style={styles.focusRow}>
          <View style={styles.avatarStage}>
            <View style={styles.avatarTurf} />
            {playerProfile?.avatarConfig
              ? <PlayerAvatar config={playerProfile.avatarConfig} crestConfig={playerProfile.shieldConfig} initials={makeTeamInitials(playerProfile.customTeamName)} size={116} style={styles.avatarHero} />
              : <Image source={avatarUri ? { uri: avatarUri } : AVATAR_PLACEHOLDER} resizeMode="contain" style={styles.avatarHero} accessibilityLabel="Avatar provisório do jogador" />}
            <Text style={styles.avatarCaption}>SEU AVATAR</Text>
          </View>
          <RoundPanel round={homeRound} summary={homeSummary} now={now} syncError={syncError} onPress={openTournament} />
        </View>

        {competitionSummary?.important && (
          <Pressable accessibilityRole="button" onPress={() => comingSoon(competitionSummary.important.destination)} style={({ pressed }) => [styles.beltNotice, pressed && styles.pressed]}>
            <AppIcon name={competitionSummary.important.icon} color={competitionSummary.important.color} size={23} />
            <View style={styles.beltCopy}>
              <Text style={[styles.beltTitle, { color: competitionSummary.important.color }]}>{competitionSummary.important.title}</Text>
              <Text style={styles.beltSubtitle}>{competitionSummary.important.detail}</Text>
            </View>
            <AppIcon name="arrow" color={competitionSummary.important.color} size={18} />
          </Pressable>
        )}

        <View style={styles.sectionHead}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>SUA CAMPANHA</Text>
          <View style={styles.archiveActions}>
            <Pressable accessibilityRole="button" onPress={() => comingSoon('Histórico')} style={({ pressed }) => [styles.archiveButton, styles.historyButton, pressed && styles.archiveButtonPressed]}>
              <AppIcon name="history" color="#D9ECFF" size={18} />
              <Text style={styles.archiveLabel}>HISTÓRICO</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/conquistas')} style={({ pressed }) => [styles.archiveButton, styles.trophyButton, pressed && styles.archiveButtonPressed]}>
              <AppIcon name="trophy" color="#FFF0AA" size={18} />
              <Text style={styles.archiveLabel}>TROFÉUS</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.campaignPanel}>
          <View style={styles.campaignIntro}>
            <Text style={styles.campaignLead}>Sua posição nos torneios</Text>
            <Text style={styles.campaignHint}>{competitionSummary ? 'Dados da temporada 2027' : 'Carregando sua campanha'}</Text>
          </View>
          {campaign.map((item, index) => (
            <Pressable key={item.name} accessibilityRole="button" onPress={() => openTournament(item.name)} style={({ pressed }) => [styles.campaignRow, index === campaign.length - 1 && styles.campaignLastRow, pressed && styles.pressed]}>
              <View style={styles.campaignNameWrap}>
                <View style={[styles.campaignTick, index === 0 && styles.campaignTickActive]} />
                <View>
                  <Text style={styles.campaignName}>{item.name}</Text>
                  <Text style={styles.campaignDetail}>{competitionSummary?.[item.key]?.detail || item.detail}</Text>
                </View>
              </View>
              <Text style={[styles.campaignValue, item.key !== 'superliga' && styles.campaignStatusValue, item.key === 'supercopa' && styles.campaignCupValue, item.key === 'restaUm' && competitionSummary?.restaUm?.eliminated && styles.campaignEliminatedValue]}>{competitionSummary?.[item.key]?.value ?? (item.key === 'superliga' ? 'AGUARDANDO' : '—')}</Text>
              <AppIcon name="arrow" color="#91A9C7" size={16} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.sectionHead, styles.tournamentHead]}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>COMPETIÇÕES</Text>
          <Text style={styles.sectionAside}>ACOMPANHE A TURMA</Text>
        </View>
        <View style={styles.tournamentGrid}>
          {tournaments.map((tournament) => (
            <TournamentTile key={tournament.name} tournament={tournament} onPress={() => openTournament(tournament.name)} />
          ))}
        </View>
      </ScrollView>

      <BottomNavigation onSelect={openTournament} onHome={() => {}} onProfile={openProfile} />
    </SafeAreaView>
  );
}

async function loadHomeDashboardData(uid) {
  const activeRounds = query(ref(database, 'seasons/2027/rounds'), orderByChild('status'), equalTo(1), limitToFirst(1));
  const [supercopaSnapshot, supercopa2027Snapshot, restaSnapshot, resta2027Snapshot, beltSnapshot, belt2027Snapshot, roundsSnapshot, superligaSnapshot, seasonStatusSnapshot] = await Promise.all([
    get(ref(database, 'tournaments/supercopa')),
    get(ref(database, 'tournaments/supercopa/2027')),
    get(ref(database, 'tournaments/restaUm')),
    get(ref(database, 'tournaments/restaUm/2027')),
    get(ref(database, 'tournaments/cinturao')),
    get(ref(database, 'tournaments/cinturao/2027')),
    get(activeRounds),
    get(ref(database, 'tournaments/superliga/2027')),
    get(ref(database, 'seasons/2027/status')).catch(() => null),
  ]);
  const supercopa = supercopa2027Snapshot.exists() ? (supercopa2027Snapshot.val() || {}) : (supercopaSnapshot.val() || {});
  const opponentId = getSupercopaOpponentId(supercopa, uid);
  const users = {};
  if (opponentId) {
    const [nameSnapshot, teamNameSnapshot] = await Promise.all([
      get(ref(database, `users/${opponentId}/name`)),
      get(ref(database, `users/${opponentId}/customTeamName`)),
    ]);
    users[opponentId] = { name: nameSnapshot.val(), customTeamName: teamNameSnapshot.val() };
  }
  const rounds = roundsSnapshot.val() || {};
  const roundEntry = Object.entries(rounds)[0];
  const seasonStatus = normalizeSeasonStatus(seasonStatusSnapshot?.val?.());
  const round = seasonStatus === 'em_andamento' && roundEntry ? makeRoundSnapshot(roundEntry[0], roundEntry[1]) : null;
  const competitions = summarizeCompetitions({
    users,
    uid,
    round,
    superliga2027: superligaSnapshot.val(),
    supercopa,
    restaUm: resta2027Snapshot.exists() ? resta2027Snapshot.val() : restaSnapshot.val(),
    belt: belt2027Snapshot.exists() ? belt2027Snapshot.val() : beltSnapshot.val(),
  });
  return { round, competitions };
}

function makeRoundSnapshot(id, data = {}) {
  const roundNumber = data.seqNumber || data.roundNumber || data.number || null;
  return {
    ...data,
    id,
    roundNumber,
    name: data.name || data.label || (roundNumber ? `Rodada ${roundNumber}` : 'Rodada ativa'),
    status: data.status,
    finishTimestamp: data.finishTimestamp || data.deadline || null,
  };
}

function summarizeCompetitions({ users, uid, round, superliga2027, supercopa, restaUm, belt }) {
  const superliga = summarizeSuperliga2027(superliga2027, uid);

  const cup = summarizeSupercopa(supercopa || {}, uid, users);
  const survival = summarizeRestaUm(restaUm, uid);
  let important = null;
  if (survival.eliminated) {
    important = { icon: 'chess', color: '#FF817A', title: 'FIM DE LINHA NO RESTA UM', detail: `Eliminado na rodada ${survival.eliminationRound || '?'}.`, destination: 'Resta Um' };
  } else if (cup.important) {
    important = cup.important;
  } else if (round?.beltActive || (belt?.currentMatch?.status === 1 && [belt.currentMatch.sourceRoundKey, belt.currentMatch.sourceRoundId].includes(round?.id))) {
    important = { icon: 'belt', color: '#F5D05A', title: 'RODADA DO CINTURÃO', detail: 'O título está em jogo nesta rodada.', destination: 'Cinturão do Mês' };
  }
  return { superliga, supercopa: cup, restaUm: survival, important };
}

function summarizeSuperliga2027(data, uid) {
  const regular = data?.regular || {};
  const top8 = data?.top8 || {};
  const secondary = data?.secondary || {};
  const top8Ids = readParticipantIds(top8.participants);
  const secondaryIds = readParticipantIds(secondary.participants);
  const regularClosed = [2, '2', 'complete', 'finished', 'closed'].includes(regular.status);

  if (regularClosed && secondaryIds.includes(uid) && !top8Ids.includes(uid)) {
    return { value: 'NA CHAVE', detail: 'X-Salada · mata-mata eliminatório' };
  }

  const phase = regularClosed && top8Ids.includes(uid) ? top8 : regular;
  const raw = phase.standings || phase.table;
  const entries = Array.isArray(raw)
    ? raw.map((entry, index) => [entry?.playerId || entry?.uid || entry?.userId || String(index), entry])
    : Object.entries(raw || {});
  const bonuses = phase === top8 ? (top8.startingBonus || top8.startingBonusByUid || {}) : {};
  const rows = entries.map(([id, entry]) => {
    const points = Number(entry?.earnedPoints ?? entry?.pointsEarned ?? entry?.points ?? entry?.totalPoints ?? entry?.pts ?? 0) || 0;
    const includesBonus = entry?.bonusIncluded === true || entry?.pointsIncludeBonus === true;
    const bonus = Number(bonuses[id] ?? entry?.startingBonus ?? entry?.bonus ?? 0) || 0;
    return {
      id: entry?.playerId || entry?.uid || entry?.userId || id,
      points: includesBonus ? points : points + bonus,
      roundPoints: Number(entry?.lastRoundPoints ?? entry?.roundPoints ?? 0) || 0,
      previousPosition: Number(entry?.previousPosition) || 999,
    };
  }).sort((a, b) => b.points - a.points || b.roundPoints - a.roundPoints || a.previousPosition - b.previousPosition);
  const index = rows.findIndex((entry) => entry.id === uid);
  if (index < 0) return { value: 'AGUARDANDO', detail: 'Classificação da Superliga 2027 aguardando publicação' };
  const phaseName = phase === top8 ? 'Liga Top 8' : 'classificação geral';
  return { value: `${index + 1}º`, detail: `${rows[index].points} pontos · ${phaseName}` };
}

function getSupercopaOpponentId(data, uid) {
  if (data?.config || data?.groupRounds) {
    const stage = data.config?.activeStage || 'groups';
    if (stage === 'groups') {
      const currentRound = asArray(data.groupRounds).find((entry) => Number(entry.status) === 1);
      const match = asArray(currentRound?.matches).find((entry) => entry.player1Id === uid || entry.player2Id === uid);
      return match ? (match.player1Id === uid ? match.player2Id : match.player1Id) : null;
    }
    const phaseKeys = ['quarterFinals', 'semiFinals', 'final', 'thirdPlace'];
    for (const series of Object.values(data.series || {})) {
      for (const phaseKey of phaseKeys) {
        const phase = series?.phases?.[phaseKey];
        if (Number(phase?.status) !== 1) continue;
        const match = asArray(phase.matches).find((entry) => entry.player1Id === uid || entry.player2Id === uid);
        if (match) return match.player1Id === uid ? match.player2Id : match.player1Id;
      }
    }
    return null;
  }
  const stage = data?.activeStage || 'groups';
  if (stage === 'groups') {
    const groups = data.groups || {};
    const currentRound = Object.values(groups.rounds || {}).find((entry) => Number(entry.status) === 1);
    const match = Object.values(currentRound?.matches || {}).find((entry) => entry.player1Id === uid || entry.player2Id === uid);
    return match ? (match.player1Id === uid ? match.player2Id : match.player1Id) : null;
  }
  const phase = data?.[stage] || {};
  for (const key of ['matches', 'b', 'c']) {
    const match = Object.values(phase[key] || {}).find((entry) => [entry.homeTeam, entry.awayTeam, entry.player1Id, entry.player2Id].includes(uid));
    if (!match) continue;
    return [match.homeTeam || match.player1Id, match.awayTeam || match.player2Id].find((id) => id !== uid) || null;
  }
  return null;
}

function readParticipantIds(value) {
  if (Array.isArray(value)) return value.map((entry) => typeof entry === 'string' ? entry : entry?.uid || entry?.playerId).filter(Boolean);
  if (value && typeof value === 'object') return Object.entries(value).filter(([, member]) => member !== false && member !== null).map(([id]) => id);
  return [];
}

function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }

function summarizeSupercopa(data, uid, users) {
  if (!Object.keys(data).length) return { value: 'EM BREVE', detail: 'Aguardando a abertura da edição' };
  if (data?.config || data?.groupRounds) {
    const stage = data.config?.activeStage || 'groups';
    if (stage === 'finished' || Number(data.status) === 2) return { value: 'ENCERRADA', detail: 'Edição finalizada' };
    if (!data.participants?.length || Number(data.status) === 0) return { value: 'EM BREVE', detail: 'Fase de grupos ainda não começou' };
    if (stage === 'groups') {
      const groupEntry = Object.entries(data.groups || {}).find(([key, members]) => key.startsWith('group') && Array.isArray(members) && members.includes(uid));
      if (!groupEntry) return { value: 'EM GRUPOS', detail: 'Você não está nesta edição' };
      const [groupKey] = groupEntry;
      const groupStandings = Object.values(data.standings?.[groupKey] || {}).sort((a, b) => Number(a.position || 999) - Number(b.position || 999));
      const position = groupStandings.findIndex((entry) => entry.uid === uid) + 1;
      const currentRound = asArray(data.groupRounds).find((entry) => Number(entry.status) === 1);
      const match = asArray(currentRound?.matches).find((entry) => entry.player1Id === uid || entry.player2Id === uid);
      const opponent = match ? (match.player1Id === uid ? match.player2Id : match.player1Id) : null;
      const letter = groupKey.replace('group', '');
      return { value: 'FASE DE GRUPOS', detail: `${position ? `${position}º lugar · ` : ''}Grupo ${letter}`, important: match ? { icon: 'shield', color: '#8FE6FF', title: 'JOGO DA SUPERCOPA', detail: `Confronto contra ${users[opponent]?.customTeamName || users[opponent]?.name || 'seu adversário'}.`, destination: 'Supercopa' } : null };
    }
    const activeSeries = Object.entries(data.series || {}).find(([, series]) => Object.values(series?.phases || {}).some((phase) => Number(phase.status) === 1));
    const phaseNames = { quarterFinals: 'Quartas de final', semiFinals: 'Semifinal', final: 'Final', thirdPlace: '3º lugar' };
    if (!activeSeries) return { value: 'MATA-MATA', detail: 'Aguardando a próxima fase' };
    const [seriesId, seriesData] = activeSeries;
    const [phaseKey, phaseData] = Object.entries(seriesData.phases).find(([, phase]) => Number(phase.status) === 1) || [];
    const match = asArray(phaseData?.matches).find((entry) => entry.player1Id === uid || entry.player2Id === uid);
    const opponentId = match ? (match.player1Id === uid ? match.player2Id : match.player1Id) : null;
    const phaseName = phaseNames[phaseKey] || 'Mata-mata';
    return { value: phaseName.toUpperCase(), detail: match ? `Série ${seriesId} · contra ${users[opponentId]?.customTeamName || users[opponentId]?.name || 'adversário'}` : `Série ${seriesId} · acompanhe os cruzamentos`, important: match ? { icon: 'shield', color: '#8FE6FF', title: `CONFRONTO: ${phaseName.toUpperCase()}`, detail: `Série ${seriesId} · ${users[opponentId]?.customTeamName || users[opponentId]?.name || 'adversário'}.`, destination: 'Supercopa' } : null };
  }
  const stage = data.activeStage || 'groups';
  if (stage === 'groups') {
    const groups = data.groups;
    if (!groups || Number(groups.status || 0) === 0) return { value: 'EM BREVE', detail: 'Fase de grupos ainda não começou' };
    if (Number(groups.status) === 2) return { value: 'GRUPOS ENCERRADOS', detail: 'Aguardando a próxima fase' };
    const groupEntry = Object.entries(groups).find(([key, value]) => key.startsWith('group') && Array.isArray(value) && value.includes(uid));
    if (!groupEntry) return { value: 'EM GRUPOS', detail: 'Você não está nesta edição' };
    const [groupKey, members] = groupEntry;
    const letter = ({ group1: 'A', group2: 'B', group3: 'C', group4: 'D' })[groupKey] || groupKey.replace(/^group/i, '');
    const groupStandings = Object.values(groups.standings || {}).filter((entry) => members.includes(entry.playerId)).sort((a, b) =>
      (Number(b.points) || 0) - (Number(a.points) || 0)
      || (Number(b.wins) || 0) - (Number(a.wins) || 0)
      || ((Number(b.goalsFor) || 0) - (Number(b.goalsAg) || 0)) - ((Number(a.goalsFor) || 0) - (Number(a.goalsAg) || 0))
      || (Number(b.goalsFor) || 0) - (Number(a.goalsFor) || 0));
    const position = groupStandings.findIndex((entry) => entry.playerId === uid) + 1;
    const currentRound = Object.values(groups.rounds || {}).find((entry) => Number(entry.status) === 1);
    const match = Object.values(currentRound?.matches || {}).find((entry) => entry.player1Id === uid || entry.player2Id === uid);
    const opponentId = match ? (match.player1Id === uid ? match.player2Id : match.player1Id) : null;
    return {
      value: 'FASE DE GRUPOS',
      detail: `${position ? `${position}º lugar · ` : ''}Grupo ${letter}`,
      important: match ? { icon: 'shield', color: '#8FE6FF', title: 'JOGO DA SUPERCOPA', detail: `Confronto contra ${users[opponentId]?.customTeamName || users[opponentId]?.name || 'seu adversário'}.`, destination: 'Supercopa' } : null,
    };
  }
  const phaseNames = { quarterFinals: 'Quartas de final', semiFinals: 'Semifinal', final: 'Final' };
  const phaseName = phaseNames[stage] || (stage === 'finished' ? 'Encerrada' : 'Mata-mata');
  if (stage === 'finished') return { value: 'ENCERRADA', detail: 'Edição finalizada' };
  const phase = data[stage] || {};
  let match = null;
  let series = 'Série A';
  for (const [key, label] of [['matches', 'Série A'], ['b', 'Série B'], ['c', 'Série C']]) {
    const found = Object.values(phase[key] || {}).find((entry) => [entry.homeTeam, entry.awayTeam, entry.player1Id, entry.player2Id].includes(uid));
    if (found) { match = found; series = label; break; }
  }
  const opponentId = match ? ([match.homeTeam || match.player1Id, match.awayTeam || match.player2Id].find((id) => id !== uid)) : null;
  return {
    value: phaseName.toUpperCase(),
    detail: match ? `${series} · contra ${users[opponentId]?.customTeamName || users[opponentId]?.name || 'adversário'}` : 'Acompanhe os cruzamentos da fase',
    important: match ? { icon: 'shield', color: '#8FE6FF', title: `CONFRONTO: ${phaseName.toUpperCase()}`, detail: `${series} · ${users[opponentId]?.customTeamName || users[opponentId]?.name || 'adversário'}.`, destination: 'Supercopa' } : null,
  };
}

function summarizeRestaUm(data, uid) {
  const eliminations = Object.values(data?.eliminations || {}).filter((entry) => entry?.eliminatedUserId);
  const hasParticipants = Array.isArray(data?.participants)
    ? data.participants.length > 0
    : Boolean(data?.participants && Object.keys(data.participants).length);
  const configured = Boolean(data && (data.status === 'active' || data.started === true || hasParticipants || eliminations.length));
  if (!configured) return { value: 'AGUARDANDO', detail: 'O administrador ainda não abriu a disputa', eliminated: false };
  if (data?.status === 'pending' && data.started !== true) return { value: 'AGUARDANDO', detail: 'O administrador ainda não iniciou a edição', eliminated: false };
  const participants = Array.isArray(data.participants) ? data.participants : data.participants ? Object.keys(data.participants) : null;
  const eliminatedSet = new Set(eliminations.map((entry) => entry.eliminatedUserId));
  const myElimination = eliminations.find((entry) => entry.eliminatedUserId === uid);
  const survivors = participants ? participants.filter((playerId) => !eliminatedSet.has(playerId)).length : null;
  if (myElimination) return { value: 'ELIMINADO', detail: `Saiu na rodada ${myElimination.roundNumber || '?'}`, eliminated: true, eliminationRound: myElimination.roundNumber, survivors };
  if (!participants) return { value: 'EM DISPUTA', detail: 'Acompanhe a situação da edição', eliminated: false };
  if (survivors <= 1 && participants.length > 0) return { value: 'CAMPEÃO', detail: 'Você é o último sobrevivente', eliminated: false, survivors };
  return { value: 'VIVO', detail: `${survivors} sobreviventes na disputa`, eliminated: false, survivors };
}

async function readValue(path) {
  try {
    const snapshot = await get(ref(database, path));
    return snapshot.exists() ? snapshot.val() : null;
  } catch {
    return null;
  }
}

const readProfileValue = (uid, field) => readValue(`users/${uid}/${field}`);

async function loadPlayerProfile(uid) {
  const fields = ['name', 'abbr', 'team', 'teamId', 'favoriteTeam', 'customTeamName', 'formulaDepreTeamId', 'useCustomShield', 'shieldConfig', 'avatarUrl', 'avatarConfig', 'onboardingComplete', 'isAdmin'];
  const values = await Promise.all(fields.map((field) => readProfileValue(uid, field)));
  const profile = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
  const formulaTeamsValue = await readValue('tournaments/formulaDepre/2027/teams');
  const teamId = profile.teamId || profile.team;
  let teamName = null;
  let teamImage = null;
  if (teamId) {
    [teamName, teamImage] = await Promise.all([
      readValue(`teams/${teamId}/name`),
      readValue(`teams/${teamId}/image`),
    ]);
  }
  const customShield = profile.useCustomShield && !profile.shieldConfig ? await readProfileValue(uid, 'customShield') : null;
  const formulaTeamList = Array.isArray(formulaTeamsValue)
    ? formulaTeamsValue.map((team) => [team.id, team.name])
    : formulaTeamsValue ? Object.entries(formulaTeamsValue).map(([id, team]) => [id, team?.name]) : formulaTeams;
  const formulaTeam = formulaTeamList.find(([id]) => id === profile.formulaDepreTeamId);
  return {
    ...profile,
    teamName: profile.favoriteTeam?.name || teamName,
    teamImage: profile.favoriteTeam?.logo || teamImage,
    shieldUrl: customShield || null,
    formulaTeamName: formulaTeam?.[1] || null,
  };
}

function getDeadline(round) {
  return round?.deadlineAt || round?.finishTimestamp || round?.deadline || null;
}

function readableSeasonStatus(status) {
  return ({ a_iniciar: 'A Iniciar', em_andamento: 'Em Andamento', concluida: 'Concluída' })[normalizeSeasonStatus(status)] || 'Não definida';
}

function normalizeSeasonStatus(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[ -]/g, '_');
  const aliases = { draft: 'a_iniciar', preparation: 'a_iniciar', prepared: 'a_iniciar', active: 'em_andamento', open: 'em_andamento', finished: 'concluida', complete: 'concluida', closed: 'concluida' };
  return aliases[normalized] || normalized;
}

function isRoundOpen(round) {
  return round?.status === 'open' || round?.status === 1 || round?.status === '1';
}

function isRoundFinished(round) {
  return round?.status === 'finished' || round?.status === 'complete' || round?.status === 2 || round?.status === '2';
}

function isRoundScheduled(round) {
  return round?.status === 'scheduled' || round?.status === 'pending' || round?.status === 0 || round?.status === '0';
}

function toManausTimestamp(value) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}-04:00`;
  const parsed = new Date(normalized).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRemoteImage(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

function asPlayerShield(value) {
  return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) ? value : null;
}

function RoundPanel({ round, summary, now, syncError, onPress }) {
  const latestRound = summary?.latestRound || summary?.lastRound;
  const roundIsOpen = isRoundOpen(round);
  const deadline = getDeadline(round);
  const deadlineAt = toManausTimestamp(deadline);
  const remaining = roundIsOpen && deadlineAt ? Math.max(0, deadlineAt - now) : 0;
  const isOpen = roundIsOpen && remaining > 0;
  const isStarted = round?.status === 'started' || (roundIsOpen && remaining === 0);
  const isFinished = isRoundFinished(round);
  const isScheduled = isRoundScheduled(round);
  const active = isOpen || isStarted;
  const hours = String(Math.floor(remaining / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  const hasRoundData = !!round;
  const status = isOpen ? 'PALPITES ABERTOS' : isStarted ? 'RODADA EM ANDAMENTO' : isFinished || latestRound ? 'ÚLTIMA RODADA ENCERRADA' : isScheduled ? 'PRÓXIMA RODADA' : syncError ? 'SEM ATUALIZAÇÃO' : 'SEM RODADA ATIVA';
  const title = active || isFinished || isScheduled
    ? (round.name || round.label || (isScheduled ? 'Próxima rodada' : 'Rodada atual'))
    : latestRound ? (latestRound.name || latestRound.label || 'Última rodada') : 'A temporada';
  const description = isOpen
    ? (remaining > 0 ? 'Seu prazo para palpitar' : 'O prazo desta rodada terminou.')
    : isStarted
      ? 'Os jogos já estão valendo. Acompanhe a rodada.'
      : isFinished && !latestRound
        ? 'Esta rodada foi finalizada. Consulte o histórico para ver o resultado.'
        : latestRound
        ? `Você fez ${latestRound.points ?? '—'} pts${latestRound.position ? ` · ${latestRound.position}º na rodada` : ''}. Veja como foi.`
        : isScheduled
          ? 'A rodada foi publicada. Os palpites abrem no horário definido.'
        : syncError
          ? 'Não foi possível sincronizar os dados agora.'
          : hasRoundData ? 'A próxima rodada ainda não foi iniciada.' : 'Nenhuma rodada disponível no momento.';
  const actionLabel = isOpen ? 'FAZER PALPITES' : isStarted ? 'ACOMPANHAR' : 'VER HISTÓRICO';
  return (
    <View style={[styles.roundPanel, isOpen && styles.roundPanelOpen, isStarted && styles.roundPanelLive]}>
      <View style={styles.roundTopline}>
        <Text style={styles.roundLabel}>{status}</Text>
        <AppIcon name={isOpen ? 'clock' : isStarted ? 'whistle' : 'history'} color={isStarted ? '#FFD469' : '#B9F375'} size={21} />
      </View>
      <Text numberOfLines={1} style={styles.roundTitle}>{title}</Text>
      {isOpen && remaining > 0 && <View style={styles.timerLine}><Text style={styles.timer}>{`${hours}:${minutes}:${seconds}`}</Text></View>}
      <Text numberOfLines={2} style={styles.roundDescription}>{description}</Text>
      <Pressable accessibilityRole="button" onPress={() => onPress(active ? 'Palpites' : 'Histórico')} style={({ pressed }) => [styles.roundAction, isStarted && styles.roundActionLive, pressed && styles.roundActionPressed]}>
        <Text style={styles.roundActionText}>{actionLabel}</Text>
        <AppIcon name="arrow" color="#0A2345" size={18} />
      </Pressable>
    </View>
  );
}

function TeamShield() {
  return <Svg width="38" height="42" viewBox="0 0 36 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Path d="M18 2 32 7v12c0 8-5.7 14.4-14 19C9.7 33.4 4 27 4 19V7l14-5Z" fill="#0C2B5B" stroke="#B7ED70" strokeWidth="2" />
    <Path d="m8 12 20 12M8 23l13 8M16 5l13 6" stroke="#A1EA5D" strokeWidth="4" />
    <Path d="m10 9 17 11" stroke="#F2CA47" strokeWidth="2" />
  </Svg>;
}

function TournamentTile({ tournament, onPress }) {
  const toneStyle = styles[`tile_${tournament.tone}`];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, tournament.featured && styles.tileFeatured, toneStyle, pressed && styles.tilePressed]}>
      <View style={styles.tileTop}>
        <View style={styles.tileMark}><AppIcon name={tournament.mark} color={tournament.tone === 'gold' ? '#F3CD5B' : '#C5ED82'} size={23} /></View>
        {tournament.featured && <Text style={styles.featuredTag}>TEMPORADA</Text>}
        {!tournament.featured && <AppIcon name="arrow" color="#BDD0E7" size={16} />}
      </View>
      <Text style={styles.tileName}>{tournament.name}</Text>
      <Text style={styles.tileStatus}>{tournament.detail}</Text>
      <View style={styles.tileRule} />
    </Pressable>
  );
}

function BottomNavigation({ onSelect, onHome, onProfile }) {
  const items = [
    { name: 'Início', icon: 'home', active: true },
    { name: 'Palpites', icon: 'ball' },
    { name: 'Torneios', icon: 'cup' },
    { name: 'Resenha', icon: 'news' },
    { name: 'Perfil', icon: 'person' },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected: !!item.active }} onPress={item.active ? onHome : item.name === 'Perfil' ? onProfile : () => onSelect(item.name)} style={({ pressed }) => [styles.navItem, item.active && styles.navItemActive, pressed && styles.pressed]}>
          <AppIcon name={item.icon} color={item.active ? '#A8EF65' : '#A7BBD5'} size={19} />
          <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AppIcon({ name, color = '#FFFFFF', size = 20 }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    bell: <><Path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" {...common} /><Path d="M10 21h4" {...common} /></>,
    arrow: <Path d="M4 12h15m-6-6 6 6-6 6" {...common} />,
    history: <><Path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" {...common} /><Path d="M3 3v5h5m4-1v5l3 2" {...common} /></>,
    trophy: <><Path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v4m-4 3h8m-7-3h6" {...common} /></>,
    cup: <><Path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v4m-4 3h8" {...common} /></>,
    shield: <Path d="m12 3 8 3v6c0 4.7-3 7.5-8 10-5-2.5-8-5.3-8-10V6l8-3Z" {...common} />,
    globe: <><Circle cx="12" cy="12" r="9" {...common} /><Path d="M3 12h18M12 3a14 14 0 0 1 0 18m0-18a14 14 0 0 0 0 18" {...common} /></>,
    star: <Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" {...common} />,
    chess: <><Path d="M8 20h8m-7-3h6l-1-5H9l-1 5Zm2-5-1-3 2-2 2 2-1 3m-4-7 2-2 2 2" {...common} /><Circle cx="12" cy="4" r="1" fill={color} /></>,
    belt: <><Path d="M5 8h14v8H5z" {...common} /><Path d="m12 9 2 2.5-2 2.5-2-2.5L12 9Z" {...common} /><Path d="M3 10v4m18-4v4" {...common} /></>,
    flag: <><Path d="M6 21V4m0 1h12l-2 4 2 4H6" {...common} /><Path d="M9 6v3m4-3v3m3-3v3m-7 1v3m4-3v3m3-3v3" stroke={color} strokeWidth="1.5" /></>,
    bracket: <><Path d="M5 5h5v5H5zm9 9h5v5h-5zM10 7h3a3 3 0 0 1 3 3v4" {...common} /><Path d="M14 5h5v5h-5zM5 14h5v5H5z" {...common} /></>,
    home: <><Path d="m3 10 9-7 9 7v10h-6v-6H9v6H3V10Z" {...common} /></>,
    ball: <><Circle cx="12" cy="12" r="9" {...common} /><Path d="m12 7 3 2-1 4h-4l-1-4 3-2Zm-3 6-3 2m8-2 3 2m-8-5H6m9 0h3m-6 3v5" {...common} /></>,
    news: <><Path d="M5 4h14v16H5zM2 7v12a1 1 0 0 0 1 1m5-12h8m-8 4h8m-8 4h5" {...common} /></>,
    person: <><Circle cx="12" cy="8" r="4" {...common} /><Path d="M4 21c.5-4.5 3.2-7 8-7s7.5 2.5 8 7" {...common} /></>,
    clock: <><Circle cx="12" cy="12" r="9" {...common} /><Path d="M12 7v5l3 2" {...common} /></>,
    whistle: <><Path d="m5 11 8-4 7 3v5l-8 3-7-3v-4Zm8-4V4h5v4" {...common} /><Circle cx="12" cy="13" r="2" {...common} /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{paths[name] || paths.ball}</Svg>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071735' },
  scroll: { flex: 1 },
  content: { paddingBottom: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 94, paddingHorizontal: 16, paddingBottom: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  seasonStatusBanner: { minHeight: 40, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: '#355A4B', backgroundColor: '#10352F' },
  seasonStatusText: { color: '#B6C8DA', fontSize: 8, letterSpacing: .55, fontWeight: '900' },
  seasonStatusValue: { flex: 1, textAlign: 'right', color: '#CFF3AD', fontSize: 10, fontWeight: '900' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  clubMark: { width: 46, height: 50, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  teamImage: { width: 46, height: 50 },
  playerCopy: { flex: 1, marginLeft: 8 },
  playerName: { color: '#F7FAFF', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  clubName: { color: '#B8F276', fontSize: 11, lineHeight: 15, letterSpacing: .6, fontWeight: '900' },
  supportingTeams: { color: '#CBDAEC', fontSize: 10, lineHeight: 14, marginTop: 2 },
  notificationButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C2D5C', borderWidth: 1, borderColor: '#3E6590', borderBottomWidth: 3, borderBottomColor: '#06152E', elevation: 4, shadowColor: '#000000', shadowOpacity: .25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  adminButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17433E', borderWidth: 1, borderColor: '#5C9168', borderBottomWidth: 3, borderBottomColor: '#0C292D', elevation: 4, shadowColor: '#000000', shadowOpacity: .25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  pressed: { opacity: .76 },
  focusRow: { marginHorizontal: 16, marginTop: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  avatarStage: { width: 124, height: 176, borderRadius: 15, backgroundColor: '#0C315D', borderWidth: 1, borderColor: '#2B5A86', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  avatarTurf: { position: 'absolute', bottom: 0, width: '100%', height: 31, backgroundColor: '#1B754F', borderTopWidth: 1, borderColor: '#6AAF76' },
  avatarHero: { position: 'absolute', width: 116, height: 155, bottom: 11 },
  avatarCaption: { color: '#F4FAFF', fontSize: 8, letterSpacing: .8, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#0A2042', overflow: 'hidden', marginBottom: 7 },
  roundPanel: { flex: 1, minWidth: 0, minHeight: 176, backgroundColor: '#0C2852', borderRadius: 15, margin: 0, padding: 12, borderWidth: 1, borderColor: '#31537D', borderBottomWidth: 4, borderBottomColor: '#07152D', elevation: 4, shadowColor: '#000000', shadowOpacity: .22, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  roundPanelOpen: { borderColor: '#6E9C55', backgroundColor: '#103451' },
  roundPanelLive: { borderColor: '#896B35', backgroundColor: '#282F48' },
  roundTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundLabel: { flex: 1, color: '#B8F276', fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: .65 },
  roundTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 19, fontWeight: '900', marginTop: 4 },
  roundDescription: { flex: 1, color: '#CFDCEC', fontSize: 10, lineHeight: 14, marginTop: 4 },
  timerLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: 5 },
  timer: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  roundAction: { minHeight: 38, marginTop: 8, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#A5EF65', borderWidth: 1, borderColor: '#C9F69A', borderBottomWidth: 3, borderBottomColor: '#57B63F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundActionLive: { backgroundColor: '#F4CE68', borderColor: '#FFE79B', borderBottomColor: '#B78C31' },
  roundActionPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  roundActionText: { color: '#0A2345', fontSize: 9, letterSpacing: .3, fontWeight: '900' },
  beltNotice: { minHeight: 68, marginHorizontal: 18, marginTop: 3, marginBottom: 20, borderRadius: 14, backgroundColor: '#26314A', borderWidth: 1, borderColor: '#8D7435', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  beltCopy: { flex: 1 },
  beltTitle: { color: '#F4D76F', fontSize: 11, letterSpacing: .7, fontWeight: '900' },
  beltSubtitle: { color: '#D0D9E5', fontSize: 11, marginTop: 4 },
  sectionHead: { marginTop: 9, marginHorizontal: 20, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F4F8FF', fontSize: 16, letterSpacing: .15, fontWeight: '900' },
  archiveActions: { flexDirection: 'row', gap: 7 },
  archiveButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, elevation: 3, shadowColor: '#000000', shadowOpacity: .2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  historyButton: { backgroundColor: '#153960', borderColor: '#4A7299', borderBottomWidth: 3, borderBottomColor: '#081A33' },
  trophyButton: { backgroundColor: '#44512C', borderColor: '#A4AF58', borderBottomWidth: 3, borderBottomColor: '#222D20' },
  archiveButtonPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  archiveLabel: { color: '#EFF6FF', fontSize: 9, letterSpacing: .35, fontWeight: '900' },
  campaignPanel: { marginHorizontal: 18, padding: 14, borderRadius: 16, backgroundColor: '#0B2144', borderWidth: 1, borderColor: '#203F69' },
  campaignIntro: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 9 },
  campaignLead: { color: '#DCE8F5', fontSize: 12, fontWeight: '700' },
  campaignHint: { color: '#8FA8C7', fontSize: 10, marginTop: 3 },
  campaignRow: { minHeight: 51, borderTopWidth: 1, borderTopColor: 'rgba(184,210,239,.13)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  campaignLastRow: { borderBottomWidth: 0 },
  campaignNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  campaignTick: { width: 4, height: 28, borderRadius: 2, backgroundColor: '#47617F' },
  campaignTickActive: { backgroundColor: '#9EEB62' },
  campaignName: { color: '#F1F6FD', fontSize: 12, fontWeight: '800' },
  campaignDetail: { color: '#91A9C7', fontSize: 10, marginTop: 2 },
  campaignValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  campaignStatusValue: { maxWidth: 104, color: '#C8E6A2', fontSize: 9, letterSpacing: .25, textAlign: 'right' },
  campaignCupValue: { color: '#8FE6FF' },
  campaignEliminatedValue: { color: '#FF817A' },
  tournamentHead: { marginTop: 24 },
  sectionAside: { color: '#8FA9C8', fontSize: 9, letterSpacing: .75, fontWeight: '800' },
  tournamentGrid: { marginHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.6%', minHeight: 112, padding: 12, borderRadius: 14, overflow: 'hidden', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(216,234,255,.18)' },
  tileFeatured: { width: '100%', minHeight: 125, padding: 15 },
  tile_green: { backgroundColor: '#0D453F' },
  tile_blue: { backgroundColor: '#0D2D5D' },
  tile_gold: { backgroundColor: '#3B3442' },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileMark: { width: 38, height: 36, borderRadius: 10, backgroundColor: 'rgba(4,17,39,.42)', alignItems: 'center', justifyContent: 'center' },
  featuredTag: { color: '#D9F6B4', fontSize: 9, letterSpacing: 1, fontWeight: '900' },
  tileName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 7 },
  tileStatus: { color: '#C5D3E5', fontSize: 10, lineHeight: 14, marginTop: 3 },
  tileRule: { position: 'absolute', right: -18, bottom: -29, width: 98, height: 52, borderTopWidth: 2, borderColor: 'rgba(180,236,107,.62)', transform: [{ rotate: '-18deg' }] },
  tilePressed: { transform: [{ scale: .985 }] },
  bottomNav: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#091B39', borderTopWidth: 1, borderTopColor: '#203A60', paddingHorizontal: 7, paddingTop: 5 },
  navItem: { flex: 1, minHeight: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navItemActive: { backgroundColor: '#102C54' },
  navLabel: { color: '#A7BBD5', fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: '#B9F276', fontWeight: '900' },
});
