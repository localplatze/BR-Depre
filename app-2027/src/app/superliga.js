import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { makeTeamInitials, PlayerCrest } from '../components/IdentityArt';
import { auth, onAuthStateChanged } from '../services/firebaseAuth';
import { database, get, onValue, ref } from '../services/firebaseDatabase';

const STADIUM = require('../../assets/brand/stadium-night.jpg');
const SEASON = '2027';
const EMPTY_OBJECT = Object.freeze({});
const TABS = [
  ['regular', 'GERAL', 'table-large'],
  ['top8', 'LIGA TOP 8', 'trophy-outline'],
  ['secondary', 'CHAVE X-SALADA', 'tournament'],
];

export default function SuperligaScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState('regular');
  const [seasonData, setSeasonData] = useState(null);
  const [seasonStatus, setSeasonStatus] = useState(null);
  const [seasonMembers, setSeasonMembers] = useState({});
  const [users, setUsers] = useState({});
  const [teams, setTeams] = useState({});
  const [playerUid, setPlayerUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const uid = playerUid;

  useEffect(() => {
    let alive = true;
    let stops = [];
    const stopAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/entrar');
        return;
      }
      setPlayerUid(user.uid);
      stops.forEach((stop) => stop());
      stops = [];
      setLoading(true);
      setError(false);
      stops.push(onValue(ref(database, `tournaments/superliga/${SEASON}`), (snapshot) => {
        if (alive) { setSeasonData(snapshot.val() || null); setLoading(false); }
      }, () => { if (alive) { setError(true); setLoading(false); } }));
      stops.push(onValue(ref(database, `seasons/${SEASON}/status`), (snapshot) => {
        if (alive) setSeasonStatus(snapshot.val());
      }, () => {}));
      stops.push(onValue(ref(database, `seasons/${SEASON}/members`), (snapshot) => {
        if (alive) setSeasonMembers(snapshot.val() || {});
      }, () => { if (alive) setError(true); }));
    });
    return () => {
      alive = false;
      stopAuth();
      stops.forEach((stop) => stop());
    };
  }, [router]);

  const displayData = seasonData;
  const regular = displayData?.regular || EMPTY_OBJECT;
  const top8 = displayData?.top8 || EMPTY_OBJECT;
  const secondary = displayData?.secondary || EMPTY_OBJECT;
  const eligibleIds = useMemo(() => new Set(Object.entries(seasonMembers).filter(([, member]) => member?.eligible === true).map(([id]) => id)), [seasonMembers]);
  const rosterIds = useMemo(() => [...new Set([
    uid,
    ...participantIds(regular.participants),
    ...participantIds(regular.standings || regular.table),
    ...participantIds(top8.participants),
    ...participantIds(top8.standings || top8.table),
    ...participantIds(secondary.participants),
    ...participantIds(secondary.standings || secondary.table),
  ].filter((id) => id && eligibleIds.has(id)))].sort(), [uid, regular, top8, secondary, eligibleIds]);
  const teamIds = useMemo(() => [...new Set(Object.values(users).map((user) => user?.teamId || user?.team).filter(Boolean))].sort(), [users]);
  const regularRows = useMemo(() => standingsRows(regular.standings || regular.table, users, eligibleIds, undefined, teams), [regular, users, teams, eligibleIds]);
  const top8Ids = useMemo(() => participantIds(top8.participants), [top8.participants]);
  const eligibleTop8Ids = useMemo(() => top8Ids.filter((id) => eligibleIds.has(id)), [top8Ids, eligibleIds]);
  const top8Rows = useMemo(() => standingsRows(top8.standings || top8.table, users, eligibleTop8Ids, top8.startingBonus || top8.startingBonusByUid, teams), [top8, users, eligibleTop8Ids, teams]);
  const cutoff = Number(regular.cutoffBrasileiraoRound || displayData?.config?.cutoffBrasileiraoRound || 30);
  const currentBrazilRound = Number(regular.currentBrasileiraoRound || regular.brasileiraoRoundNumber || regular.brasileiraoRound || 0);
  const myRegularPosition = regularRows.findIndex((row) => row.uid === uid) + 1;
  const top8Gap = myRegularPosition > 8 && regularRows[7]
    ? Math.max(0, regularRows[7].points - regularRows[myRegularPosition - 1].points + 1)
    : 0;
  const phaseStatuses = [regular.status, top8.status, secondary.status];
  const showSeasonSetup = !displayData || phaseStatuses.every((status) => !status);
  const regularClosed = isPhaseFinished(regular.status);
  const cutoffProgress = regularClosed ? 100 : Math.min(100, Math.max(0, (currentBrazilRound / cutoff) * 100));

  useEffect(() => {
    let alive = true;
    if (!rosterIds.length) return () => { alive = false; };
    const fields = ['name', 'customTeamName', 'teamId', 'team', 'useCustomShield', 'shieldConfig', 'customShield', 'favoriteTeam', 'teamImage'];
    Promise.all(rosterIds.map(async (id) => {
      const values = await Promise.all(fields.map(async (field) => {
        const snapshot = await get(ref(database, `users/${id}/${field}`));
        return snapshot.val();
      }));
      return [id, Object.fromEntries(fields.map((field, index) => [field, values[index]]))];
    })).then((entries) => { if (alive) setUsers(Object.fromEntries(entries)); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [rosterIds]);

  useEffect(() => {
    let alive = true;
    if (!teamIds.length) return () => { alive = false; };
    Promise.all(teamIds.map(async (id) => {
      const snapshot = await get(ref(database, `teams/${id}`));
      return [id, snapshot.val() || {}];
    })).then((entries) => { if (alive) setTeams(Object.fromEntries(entries)); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [teamIds]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.masthead}>
          <ImageBackground source={STADIUM} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(5,18,43,.35)', 'rgba(5,18,43,.96)']} style={StyleSheet.absoluteFill} />
          <View style={styles.navbar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backButton}>
              <MaterialDesignIcons name="arrow-left" size={20} color="#E6F1FF" />
            </Pressable>
          <View style={styles.seasonStamp}><Text style={styles.seasonStampText}>TEMPORADA {SEASON} · {readableSeasonStatus(seasonStatus).toUpperCase()}</Text></View>
            <View style={styles.ballMark}><MaterialDesignIcons name="soccer" size={19} color="#B9F276" /></View>
          </View>
          <Text style={styles.kicker}>O CAMPEONATO DA TURMA</Text>
          <Text accessibilityRole="header" style={styles.title}>SUPERLIGA</Text>
          <Text style={styles.subtitle}>Todos disputam a fase geral até a {cutoff}ª rodada. Depois, o Top 8 segue em pontos corridos e os demais entram numa chave eliminatória independente.</Text>
          <View style={styles.cutoffCard}>
            <View style={styles.cutoffTopline}>
              <Text style={styles.cutoffLabel}>O CORTE</Text>
              <Text style={styles.cutoffRound}>{currentBrazilRound > 0 ? `${currentBrazilRound} / ${cutoff}` : `ATÉ A ${cutoff}ª`}</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${cutoffProgress}%` }]} /></View>
            <Text style={styles.cutoffCopy}>{regularClosed
              ? `Corte fechado na rodada ${cutoff} do Brasileirão`
              : currentBrazilRound > 0 ? `Rodada ${currentBrazilRound} do Brasileirão · o número de rodadas do bolão pode variar` : `O admin controla as fases; o corte usa a 30ª rodada do Brasileirão`}</Text>
          </View>
        </View>

        {error && <View style={styles.errorBanner}><MaterialDesignIcons name="cloud-alert-outline" size={18} color="#FFB5A9" /><Text style={styles.errorText}>Não consegui atualizar a classificação. Confira sua conexão.</Text></View>}
        {showSeasonSetup && !loading && <View style={styles.setupBanner}>
          <MaterialDesignIcons name="clipboard-text-clock-outline" size={19} color="#FFD66B" />
          <Text style={styles.setupText}>A temporada ainda não foi configurada pelo administrador. As fases e a classificação aparecerão aqui quando forem publicadas.</Text>
        </View>}
        <View style={styles.personalCard}>
          <View style={styles.personalIcon}><MaterialDesignIcons name="account-star-outline" size={22} color="#B9F276" /></View>
          <View style={styles.personalCopy}>
            <Text style={styles.personalEyebrow}>SUA CAMPANHA</Text>
            <Text style={styles.personalTitle}>{myRegularPosition > 0 ? `${myRegularPosition}º na classificação` : 'A temporada está para começar'}</Text>
            <Text style={styles.personalDetail}>{myRegularPosition > 8 && top8Gap > 0 ? `Faltam ${top8Gap} pts para entrar no Top 8` : myRegularPosition > 0 && myRegularPosition <= 8 ? 'Você está na zona de classificação para o Top 8' : 'Sua posição aparece quando houver pontuação publicada'}</Text>
          </View>
          {myRegularPosition > 0 && <Text style={styles.personalPoints}>{regularRows[myRegularPosition - 1].points}<Text style={styles.pointsUnit}> pts</Text></Text>}
        </View>

        <View style={styles.phaseHeader}>
          <Text style={styles.sectionTitle}>A DISPUTA</Text>
          <Text style={styles.sectionNote}>FASES DEFINIDAS PELO ADMIN</Text>
        </View>
        <View style={styles.phaseTabs}>
          {TABS.map(([key, label, icon]) => {
            const selected = phase === key;
            const status = phaseStatus(key, regular, top8, secondary);
            return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setPhase(key)} style={[styles.phaseTab, selected && styles.phaseTabSelected]}>
              <MaterialDesignIcons name={icon} size={17} color={selected ? '#071B38' : '#91A9C7'} />
              <Text numberOfLines={1} style={[styles.phaseTabLabel, selected && styles.phaseTabLabelSelected]}>{label}</Text>
              <Text style={[styles.phaseTabStatus, selected && styles.phaseTabStatusSelected]}>{status}</Text>
            </Pressable>;
          })}
        </View>

        {loading ? <View style={styles.loading}><ActivityIndicator color="#A6F16A" size="large" /><Text style={styles.loadingText}>Buscando a classificação…</Text></View> : (
          phase === 'regular'
            ? <RegularSeasonPanel data={regular} rows={regularRows} uid={uid} cutoff={cutoff} configured={!showSeasonSetup} teams={teams} />
            : phase === 'top8'
            ? <Top8Panel data={top8} rows={top8Rows} uid={uid} teams={teams} />
              : <SecondaryPanel data={secondary} teams={teams} users={users} eligibleIds={eligibleIds} />
        )}

        <View style={styles.rulesStrip}>
          <MaterialDesignIcons name="scale-balance" size={18} color="#91A9C7" />
          <Text style={styles.rulesCopy}>Empate: pontos totais, pontos na última rodada concluída e melhor posição na rodada anterior.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RegularSeasonPanel({ data, rows, uid, cutoff, configured, teams }) {
  const status = phaseStatus('regular', data, {}, {});
  const closed = isPhaseFinished(data.status);
  return <View style={styles.panel}>
    <View style={styles.panelHeading}>
      <View><Text style={styles.panelTitle}>Classificação geral</Text><Text style={styles.panelSub}>Brasileirão · corte na {cutoff}ª rodada</Text></View>
      <StatusPill label={status} active={isPhaseActive(data.status)} />
    </View>
    {!configured || !rows.length ? <EmptyPhase title="A tabela ainda não entrou em campo" detail="Quando o administrador publicar os pontos da temporada, a classificação completa vai aparecer aqui." icon="table-large" /> : <>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.legendMark, styles.legendTop8]} /><Text style={styles.legendText}>Top 8</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendMark, styles.legendCut]} /><Text style={styles.legendText}>Corte</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendMark, styles.legendDrop]} /><Text style={styles.legendText}>Últimos 4</Text></View>
      </View>
      <View style={styles.tableHeader}><Text style={styles.colPosition}>POS</Text><Text style={styles.colTeam}>TIME</Text><Text style={styles.colRound}>ÚLT.</Text><Text style={styles.colPoints}>PTS</Text></View>
      {rows.map((row, index) => {
        const position = index + 1;
        const isTop8 = position <= 8;
        const isBottomFour = position > rows.length - 4;
        const isLantern = position === rows.length && closed;
        return <View key={row.uid}>
          {position === 9 && rows.length > 8 && <View style={styles.cutDivider}><View style={styles.cutDividerLine} /><Text style={styles.cutDividerLabel}>LINHA DO CORTE · TOP 8</Text><View style={styles.cutDividerLine} /></View>}
          <View style={[styles.tableRow, row.uid === uid && styles.ownRow, isTop8 && styles.top8Row, isBottomFour && styles.bottomFourRow]}>
            <View style={[styles.positionRail, isTop8 && styles.positionRailTop8, isBottomFour && styles.positionRailDrop]} />
            <Text style={[styles.positionText, isLantern && styles.lanternText]}>{String(position).padStart(2, '0')}</Text>
            <View style={styles.teamCell}>
              <TeamBadge user={row.player} teams={teams} displayName={row.name} />
              <Text numberOfLines={1} style={[styles.teamName, row.uid === uid && styles.ownTeamName]}>{row.name}</Text>
              {isBottomFour && closed && <Text style={styles.relegatedTag}>REBAIXADO</Text>}
              {row.uid === uid && <Text style={styles.youTag}>VOCÊ</Text>}
            </View>
            <Text style={styles.roundPoints}>{row.roundPoints > 0 ? '+' : ''}{row.roundPoints}</Text>
            <Text style={styles.pointsText}>{row.points}</Text>
          </View>
        </View>;
      })}
      <View style={styles.tableFooter}><Text style={styles.tableFooterCopy}>{closed ? `Classificação congelada após o corte da ${cutoff}ª rodada` : `Zona de risco provisória: os quatro últimos ao fechar o corte recebem o registro de rebaixamento`}</Text></View>
    </>}
  </View>;
}

function Top8Panel({ data, rows, uid, teams }) {
  const active = isPhaseActive(data.status);
  const unlocked = isPhaseUnlocked(data.status);
  const bonuses = data.startingBonusByPosition || { 1: 6, 2: 4, 3: 2, 4: 1 };
  const bonusCopy = [1, 2, 3, 4].map((position) => `${position}º +${Number(bonuses[position] || 0)}`).join(' · ');
  return <View style={[styles.panel, styles.topPanel]}>
    <View style={styles.panelHeading}>
      <View><Text style={styles.panelTitle}>Liga do Top 8</Text><Text style={styles.panelSub}>Pontos corridos até a última rodada</Text></View>
      <StatusPill label={phaseStatus('top8', {}, data, {})} active={active} />
    </View>
    {!unlocked ? <EmptyPhase title="Oito vagas. Uma liga só deles." detail="A classificação será definida quando o admin encerrar a fase regular na 30ª rodada do Brasileirão." icon="trophy-outline" /> : <>
      <View style={styles.bonusCard}><MaterialDesignIcons name="rocket-launch-outline" size={21} color="#B9F276" /><View style={styles.bonusCopy}><Text style={styles.bonusTitle}>BÔNUS DE LARGADA</Text><Text style={styles.bonusDetail}>{bonusCopy} pontos</Text></View></View>
      {rows.length ? <StandingsList rows={rows} uid={uid} teams={teams} /> : <EmptyPhase title="A tabela final será publicada pelo admin" detail="Os bônus de largada já estão somados aos pontos da classificação." icon="table-large" />}
    </>}
  </View>;
}

function SecondaryPanel({ data, teams, users, eligibleIds }) {
  const active = isPhaseActive(data.status);
  const unlocked = isPhaseUnlocked(data.status);
  const rounds = getBracketRounds(data).map(([name, matches]) => [name, matches.filter((match) => {
    const ids = bracketParticipantIds(match);
    return ids.length === 2 && ids.every((id) => eligibleIds.has(id));
  })]).filter(([, matches]) => matches.length);
  return <View style={[styles.panel, styles.secondaryPanel]}>
    <View style={styles.panelHeading}>
      <View><Text style={styles.panelTitle}>Chave do X-Salada</Text><Text style={styles.panelSub}>Mata-mata independente · prêmio simbólico</Text></View>
      <StatusPill label={phaseStatus('secondary', {}, {}, data)} active={active} />
    </View>
    {!unlocked ? <EmptyPhase title="A chave será definida após o corte" detail="Os classificados fora do Top 8 entram em confrontos eliminatórios. O administrador define participantes, pareamentos, byes e calendário antes da fase." icon="tournament" /> : rounds.length ? rounds.map(([name, matches]) => <BracketRound key={name} name={name} matches={matches} users={users} teams={teams} />) : <EmptyPhase title="Os confrontos ainda não foram publicados" detail="A chave da temporada aparecerá aqui depois que o administrador confirmar os cruzamentos." icon="tournament" />}
  </View>;
}

function BracketRound({ name, matches, users, teams }) {
  return <View style={styles.bracketStage}>
    <Text style={styles.bracketStageTitle}>{name}</Text>
    {matches.map((match, index) => {
      const firstId = match?.player1Id || match?.homeTeamId || match?.homeTeam || match?.team1Id || match?.participant1;
      const secondId = match?.player2Id || match?.awayTeamId || match?.awayTeam || match?.team2Id || match?.participant2;
      const firstName = bracketParticipantName(firstId, users, teams);
      const secondName = bracketParticipantName(secondId, users, teams);
      const firstScore = match?.player1Score ?? match?.homeScore ?? match?.team1Score;
      const secondScore = match?.player2Score ?? match?.awayScore ?? match?.team2Score;
      const score = firstScore === undefined && secondScore === undefined ? '×' : `${firstScore ?? '—'} × ${secondScore ?? '—'}`;
      return <View key={match?.id || match?.matchId || index} style={styles.matchLine}>
        <Text numberOfLines={1} style={styles.matchName}>{firstName}</Text>
        <Text style={styles.matchScore}>{score}</Text>
        <Text numberOfLines={1} style={[styles.matchName, styles.matchNameRight]}>{secondName}</Text>
      </View>;
    })}
  </View>;
}

function bracketParticipantIds(match) {
  return [
    match?.player1Id || match?.homeTeamId || match?.homeTeam || match?.team1Id || match?.participant1,
    match?.player2Id || match?.awayTeamId || match?.awayTeam || match?.team2Id || match?.participant2,
  ].filter((id) => typeof id === 'string');
}

function bracketParticipantName(value, users, teams) {
  if (!value) return 'A definir';
  if (typeof value === 'object') return value.name || value.teamName || value.customTeamName || 'A definir';
  const user = users[value];
  const team = teams[user?.teamId || user?.team] || {};
  return user?.customTeamName || user?.name || team.name || value;
}

function getBracketRounds(data) {
  const source = data.bracket || data.fixtures || data.rounds;
  if (Array.isArray(source)) {
    return source.map((round, index) => [round?.name || round?.label || `Fase ${index + 1}`, Array.isArray(round?.matches) ? round.matches : Object.values(round?.matches || {})]).filter(([, matches]) => matches.length);
  }
  if (!source || typeof source !== 'object') return [];
  return Object.entries(source).map(([key, round], index) => [round?.name || round?.label || formatBracketRoundName(key, index), Array.isArray(round) ? round : Array.isArray(round?.matches) ? round.matches : Object.values(round?.matches || {})]).filter(([, matches]) => matches.length);
}

function formatBracketRoundName(key, index) {
  const labels = { roundOf16: 'Oitavas de final', quarterFinals: 'Quartas de final', semiFinals: 'Semifinal', final: 'Final', thirdPlace: 'Disputa de 3º lugar' };
  return labels[key] || `Fase ${index + 1}`;
}

function StandingsList({ rows, uid, teams }) {
  return <View style={styles.miniTable}>
    <View style={styles.miniHeader}><Text style={styles.miniPos}>#</Text><Text style={styles.miniTeam}>TIME</Text><Text style={styles.miniRound}>ÚLT.</Text><Text style={styles.miniPts}>PTS</Text></View>
    {rows.map((row, index) => <View key={row.uid} style={[styles.miniRow, row.uid === uid && styles.ownRow]}>
      <Text style={styles.miniPos}>{String(index + 1).padStart(2, '0')}</Text><TeamBadge user={row.player} teams={teams} displayName={row.name} /><Text numberOfLines={1} style={[styles.miniTeamName, row.uid === uid && styles.ownTeamName]}>{row.name}</Text><Text style={styles.miniRound}>{row.roundPoints > 0 ? '+' : ''}{row.roundPoints}</Text><Text style={styles.miniPtsValue}>{row.points}</Text>
    </View>)}
  </View>;
}

function TeamBadge({ user = {}, teams = {}, displayName, size = 27 }) {
  const team = teams[user.teamId || user.team] || {};
  if (user.useCustomShield && user.shieldConfig) {
    return <View style={[styles.teamBadge, { width: size, height: size }]}>
      <PlayerCrest config={user.shieldConfig} initials={makeTeamInitials(user.customTeamName || displayName || user.name)} size={size - 2} />
    </View>;
  }
  const legacyShield = user.useCustomShield && typeof user.customShield === 'string' ? user.customShield : null;
  const image = legacyShield || team.image || user.favoriteTeam?.logo || user.teamImage || null;
  return <View style={[styles.teamBadge, { width: size, height: size }]}>
    {image ? <Image source={{ uri: image }} resizeMode="contain" style={styles.teamBadgeImage} />
      : <MaterialDesignIcons name="shield-outline" size={Math.round(size * .62)} color="#AFC5DD" />}
  </View>;
}

function EmptyPhase({ title, detail, icon }) {
  return <View style={styles.emptyPhase}><MaterialDesignIcons name={icon} size={29} color="#718BAA" /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

function StatusPill({ label, active }) {
  return <View style={[styles.statusPill, active && styles.statusPillActive]}><View style={[styles.statusDot, active && styles.statusDotActive]} /><Text style={[styles.statusText, active && styles.statusTextActive]}>{label}</Text></View>;
}

function standingsRows(raw, users, participantFilter, bonuses = {}, teams = {}) {
  if (!raw) return [];
  const entries = Array.isArray(raw)
    ? raw.map((entry, index) => [entry?.playerId || entry?.uid || entry?.userId || String(index), entry])
    : Object.entries(raw);
  const filter = participantFilter instanceof Set ? participantFilter : Array.isArray(participantFilter) ? new Set(participantFilter) : null;
  return entries.map(([uid, entry]) => {
    const playerId = entry?.playerId || entry?.uid || entry?.userId || uid;
    const user = users[playerId] || {};
    const oldTeam = teams[user.teamId || user.team] || {};
    const initialBonus = Number(bonuses[playerId] ?? entry?.startingBonus ?? entry?.bonus ?? 0) || 0;
    const earned = Number(entry?.earnedPoints ?? entry?.pointsEarned ?? entry?.points ?? entry?.totalPoints ?? entry?.pts ?? 0) || 0;
    const includesBonus = entry?.bonusIncluded === true || entry?.pointsIncludeBonus === true;
    const points = includesBonus ? earned : earned + initialBonus;
    return {
      uid: playerId,
      name: entry?.name || user.customTeamName?.trim?.() || user.name || oldTeam.name || user.favoriteTeam?.name || `Jogador ${playerId.slice?.(0, 5) || ''}`,
      points,
      roundPoints: Number(entry?.lastRoundPoints ?? entry?.roundPoints ?? 0) || 0,
      bonus: initialBonus,
      previousPosition: Number(entry?.previousPosition) || 999,
      savedPosition: Number(entry?.position) || 999,
      player: user,
    };
  }).filter((entry) => !filter || filter.has(entry.uid))
    .sort((a, b) => b.points - a.points || b.roundPoints - a.roundPoints || a.previousPosition - b.previousPosition);
}

function participantIds(value) {
  if (Array.isArray(value)) return value.map((entry) => typeof entry === 'string' ? entry : entry?.uid || entry?.playerId).filter(Boolean);
  if (value && typeof value === 'object') return Object.entries(value).filter(([, member]) => member !== false && member !== null).map(([uid]) => uid);
  return [];
}

function phaseStatus(key, regular, top8, secondary) {
  const rawStatus = ({ regular, top8, secondary })[key]?.status;
  const status = rawStatus === 1 || rawStatus === true ? 'active' : rawStatus === 2 ? 'complete' : String(rawStatus || '').toLowerCase();
  return ({ active: 'EM ANDAMENTO', ready: 'PRONTA', complete: 'ENCERRADA', finished: 'ENCERRADA', locked: 'AGUARDANDO', pending: 'AGUARDANDO' })[status] || 'AGUARDANDO';
}

function isPhaseFinished(status) {
  return status === 2 || ['complete', 'finished', 'closed'].includes(String(status || '').toLowerCase());
}

function isPhaseActive(status) {
  return status === 1 || status === true || String(status || '').toLowerCase() === 'active';
}

function isPhaseUnlocked(status) {
  return status === 1 || status === 2 || status === true || ['ready', 'active', 'complete', 'finished', 'closed'].includes(String(status || '').toLowerCase());
}

function readableSeasonStatus(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[ -]/g, '_');
  const aliases = { draft: 'a_iniciar', preparation: 'a_iniciar', prepared: 'a_iniciar', active: 'em_andamento', open: 'em_andamento', finished: 'concluida', complete: 'concluida', closed: 'concluida' };
  return ({ a_iniciar: 'A Iniciar', em_andamento: 'Em Andamento', concluida: 'Concluída' })[aliases[normalized] || normalized] || 'Não definida';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#071735' },
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  masthead: { minHeight: 326, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 17, justifyContent: 'flex-end', overflow: 'hidden' },
  navbar: { position: 'absolute', top: 7, left: 16, right: 16, zIndex: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(8,29,57,.88)', borderWidth: 1, borderColor: '#45668D', alignItems: 'center', justifyContent: 'center' },
  seasonStamp: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(185,242,118,.54)', backgroundColor: 'rgba(10,45,58,.8)' },
  seasonStampText: { color: '#D5F9AA', fontSize: 8, fontWeight: '900', letterSpacing: .65 },
  ballMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(8,29,57,.88)', borderWidth: 1, borderColor: '#45668D' },
  kicker: { marginBottom: 1, color: '#B9F276', fontSize: 9, letterSpacing: 1.7, fontWeight: '900' },
  title: { color: '#F6F8FC', fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1.7 },
  subtitle: { maxWidth: 330, color: '#D5E0ED', fontSize: 12, lineHeight: 17, marginTop: 2 },
  cutoffCard: { marginTop: 14, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(166,241,106,.36)', backgroundColor: 'rgba(8,29,51,.88)' },
  cutoffTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  cutoffLabel: { color: '#D9E8F8', fontSize: 9, letterSpacing: 1.2, fontWeight: '900' },
  cutoffRound: { color: '#C8F99A', fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 5, overflow: 'hidden', backgroundColor: '#223955' },
  progressFill: { height: 7, borderRadius: 5, backgroundColor: '#A6F16A' },
  cutoffCopy: { color: '#AFC3DB', fontSize: 9, lineHeight: 13, marginTop: 7 },
  errorBanner: { marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: '#3B202C' },
  errorText: { flex: 1, color: '#FFD9D1', fontSize: 11, lineHeight: 16 },
  setupBanner: { marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#66562E', backgroundColor: '#302B27' },
  setupText: { flex: 1, color: '#E9DFC5', fontSize: 11, lineHeight: 16 },
  personalCard: { marginHorizontal: 16, marginTop: 13, minHeight: 78, padding: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#0F2B4D', borderWidth: 1, borderColor: '#315578' },
  personalIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#174B4C', alignItems: 'center', justifyContent: 'center' },
  personalCopy: { flex: 1 },
  personalEyebrow: { color: '#A6F16A', fontSize: 8, letterSpacing: 1.05, fontWeight: '900' },
  personalTitle: { color: '#F1F6FC', fontSize: 14, fontWeight: '900', marginTop: 3 },
  personalDetail: { color: '#AFC3D8', fontSize: 10, lineHeight: 14, marginTop: 2 },
  personalPoints: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pointsUnit: { color: '#A9BED4', fontSize: 9 },
  phaseHeader: { marginTop: 20, marginHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F2F6FC', fontSize: 16, fontWeight: '900', letterSpacing: .4 },
  sectionNote: { color: '#809BB9', fontSize: 8, fontWeight: '800', letterSpacing: .6 },
  phaseTabs: { marginHorizontal: 16, marginTop: 10, flexDirection: 'row', gap: 7 },
  phaseTab: { flex: 1, minHeight: 70, padding: 8, borderRadius: 12, backgroundColor: '#0B2141', borderWidth: 1, borderColor: '#28476A', alignItems: 'center', justifyContent: 'center', gap: 4 },
  phaseTabSelected: { backgroundColor: '#B9F276', borderColor: '#D6FFA9' },
  phaseTabLabel: { color: '#CBD8E7', fontSize: 8, letterSpacing: .3, fontWeight: '900', textAlign: 'center' },
  phaseTabLabelSelected: { color: '#071B38' },
  phaseTabStatus: { color: '#829AB6', fontSize: 7, fontWeight: '800', textAlign: 'center' },
  phaseTabStatusSelected: { color: '#244723' },
  panel: { marginHorizontal: 16, marginTop: 11, padding: 13, borderRadius: 16, backgroundColor: '#0B2141', borderWidth: 1, borderColor: '#28476A' },
  topPanel: { borderColor: '#41644D' },
  secondaryPanel: { borderColor: '#675B3B' },
  panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  panelTitle: { color: '#F0F5FC', fontSize: 15, fontWeight: '900' },
  panelSub: { color: '#9FB4CA', fontSize: 10, marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1C304C' },
  statusPillActive: { backgroundColor: '#19453F' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8AA0BA' },
  statusDotActive: { backgroundColor: '#A6F16A' },
  statusText: { color: '#B3C2D3', fontSize: 7, fontWeight: '900', letterSpacing: .4 },
  statusTextActive: { color: '#C9F5A3' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendMark: { width: 9, height: 9, borderRadius: 3 },
  legendTop8: { backgroundColor: '#A6F16A', borderRadius: 2 },
  legendCut: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#56D6D1' },
  legendDrop: { backgroundColor: '#FF827A', borderRadius: 2 },
  legendText: { color: '#AFC1D4', fontSize: 9 },
  tableHeader: { minHeight: 29, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#294563' },
  colPosition: { width: 35, color: '#7993AF', fontSize: 8, fontWeight: '900' },
  colTeam: { flex: 1, color: '#7993AF', fontSize: 8, fontWeight: '900' },
  colRound: { width: 37, color: '#7993AF', fontSize: 8, fontWeight: '900', textAlign: 'right' },
  colPoints: { width: 43, color: '#C1D1E1', fontSize: 8, fontWeight: '900', textAlign: 'right' },
  tableRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.11)', paddingRight: 2 },
  cutDivider: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 7 },
  cutDividerLine: { flex: 1, height: 2, backgroundColor: '#56D6D1' },
  cutDividerLabel: { color: '#78E4DF', fontSize: 7, fontWeight: '900', letterSpacing: .75 },
  ownRow: { backgroundColor: 'rgba(166,241,106,.08)' },
  top8Row: { backgroundColor: 'rgba(166,241,106,.085)' },
  bottomFourRow: { backgroundColor: 'rgba(255,106,106,.045)' },
  positionRail: { position: 'absolute', left: -13, width: 3, height: 23, backgroundColor: 'transparent' },
  positionRailTop8: { width: 4, backgroundColor: '#A6F16A' },
  positionRailDrop: { backgroundColor: '#F16A70' },
  positionText: { width: 35, color: '#9CB2C8', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lanternText: { color: '#FF8A80' },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamBadge: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 9, backgroundColor: '#123254', borderWidth: 1, borderColor: '#365B80' },
  teamBadgeImage: { width: '88%', height: '88%' },
  teamName: { flexShrink: 1, color: '#E0E9F3', fontSize: 11, fontWeight: '700' },
  ownTeamName: { color: '#C8F99A', fontWeight: '900' },
  youTag: { color: '#09213D', backgroundColor: '#B9F276', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, fontSize: 6, fontWeight: '900' },
  relegatedTag: { color: '#FFD2CF', backgroundColor: '#772E37', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, fontSize: 6, fontWeight: '900' },
  roundPoints: { width: 37, color: '#9DB1C7', textAlign: 'right', fontSize: 10, fontVariant: ['tabular-nums'] },
  pointsText: { width: 43, color: '#F5F8FC', textAlign: 'right', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  tableFooter: { paddingTop: 9 },
  tableFooterCopy: { color: '#8198B2', fontSize: 9, lineHeight: 14 },
  bonusCard: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10, padding: 10, borderRadius: 11, backgroundColor: '#143C3A', borderWidth: 1, borderColor: '#38705A' },
  bonusCopy: { flex: 1 },
  bonusTitle: { color: '#D7F4C0', fontSize: 8, letterSpacing: .7, fontWeight: '900' },
  bonusDetail: { color: '#F1F7E9', fontSize: 11, fontWeight: '900', marginTop: 2 },
  miniTable: { borderTopWidth: 1, borderColor: '#2A4D51' },
  miniHeader: { minHeight: 27, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#2A4D51' },
  miniPos: { width: 34, color: '#829BB2', fontSize: 8, fontWeight: '900' },
  miniTeam: { flex: 1, color: '#829BB2', fontSize: 8, fontWeight: '900' },
  miniRound: { width: 38, color: '#9DB1C7', fontSize: 10, textAlign: 'right', fontVariant: ['tabular-nums'] },
  miniPts: { width: 43, color: '#C4D2E1', fontSize: 8, fontWeight: '900', textAlign: 'right' },
  miniRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.1)', paddingHorizontal: 2 },
  miniTeamName: { flex: 1, color: '#E0E9F3', fontSize: 11, fontWeight: '700' },
  miniPtsValue: { width: 43, color: '#F5F8FC', fontSize: 15, fontWeight: '900', textAlign: 'right', fontVariant: ['tabular-nums'] },
  emptyPhase: { minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 22, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,175,204,.16)', backgroundColor: 'rgba(6,20,40,.42)' },
  emptyTitle: { color: '#EAF1F9', fontSize: 13, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  emptyDetail: { maxWidth: 290, color: '#9CB2C9', fontSize: 10, lineHeight: 15, marginTop: 5, textAlign: 'center' },
  bracketStage: { marginTop: 8, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(201,177,102,.22)', backgroundColor: 'rgba(54,45,30,.35)' },
  bracketStageTitle: { color: '#FFE28A', fontSize: 10, letterSpacing: .65, fontWeight: '900', marginBottom: 7 },
  matchLine: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderColor: 'rgba(255,255,255,.07)' },
  matchName: { flex: 1, color: '#E1E9F1', fontSize: 9, fontWeight: '700' },
  matchNameRight: { textAlign: 'right' },
  matchScore: { minWidth: 42, color: '#FFE28A', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 9 },
  loadingText: { color: '#AFC3D8', fontSize: 11 },
  rulesStrip: { marginHorizontal: 18, marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rulesCopy: { flex: 1, color: '#849BB4', fontSize: 9, lineHeight: 14 },
});
