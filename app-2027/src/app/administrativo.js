import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { makeTeamInitials, PlayerCrest } from '../components/IdentityArt';
import RoundsManager from '../components/admin/RoundsManager';
import SuperligaManager from '../components/admin/SuperligaManager';
import SupercopaManager from '../components/admin/SupercopaManager';
import RecopaManager from '../components/admin/RecopaManager';
import RestaUmManager from '../components/admin/RestaUmManager';
import LibertadoresManager from '../components/admin/LibertadoresManager';
import CinturaoManager from '../components/admin/CinturaoManager';
import FormulaDepreManager from '../components/admin/FormulaDepreManager';
import AwardsManager from '../components/admin/AwardsManager';
import ContentManager from '../components/admin/ContentManager';
import { auth, onAuthStateChanged } from '../services/firebaseAuth';
import { database, get, onValue, ref, update } from '../services/firebaseDatabase';

const SEASON = '2027';
const SEASON_STATUSES = [
  { id: 'a_iniciar', label: 'A Iniciar' },
  { id: 'em_andamento', label: 'Em Andamento' },
  { id: 'concluida', label: 'Concluída' },
];
const TOURNAMENTS = [
  { id: 'supercopa', label: 'Supercopa' },
  { id: 'serieB', label: 'Série B' },
  { id: 'serieC', label: 'Série C' },
  { id: 'libertadores', label: 'Libertadores' },
  { id: 'recopa', label: 'Recopa' },
  { id: 'restaUm', label: 'Resta Um' },
  { id: 'cinturao', label: 'Cinturão do Mês' },
  { id: 'formulaDepre', label: 'Fórmula Deprê' },
];
const ADMIN_TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'rounds', label: 'Rodadas' },
  { id: 'players', label: 'Jogadores' },
  { id: 'superliga', label: 'Superliga' },
  { id: 'supercopa', label: 'Supercopa' },
  { id: 'restaUm', label: 'Resta Um' },
  { id: 'cinturao', label: 'Cinturão' },
  { id: 'formulaDepre', label: 'Fórmula Deprê' },
  { id: 'recopa', label: 'Recopa' },
  { id: 'libertadores', label: 'Libertadores' },
  { id: 'awards', label: 'Premiações e Conquistas' },
  { id: 'content', label: 'Conteúdo e Notificações' },
];
const ADMIN_MODULES = {
  rounds: {
    requiresActiveSeason: true,
    title: 'Rodadas',
    description: 'Monte o calendário completo e os jogos de cada rodada, com o mesmo nível de controle do painel atual.',
    items: ['Criar ou editar rodadas e jogos', 'Definir datas, horários e prazos por partida', 'Marcar quais torneios contam em cada rodada', 'Publicar, iniciar, encerrar e revisar uma rodada'],
  },
  superliga: {
    requiresActiveSeason: true,
    title: 'Superliga',
    description: 'Controle as fases da temporada e acompanhe a classificação até a decisão dos campeões.',
    items: ['Gerenciar fase geral e corte na 30ª rodada', 'Confirmar os oito classificados e bônus do Top 8', 'Montar a chave eliminatória do X-Salada', 'Registrar rebaixamento, etapas e campeões'],
  },
  supercopa: {
    requiresActiveSeason: true,
    title: 'Supercopa, Séries B e C',
    description: 'Organize as edições, sorteios e etapas eliminatórias dessas competições.',
    items: ['Criar edição, grupos e sorteio revisável', 'Definir potes, classificados e cruzamentos', 'Gerenciar Séries B e C com o formato correspondente', 'Avançar mata-mata de ida e volta e registrar campeões'],
  },
  restaUm: {
    requiresActiveSeason: true,
    title: 'Resta Um',
    description: 'Acompanhe a edição e registre eliminações com o motivo de cada ajuste.',
    items: ['Definir participantes e iniciar a edição', 'Apurar quem saiu após cada rodada', 'Registrar eliminação ou remoção manual com motivo', 'Consultar sobreviventes, histórico e campeão'],
  },
  cinturao: {
    requiresActiveSeason: true,
    title: 'Cinturão',
    description: 'Gerencie o detentor e a apuração mensal da disputa.',
    items: ['Acompanhar o confronto do cinturão', 'Conferir e corrigir a apuração mensal', 'Registrar detentor e histórico', 'Configurar a rotina de atualização'],
  },
  formulaDepre: {
    requiresActiveSeason: true,
    title: 'Fórmula Deprê',
    description: 'Configure equipes e acompanhe a competição durante a temporada.',
    items: ['Cadastrar ou ajustar equipes antes da largada', 'Atribuir equipe aos participantes', 'Acompanhar escala e pontuação', 'Manter a escolha bloqueada após o início'],
  },
  recopa: {
    requiresActiveSeason: true,
    title: 'Recopa',
    description: 'Defina se haverá edição e acompanhe a disputa entre os campeões anteriores.',
    items: ['Registrar decisão anual de realizar a edição', 'Confirmar participantes', 'Gerenciar partida única e rodadas extras', 'Registrar desempate, status e campeão'],
  },
  libertadores: {
    requiresActiveSeason: true,
    title: 'Libertadores',
    description: 'Configure participantes e formato da edição com base nos critérios definidos para a temporada.',
    items: ['Definir critério de vagas a partir da Superliga anterior', 'Registrar participantes e acordo da edição', 'Configurar pré-fases, chave e calendário', 'Acompanhar resultados e campeão'],
  },
  awards: {
    title: 'Premiações e Conquistas',
    description: 'Ajuste a distribuição financeira e administre badges com critérios claros, data e temporada.',
    items: ['Configurar divisão e valores por colocação', 'Registrar ajustes de patrocínio', 'Publicar títulos e conquistas no perfil e histórico', 'O plano já define o badge de rebaixamento; conquistas por feitos em jogos ainda precisam de critérios'],
  },
  content: {
    title: 'Conteúdo e Notificações',
    description: 'Prepare a resenha da temporada e organize os avisos enviados à turma.',
    items: ['Criar, revisar e corrigir resenhas por rodada', 'Moderar conteúdo antes da publicação', 'Gerenciar avisos de prazo, resultado, torneio e resenha', 'Conferir preferências e estado das notificações'],
  },
};

export default function AdministrativeScreen() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminUid, setAdminUid] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [players, setPlayers] = useState([]);
  const [memberships, setMemberships] = useState({});
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedUid, setExpandedUid] = useState(null);
  const [savingUid, setSavingUid] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [seasonStatus, setSeasonStatus] = useState(null);

  useEffect(() => {
    let accessStop = null;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      accessStop?.();
      accessStop = null;
      if (!user) {
        router.replace('/entrar');
        return;
      }
      setChecking(true);
      accessStop = onValue(ref(database, `users/${user.uid}/isAdmin`), (snapshot) => {
        if (snapshot.val() === true) {
          setAdminUid(user.uid);
          setAuthorized(true);
          setChecking(false);
        } else {
          setAuthorized(false);
          setChecking(false);
          router.replace('/home');
        }
      }, () => {
        setAuthorized(false);
        setChecking(false);
        router.replace('/home');
      });
    });
    return () => {
      stopAuth();
      accessStop?.();
    };
  }, [router]);

  useEffect(() => {
    if (!authorized) return undefined;
    let alive = true;
    async function loadRoster() {
      try {
        const [usersSnapshot, seasonStatusSnapshot] = await Promise.all([
          get(ref(database, 'users')),
          get(ref(database, `seasons/${SEASON}/status`)).catch(() => null),
        ]);
        const userEntries = Object.entries(usersSnapshot.val() || {});
        const roster = userEntries.map(([uid, user = {}]) => ({
          uid,
          name: String(user.name || user.customTeamName || '').trim() || `Jogador ${uid.slice(0, 6)}`,
          teamName: String(user.customTeamName || user.favoriteTeam?.name || '').trim(),
          formulaDepreTeamId: user.formulaDepreTeamId || '',
          useCustomShield: user.useCustomShield === true,
          shieldConfig: user.shieldConfig || null,
          shieldUrl: (user.useCustomShield === true && user.customShield) || user.favoriteTeam?.logo || user.teamImage || null,
        })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        const savedMemberships = await Promise.all(roster.map(async ({ uid }) => {
          const [eligibleSnapshot, tournamentsSnapshot, paymentSnapshot] = await Promise.all([
            get(ref(database, `seasons/${SEASON}/members/${uid}/eligible`)),
            get(ref(database, `seasons/${SEASON}/members/${uid}/tournaments`)),
            get(ref(database, `seasons/${SEASON}/members/${uid}/payment`)),
          ]);
          return [uid, {
            eligible: eligibleSnapshot.exists() ? eligibleSnapshot.val() === true : null,
            tournaments: tournamentsSnapshot.val() || {},
            payment: paymentSnapshot.val() || {},
          }];
        }));
        if (!alive) return;
        setPlayers(roster);
        setMemberships(Object.fromEntries(savedMemberships));
        setSeasonStatus(seasonStatusSnapshot?.val?.() ?? null);
        setRosterError('');
        setLoadingRoster(false);
      } catch {
        if (!alive) return;
        setRosterError('Não consegui carregar os perfis. Confira a conexão e a permissão de leitura da lista de jogadores.');
        setLoadingRoster(false);
      }
    }
    loadRoster();
    return () => { alive = false; };
  }, [authorized]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return players.filter((player) => !query || `${player.name} ${player.teamName}`.toLocaleLowerCase('pt-BR').includes(query))
      .sort((a, b) => Number(memberships[b.uid]?.eligible === true) - Number(memberships[a.uid]?.eligible === true) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [players, memberships, search]);
  const eligibleCount = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true).length, [players, memberships]);

  async function saveMembership(uid, makeNext) {
    if (!adminUid || savingUid) return;
    const current = memberships[uid] || { eligible: null, tournaments: {}, payment: {} };
    const next = makeNext(current);
    const nextTournaments = { ...current.tournaments, ...next.tournaments, superliga: next.eligible === true };
    if (next.eligible !== true) TOURNAMENTS.forEach(({ id }) => { nextTournaments[id] = false; });
    const memberPath = `seasons/${SEASON}/members/${uid}`;
    const updates = {
      [`${memberPath}/eligible`]: next.eligible === true,
      [`${memberPath}/tournaments/superliga`]: next.eligible === true,
      [`${memberPath}/updatedAt`]: currentClientTimestamp(),
      [`${memberPath}/updatedBy`]: adminUid,
    };
    TOURNAMENTS.forEach(({ id }) => {
      updates[`${memberPath}/tournaments/${id}`] = nextTournaments[id] === true;
    });
    setSavingUid(uid);
    setSaveMessage('');
    try {
      await update(ref(database), updates);
      setMemberships((previous) => ({ ...previous, [uid]: { ...current, eligible: next.eligible === true, tournaments: nextTournaments } }));
      setSaveMessage('Alteração salva na temporada 2027.');
    } catch {
      setSaveMessage('Não foi possível salvar. As regras do Realtime Database precisam autorizar esta gravação administrativa.');
    } finally {
      setSavingUid(null);
    }
  }

  function requestSeasonStatusChange(status) {
    if (!adminUid || savingUid || status === seasonStatus) return;
    const label = SEASON_STATUSES.find((item) => item.id === status)?.label || status;
    Alert.alert('Alterar status da temporada?', `A temporada 2027 ficará como "${label}". As telas dos jogadores passarão a mostrar esse status.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => saveSeasonStatus(status) },
    ]);
  }

  async function saveSeasonStatus(status) {
    if (!adminUid || savingUid) return;
    setSavingUid('season');
    setSaveMessage('');
    try {
      await update(ref(database), {
        [`seasons/${SEASON}/status`]: status,
        [`seasons/${SEASON}/statusUpdatedAt`]: currentClientTimestamp(),
        [`seasons/${SEASON}/statusUpdatedBy`]: adminUid,
      });
      setSeasonStatus(status);
      setSaveMessage('Status da temporada atualizado.');
    } catch {
      setSaveMessage('Não foi possível atualizar o status. Confira a conexão e as regras do Realtime Database.');
    } finally {
      setSavingUid(null);
    }
  }

  function requestPaymentChange(uid, status) {
    const player = players.find((item) => item.uid === uid);
    const label = status === 'paid' ? 'com pagamento confirmado' : status === 'exempt' ? 'isento da inscrição' : 'com pagamento pendente';
    Alert.alert(status === 'exempt' ? 'Isentar jogador?' : status === 'paid' ? 'Registrar pagamento recebido?' : 'Marcar pagamento como pendente?', `${player?.name || 'Este jogador'} ficará ${label} na temporada 2027.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => savePayment(uid, status) },
    ]);
  }

  async function savePayment(uid, status) {
    if (!adminUid || savingUid) return;
    const paymentPath = `seasons/${SEASON}/members/${uid}/payment`;
    const now = currentClientTimestamp();
    setSavingUid(uid);
    setSaveMessage('');
    try {
      await update(ref(database), {
        [`${paymentPath}/status`]: status,
        [`${paymentPath}/paidAt`]: status === 'paid' ? now : null,
        [`${paymentPath}/exemptAt`]: status === 'exempt' ? now : null,
        [`${paymentPath}/exemptBy`]: status === 'exempt' ? adminUid : null,
        [`${paymentPath}/updatedAt`]: now,
        [`${paymentPath}/updatedBy`]: adminUid,
      });
      setMemberships((previous) => ({
        ...previous,
        [uid]: { ...(previous[uid] || {}), payment: { ...(previous[uid]?.payment || {}), status, paidAt: status === 'paid' ? now : null, exemptAt: status === 'exempt' ? now : null, updatedAt: now, updatedBy: adminUid } },
      }));
      setSaveMessage('Pagamento atualizado na temporada 2027.');
    } catch {
      setSaveMessage('Não foi possível atualizar o pagamento. Confira as regras do Realtime Database.');
    } finally {
      setSavingUid(null);
    }
  }

  if (checking || !authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color="#A6F16A" size="large" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a Home" onPress={() => router.replace('/home')} style={styles.backButton}>
          <MaterialDesignIcons name="arrow-left" size={21} color="#E6F1FF" />
        </Pressable>
        <Text style={styles.seasonLabel}>TEMPORADA {SEASON}</Text>
      </View>
      <View style={styles.adminHeaderContent}>
        <Text accessibilityRole="header" style={styles.title}>Painel administrativo</Text>
        <Text style={styles.intro}>Gerencie a temporada e acompanhe cada competição.</Text>

        <View style={styles.tabsViewport} accessibilityRole="tablist">
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {ADMIN_TABS.map((tab) => <AdminTab key={tab.id} label={tab.label} selected={activeTab === tab.id} onPress={() => setActiveTab(tab.id)} />)}
          </ScrollView>
        </View>
      </View>

      {activeTab === 'rounds' ? <View style={styles.roundsManagerWrap}><RoundsManager adminUid={adminUid} seasonStatus={seasonStatus} /></View> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' ? <AdminOverview
          seasonStatus={seasonStatus}
          onChangeSeasonStatus={requestSeasonStatusChange}
          savingStatus={savingUid === 'season'}
          playersCount={players.length}
          eligibleCount={eligibleCount}
          loading={loadingRoster}
          rosterError={rosterError}
          onOpen={setActiveTab}
        /> : activeTab === 'players' ? (
          <>
            <View style={styles.listHeading}>
              <View><Text style={styles.sectionTitle}>Jogadores</Text><Text style={styles.sectionDetail}>{eligibleCount} aptos · {players.length} perfis</Text></View>
              <MaterialDesignIcons name="account-group-outline" size={23} color="#B9F276" />
            </View>
            <Text style={styles.eligibilityNote}>Aptidão define a inclusão na temporada 2027; aprovação e pagamento são controlados separadamente.</Text>
            <TextInput
              accessibilityLabel="Buscar jogador"
              placeholder="Buscar por nome ou time"
              placeholderTextColor="#8199B3"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!saveMessage && <Text accessibilityLiveRegion="polite" style={[styles.feedback, saveMessage.startsWith('Não') && styles.feedbackError]}>{saveMessage}</Text>}
            {loadingRoster ? <View style={styles.rosterLoading}><ActivityIndicator color="#A6F16A" /><Text style={styles.rosterLoadingText}>Carregando jogadores…</Text></View>
              : rosterError ? <View style={styles.emptyState}><MaterialDesignIcons name="cloud-alert-outline" size={25} color="#FFB5A9" /><Text style={styles.emptyTitle}>Lista indisponível</Text><Text style={styles.emptyDetail}>{rosterError}</Text></View>
                : filteredPlayers.length ? filteredPlayers.map((player) => <PlayerMembershipCard
                  key={player.uid}
                  player={player}
                  membership={memberships[player.uid]}
                  expanded={expandedUid === player.uid}
                  disabled={Boolean(savingUid)}
                  saving={savingUid === player.uid}
                  paymentStatus={memberships[player.uid]?.payment?.status || 'pending'}
                  onExpand={() => setExpandedUid((current) => current === player.uid ? null : player.uid)}
                  onEligibilityChange={(eligible) => saveMembership(player.uid, (current) => ({ ...current, eligible }))}
                  onTournamentChange={(id, selected) => saveMembership(player.uid, (current) => ({
                    ...current,
                    tournaments: { ...current.tournaments, [id]: selected },
                  }))}
                  onPaymentChange={(status) => requestPaymentChange(player.uid, status)}
                />)
                  : <View style={styles.emptyState}><MaterialDesignIcons name="account-search-outline" size={25} color="#AFC5DD" /><Text style={styles.emptyTitle}>Nenhum jogador encontrado</Text><Text style={styles.emptyDetail}>Ajuste o nome da busca e tente novamente.</Text></View>}
          </>
        ) : activeTab === 'superliga' ? <SuperligaManager players={players} memberships={memberships} loadingRoster={loadingRoster} rosterError={rosterError} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'supercopa' ? <SupercopaManager players={players} memberships={memberships} loadingRoster={loadingRoster} rosterError={rosterError} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'recopa' ? <RecopaManager players={players} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'restaUm' ? <RestaUmManager players={players} memberships={memberships} loadingRoster={loadingRoster} rosterError={rosterError} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'libertadores' ? <LibertadoresManager players={players} memberships={memberships} loadingRoster={loadingRoster} rosterError={rosterError} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'cinturao' ? <CinturaoManager players={players} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'formulaDepre' ? <FormulaDepreManager players={players} memberships={memberships} seasonStatus={seasonStatus} adminUid={adminUid} /> : activeTab === 'awards' ? <AwardsManager players={players} memberships={memberships} adminUid={adminUid} /> : activeTab === 'content' ? <ContentManager players={players} memberships={memberships} adminUid={adminUid} /> : <AdminModulePanel module={ADMIN_MODULES[activeTab]} seasonStatus={seasonStatus} />}
      </ScrollView>
      }
    </SafeAreaView>
  );
}

function AdminTab({ label, selected, onPress }) {
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.tab, selected && styles.tabSelected]}>
    <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
  </Pressable>;
}

function PlayerMembershipCard({ player, membership, expanded, disabled, saving, paymentStatus, onExpand, onEligibilityChange, onTournamentChange, onPaymentChange }) {
  const eligible = membership?.eligible === true;
  const eligibilityDefined = typeof membership?.eligible === 'boolean';
  const selectedCount = TOURNAMENTS.filter(({ id }) => membership?.tournaments?.[id] === true).length + (eligible ? 1 : 0);
  return <View style={styles.playerCard}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} configurações de ${player.name}`} onPress={onExpand} style={styles.playerTop}>
      <View style={styles.playerCrest}>
        {player.useCustomShield && player.shieldConfig
          ? <PlayerCrest config={player.shieldConfig} initials={makeTeamInitials(player.teamName || player.name)} size={38} />
          : player.shieldUrl ? <Image source={{ uri: player.shieldUrl }} resizeMode="contain" style={styles.playerCrestImage} />
            : <PlayerCrest config={player.shieldConfig || {}} initials={makeTeamInitials(player.teamName || player.name)} size={38} />}
      </View>
      <View style={styles.playerCopy}>
        <Text numberOfLines={1} style={styles.playerName}>{player.name}</Text>
        <Text numberOfLines={1} style={styles.playerTeam}>{player.teamName || (eligible ? `${selectedCount} torneio${selectedCount === 1 ? '' : 's'}` : eligibilityDefined ? 'Não apto para a temporada' : 'Participação ainda não definida')}</Text>
      </View>
      <MaterialDesignIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#AFC5DD" />
    </Pressable>
    <View style={styles.eligibilityRow}>
      <View style={styles.eligibilityCopy}>
        <Text style={styles.eligibilityTitle}>Apto para a temporada</Text>
        <Text style={[styles.eligibilityStatus, eligible && styles.eligibilityStatusOn]}>{eligible ? 'APTO' : eligibilityDefined ? 'NÃO APTO' : 'NÃO DEFINIDO'}</Text>
      </View>
      {saving && <ActivityIndicator size="small" color="#A6F16A" />}
      <EligibilityChoice selected={eligibilityDefined ? eligible : null} disabled={disabled} onChange={onEligibilityChange} />
    </View>
    <View style={styles.paymentRow}>
      <View style={styles.eligibilityCopy}>
        <Text style={styles.eligibilityTitle}>Pagamento da temporada</Text>
        <Text style={[styles.eligibilityStatus, paymentStatus !== 'pending' && styles.eligibilityStatusOn]}>{paymentStatus === 'paid' ? 'PAGO' : paymentStatus === 'exempt' ? 'ISENTO' : 'PENDENTE'}</Text>
      </View>
      {saving && <ActivityIndicator size="small" color="#A6F16A" />}
      <View style={styles.paymentChoices}>
        {[["paid", "Pago"], ["pending", "Pendente"], ["exempt", "Isento"]].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: paymentStatus === value }} disabled={disabled} onPress={() => paymentStatus !== value && onPaymentChange(value)} style={[styles.paymentChoice, paymentStatus === value && styles.paymentChoiceSelected, disabled && styles.disabled]}><Text style={[styles.paymentChoiceText, paymentStatus === value && styles.paymentChoiceTextSelected]}>{label}</Text></Pressable>)}
      </View>
    </View>
    {expanded && <View style={styles.tournaments}>
      <View style={styles.tournamentHeading}><Text style={styles.tournamentTitle}>Participação nos torneios</Text><Text style={styles.tournamentHelp}>{eligible ? 'Selecione as disputas deste jogador.' : 'Marque o jogador apto para habilitar as disputas.'}</Text></View>
      <View style={styles.tournamentGrid}>
        <View style={[styles.tournamentOption, styles.tournamentOptionAuto]}><Text style={styles.tournamentOptionText}>Superliga</Text><Text style={styles.automaticLabel}>{eligible ? 'AUTOMÁTICA' : '—'}</Text></View>
        {TOURNAMENTS.map(({ id, label }) => <BinarySwitch
          key={id}
          label={`${label}: ${player.name}`}
          displayLabel={label}
          checked={membership?.tournaments?.[id] === true}
          disabled={!eligible || disabled}
          onPress={() => onTournamentChange(id, membership?.tournaments?.[id] !== true)}
        />)}
      </View>
    </View>}
  </View>;
}

function BinarySwitch({ label, displayLabel, checked, disabled, onPress }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[displayLabel ? styles.tournamentOption : styles.inlineSwitch, disabled && styles.controlDisabled]}>
    {!!displayLabel && <Text numberOfLines={2} style={styles.tournamentOptionText}>{displayLabel}</Text>}
    <View style={[styles.switchTrack, checked && styles.switchTrackOn]}><View style={[styles.switchThumb, checked && styles.switchThumbOn]} /></View>
  </Pressable>;
}

function EligibilityChoice({ selected, disabled, onChange }) {
  return <View style={styles.eligibilityChoices} accessibilityRole="radiogroup">
    {[[true, 'APTO'], [false, 'NÃO APTO']].map(([value, label]) => {
      const active = selected === value;
      return <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onChange(value)} style={[styles.eligibilityChoice, active && (value ? styles.eligibilityChoiceSelected : styles.eligibilityChoiceOffSelected), disabled && styles.controlDisabled]}>
        <Text style={[styles.eligibilityChoiceText, active && styles.eligibilityChoiceTextSelected]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

function AdminOverview({ seasonStatus, onChangeSeasonStatus, savingStatus, playersCount, eligibleCount, loading, rosterError, onOpen }) {
  const statusLabel = readableSeasonStatus(seasonStatus);
  return <>
    <View style={styles.listHeading}>
      <View><Text style={styles.sectionTitle}>Temporada 2027</Text><Text style={styles.sectionDetail}>Resumo da configuração atual</Text></View>
      <MaterialDesignIcons name="view-dashboard-outline" size={23} color="#B9F276" />
    </View>
    <View style={styles.dashboardPanel}>
      <View style={styles.dashboardStatus}>
        <Text style={styles.dashboardLabel}>STATUS DA TEMPORADA</Text>
        <Text style={styles.dashboardStatusValue}>{statusLabel}</Text>
        <View style={styles.statusChoices}>
          {SEASON_STATUSES.map(({ id, label }) => <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: normalizeSeasonStatus(seasonStatus) === id, disabled: savingStatus }}
            disabled={savingStatus}
            onPress={() => onChangeSeasonStatus(id)}
            style={[styles.statusChoice, normalizeSeasonStatus(seasonStatus) === id && styles.statusChoiceSelected, savingStatus && styles.controlDisabled]}
          >
            <Text style={[styles.statusChoiceText, normalizeSeasonStatus(seasonStatus) === id && styles.statusChoiceTextSelected]}>{label}</Text>
          </Pressable>)}
        </View>
      <Text style={styles.statusHelp}>A temporada precisa estar em andamento para iniciar ou atualizar torneios. A preparação de participantes e calendário pode ser feita antes.</Text>
      </View>
      <View style={styles.dashboardMetrics}>
        <DashboardMetric label="Jogadores aptos" value={loading ? '…' : rosterError ? '—' : eligibleCount} />
        <View style={styles.metricDivider} />
        <DashboardMetric label="Perfis" value={loading ? '…' : rosterError ? '—' : playersCount} />
      </View>
    </View>
    <View style={styles.listHeading}>
      <View><Text style={styles.sectionTitle}>Acesso rápido</Text><Text style={styles.sectionDetail}>Abra a área que quer gerenciar</Text></View>
    </View>
    <View style={styles.shortcuts}>
      {['rounds', 'players', 'superliga'].map((id) => {
        const tab = ADMIN_TABS.find((item) => item.id === id);
        return <Pressable key={id} accessibilityRole="button" onPress={() => onOpen(id)} style={styles.shortcut}>
          <Text style={styles.shortcutText}>{tab.label}</Text><MaterialDesignIcons name="arrow-right" size={17} color="#B9F276" />
        </Pressable>;
      })}
    </View>
    <View style={styles.nextStep}>
      <MaterialDesignIcons name="clipboard-text-clock-outline" size={20} color="#AFC5DD" />
      <View style={styles.nextCopy}><Text style={styles.nextTitle}>Próximas etapas</Text><Text style={styles.nextDetail}>Configure calendário e jogos, depois siga com as demais competições e conquistas.</Text></View>
    </View>
  </>;
}

function DashboardMetric({ label, value }) {
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}

function AdminModulePanel({ module, seasonStatus }) {
  if (!module) return null;
  return <>
    <View style={styles.listHeading}>
      <View><Text style={styles.sectionTitle}>{module.title}</Text><Text style={styles.sectionDetail}>Escopo previsto para o painel</Text></View>
      <View style={styles.moduleStatus}><Text style={styles.moduleStatusText}>A CONSTRUIR</Text></View>
    </View>
    <View style={styles.modulePanel}>
      <View style={styles.moduleSeasonStatus}><Text style={styles.moduleSeasonStatusLabel}>TEMPORADA 2027</Text><Text style={styles.moduleSeasonStatusValue}>{readableSeasonStatus(seasonStatus)}</Text></View>
      <Text style={styles.moduleDescription}>{module.description}</Text>
      <Text style={styles.moduleListHeading}>ESTA ABA VAI REUNIR</Text>
      {module.items.map((item) => <View key={item} style={styles.moduleItem}>
        <MaterialDesignIcons name="chevron-right" size={18} color="#B9F276" />
        <Text style={styles.moduleItemText}>{item}</Text>
      </View>)}
    </View>
    {module.requiresActiveSeason && normalizeSeasonStatus(seasonStatus) !== 'em_andamento' && <Text style={styles.moduleGateNote}>Início e atualização de torneios ficam bloqueados até a temporada entrar em andamento.</Text>}
    <Text style={styles.moduleFootnote}>A navegação está pronta; os controles e gravações desta área serão implementados por etapas.</Text>
  </>;
}

function readableSeasonStatus(status) {
  return SEASON_STATUSES.find((item) => item.id === normalizeSeasonStatus(status))?.label || 'Não definido';
}

function normalizeSeasonStatus(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[ -]/g, '_');
  const aliases = { draft: 'a_iniciar', preparation: 'a_iniciar', prepared: 'a_iniciar', active: 'em_andamento', open: 'em_andamento', finished: 'concluida', complete: 'concluida', closed: 'concluida' };
  const aliased = aliases[normalized] || normalized;
  return SEASON_STATUSES.some((item) => item.id === aliased) ? aliased : null;
}

function currentClientTimestamp() {
  return Date.now();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#071735' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C2D52', borderWidth: 1, borderColor: '#315578' },
  seasonLabel: { color: '#B9F276', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32 },
  adminHeaderContent: { paddingHorizontal: 16, paddingTop: 18 },
  roundsManagerWrap: { flex: 1, paddingHorizontal: 16 },
  title: { color: '#F6F8FC', fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -.5 },
  intro: { color: '#B7C9DD', fontSize: 13, lineHeight: 19, marginTop: 7 },
  tabsViewport: { marginTop: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0A2241' },
  tabs: { minHeight: 52, flexDirection: 'row', padding: 4, gap: 4 },
  tab: { minWidth: 94, maxWidth: 190, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabSelected: { backgroundColor: '#B9F276' },
  tabText: { color: '#AFC5DD', fontSize: 10, letterSpacing: .7, fontWeight: '900' },
  tabTextSelected: { color: '#0A2345' },
  statusChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  statusChoice: { minHeight: 39, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#48617A', backgroundColor: '#142E4C' },
  statusChoiceSelected: { borderColor: '#94CA68', backgroundColor: '#25493D' },
  statusChoiceText: { color: '#B6C8DA', fontSize: 9, fontWeight: '900' },
  statusChoiceTextSelected: { color: '#DDF5CB' },
  statusHelp: { color: '#91A9C7', fontSize: 10, lineHeight: 15, marginTop: 8 },
  listHeading: { marginTop: 24, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F2F6FC', fontSize: 18, fontWeight: '900' },
  sectionDetail: { color: '#91A9C7', fontSize: 10, marginTop: 3 },
  eligibilityNote: { color: '#AFC5DD', fontSize: 10, lineHeight: 15, marginTop: -4, marginBottom: 10 },
  searchInput: { minHeight: 48, paddingHorizontal: 13, color: '#F1F6FC', fontSize: 13, borderRadius: 11, borderWidth: 1, borderColor: '#315578', backgroundColor: '#0C2547' },
  feedback: { marginTop: 9, color: '#C8F0A6', fontSize: 11, lineHeight: 16 },
  feedbackError: { color: '#FFC1B6' },
  rosterLoading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 9 },
  rosterLoadingText: { color: '#AFC5DD', fontSize: 12 },
  emptyState: { minHeight: 150, marginTop: 14, padding: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#294563', backgroundColor: '#0A2241' },
  emptyTitle: { color: '#EAF1F9', fontSize: 13, fontWeight: '900', marginTop: 9, textAlign: 'center' },
  emptyDetail: { color: '#AFC5DD', fontSize: 11, lineHeight: 16, marginTop: 5, textAlign: 'center' },
  playerCard: { marginTop: 10, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' },
  playerTop: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerCrest: { width: 42, height: 45, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  playerCrestImage: { width: 38, height: 42 },
  playerCopy: { flex: 1 },
  playerName: { color: '#F0F5FC', fontSize: 14, fontWeight: '800' },
  playerTeam: { color: '#9FB4CA', fontSize: 10, marginTop: 3 },
  eligibilityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' },
  paymentRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' },
  paymentChoices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  paymentChoice: { minHeight: 29, minWidth: 51, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#49627B', backgroundColor: '#142E4C' },
  paymentChoiceSelected: { borderColor: '#86B968', backgroundColor: '#24483E' },
  paymentChoiceText: { color: '#AFC5DD', fontSize: 8, fontWeight: '900' },
  paymentChoiceTextSelected: { color: '#D8F6C3' },
  inlineSwitch: { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  eligibilityCopy: { flex: 1 },
  eligibilityTitle: { color: '#CBD8E7', fontSize: 11, fontWeight: '800' },
  eligibilityStatus: { color: '#C8D3E0', fontSize: 8, letterSpacing: .7, fontWeight: '900', marginTop: 3 },
  eligibilityStatusOn: { color: '#B9F276' },
  switchTrack: { width: 34, height: 20, padding: 3, borderRadius: 12, justifyContent: 'center', backgroundColor: '#5A6878' },
  switchTrackOn: { backgroundColor: '#3E7E5A' },
  switchThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#F3F7FB' },
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: '#CFFF9E' },
  eligibilityChoices: { flexDirection: 'row', gap: 5 },
  eligibilityChoice: { minHeight: 40, minWidth: 66, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#49627B', backgroundColor: '#142E4C' },
  eligibilityChoiceSelected: { borderColor: '#86B968', backgroundColor: '#24483E' },
  eligibilityChoiceOffSelected: { borderColor: '#A55E59', backgroundColor: '#4A2D37' },
  eligibilityChoiceText: { color: '#AFC5DD', fontSize: 8, fontWeight: '900' },
  eligibilityChoiceTextSelected: { color: '#D8F6C3' },
  tournaments: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' },
  tournamentHeading: { marginBottom: 9 },
  tournamentTitle: { color: '#E5EEF8', fontSize: 11, fontWeight: '900' },
  tournamentHelp: { color: '#91A9C7', fontSize: 10, lineHeight: 15, marginTop: 3 },
  tournamentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tournamentOption: { width: '48%', minHeight: 48, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderRadius: 9, borderWidth: 1, borderColor: '#335370', backgroundColor: '#102C4C' },
  tournamentOptionAuto: { borderColor: '#55754D', backgroundColor: '#15372F' },
  tournamentOptionText: { flex: 1, color: '#D2DFED', fontSize: 9, lineHeight: 13, fontWeight: '800' },
  automaticLabel: { color: '#C8F0A6', fontSize: 7, letterSpacing: .35, fontWeight: '900' },
  controlDisabled: { opacity: .5 },
  dashboardPanel: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#315578', backgroundColor: '#0C2547' },
  dashboardStatus: { paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.16)' },
  dashboardLabel: { color: '#91A9C7', fontSize: 9, letterSpacing: .8, fontWeight: '900' },
  dashboardStatusValue: { color: '#F2F6FC', fontSize: 19, fontWeight: '900', marginTop: 5 },
  dashboardMetrics: { flexDirection: 'row', alignItems: 'center', paddingTop: 13 },
  metric: { flex: 1 },
  metricValue: { color: '#B9F276', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#AFC5DD', fontSize: 10, marginTop: 3 },
  metricDivider: { width: 1, height: 35, marginHorizontal: 15, backgroundColor: 'rgba(153,182,211,.22)' },
  shortcuts: { gap: 8 },
  shortcut: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' },
  shortcutText: { color: '#E5EEF8', fontSize: 12, fontWeight: '800' },
  moduleStatus: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: '#263B50' },
  moduleStatusText: { color: '#C5D3E1', fontSize: 8, letterSpacing: .5, fontWeight: '900' },
  modulePanel: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#315578', backgroundColor: '#0C2547' },
  moduleDescription: { color: '#D3DFEC', fontSize: 12, lineHeight: 18 },
  moduleSeasonStatus: { paddingBottom: 11, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.12)' },
  moduleSeasonStatusLabel: { color: '#91A9C7', fontSize: 9, letterSpacing: .7, fontWeight: '900' },
  moduleSeasonStatusValue: { color: '#B9F276', fontSize: 10, fontWeight: '900' },
  moduleListHeading: { color: '#91A9C7', fontSize: 9, letterSpacing: .8, fontWeight: '900', marginTop: 19, marginBottom: 5 },
  moduleItem: { minHeight: 42, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.12)' },
  moduleItemText: { flex: 1, color: '#CBD8E7', fontSize: 11, lineHeight: 16 },
  moduleFootnote: { color: '#91A9C7', fontSize: 10, lineHeight: 15, marginTop: 11 },
  moduleGateNote: { color: '#FFD987', fontSize: 10, lineHeight: 15, marginTop: 11, padding: 10, borderRadius: 9, backgroundColor: '#382F28' },
  seasonPanel: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 4, borderRadius: 15, backgroundColor: '#0C2547', borderWidth: 1, borderColor: '#315578' },
  panelTitle: { color: '#EAF1F9', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  ruleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(153,182,211,.12)' },
  lastRuleRow: { borderBottomWidth: 0 },
  ruleText: { flex: 1, color: '#CBD8E7', fontSize: 12, lineHeight: 18 },
  nextStep: { marginTop: 18, paddingVertical: 14, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: '#294563' },
  nextCopy: { flex: 1 },
  nextTitle: { color: '#DDE8F4', fontSize: 12, fontWeight: '900' },
  nextDetail: { color: '#91A9C7', fontSize: 11, lineHeight: 16, marginTop: 4 },
});
