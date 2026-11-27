import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { CryingBallLogo } from '../components/CryingBallLogo';
import { CrestGlyph, CrestMiniature, FormulaCarBadge, PlayerAvatar, PlayerCrest, makeTeamInitials } from '../components/IdentityArt';
import { AVATAR_LAYERS, DEFAULT_AVATAR_CONFIG, normalizeAvatarConfig, replaceAvatarPart, setAvatarColor, toggleAvatarAccessory } from '../components/avatar-engine/config';
import { auth, onAuthStateChanged } from '../services/firebaseAuth';
import { database, get, ref, update } from '../services/firebaseDatabase';
import { isPlayerSetupComplete, markProfileSetupComplete } from '../services/onboardingSession';

const STADIUM = require('../../assets/brand/stadium-night.jpg');
const TEAM_COLORS = [
  ['red-burro', 'Red Burro FC', '#1d4ed8'], ['mc-lata', 'McLata FC', '#f97316'],
  ['ferruja', 'Ferruja Corse', '#dc2626'], ['mercedao', 'Mercedao GP', '#14b8a6'],
  ['aston-maula', 'Aston Maula', '#15803d'], ['alpinada', 'Alpinada Racing', '#2563eb'],
  ['willi-massa', 'WilliMassa', '#60a5fa'], ['rb-bangu', 'RB Bangu', '#1e40af'],
  ['saube', 'Saube FC', '#22c55e'], ['haas-da-massa', 'Haas da Massa', '#94a3b8'],
  ['cadilacre', 'Cadilacre Speed Team', '#f59e0b'],
];
const STEPS = ['JOGADOR', 'SEU TIME', 'TIME DO CORAÇÃO', 'FÓRMULA DEPRÊ', 'MONTE O ESCUDO', 'CRIE SEU AVATAR', 'REVISE A FICHA'];
const STEP_TITLES = [
  'Como a turma vai te chamar?', 'Qual é o nome do seu time?', 'Qual time mora no seu coração?',
  'Escolha sua escuderia', 'Crie um escudo com a sua cara', 'Monte seu avatar', 'Sua ficha de estreia',
];
const STEP_COPY = [
  'Nome e sobrenome deixam a tabela e a resenha mais claras.',
  'Esse nome representa você nos torneios e na classificação.',
  'Escolha um clube da lista. O escudo aparece junto para facilitar.',
  'Selecione um carro para a temporada. Capacete e pintura seguem as cores da equipe.',
  'Escolha o formato, as faixas e o símbolo do seu escudo.',
  'Ajuste traços, cabelo, expressão, uniforme e acessórios. A prévia muda a cada escolha.',
  'Confira seu nome, seus escudos e seu avatar antes de entrar na temporada.',
];
const DEFAULT_SHIELD = { shape: 'ogival', pattern: 'v-stripes', colorPrimary: '#0A8058', colorSecondary: '#0B365B', colorTertiary: '#F2C94C', colorBorder: '#F2C94C', colorIcon: '#FFFFFF', colorText: '#08182D', selectedIcon: 'soccer', showAbbr: true };
const shieldShapes = [['ogival', 'Clássico'], ['french', 'Francês'], ['round', 'Redondo'], ['diamond', 'Losango'], ['retro', 'Retrô'], ['crown', 'Coroa'], ['hexagon', 'Hexagonal'], ['spanish', 'Ibérico'], ['square', 'Quadrado'], ['pennant', 'Flâmula'], ['oval', 'Oval'], ['winged', 'Alado']];
const shieldPatterns = [['v-stripes', 'Verticais'], ['h-stripes', 'Horizontais'], ['diagonal', 'Faixa direita'], ['diagonal_inv', 'Faixa esquerda'], ['halves', 'Metades'], ['quarters', 'Quadros'], ['chevron', 'Chevron'], ['cross', 'Cruz'], ['pinstripes', 'Finos'], ['hoops', 'Aros'], ['tricolor', 'Tricolor'], ['solid', 'Liso']];
const shieldIcons = [['soccer', 'Bola'], ['trophy', 'Taça'], ['crown', 'Coroa'], ['lightning-bolt', 'Raio'], ['fire', 'Chama'], ['star', 'Estrela'], ['anchor', 'Âncora'], ['shield-star', 'Escudo'], ['whistle', 'Apito'], ['shoe-cleat', 'Chuteira'], ['flag-checkered', 'Bandeira'], ['bird', 'Ave'], ['owl', 'Coruja'], ['dog-side', 'Cão'], ['cat', 'Felino'], ['horse-variant', 'Cavalo'], ['snake', 'Serpente'], ['soccer-field', 'Campo'], ['football-helmet', 'Capacete'], ['medal', 'Medalha'], ['shield-crown', 'Escudo real'], ['paw', 'Pata'], ['bullseye', 'Alvo'], ['skull', 'Caveira']];
const legacyCrestIconNames = { ball: 'soccer', bolt: 'lightning-bolt', shield: 'shield-star', boot: 'shoe-cleat', flag: 'flag-checkered', eagle: 'bird', lion: 'cat', wolf: 'dog-side', bull: 'bullseye', phoenix: 'fire', laurel: 'medal', goal: 'soccer-field', captain: 'shield-crown' };
const crestPalette = ['#071A35', '#132542', '#0A4782', '#0B65B3', '#1687D9', '#34B5E5', '#0A8058', '#168B58', '#45B649', '#A6F16A', '#E5B51B', '#F2C94C', '#F28C28', '#D93D3D', '#8E2430', '#743CC1', '#A657C5', '#E9F2F8', '#FFFFFF', '#68788B', '#323B48', '#111111'];
const trimPalette = ['#F2C94C', '#FFFFFF', '#E9F2F8', '#FF6F61', '#49C6AE', '#111827', '#080B11', '#D9A441', '#BFC9D4', '#7D8EA3', '#08182D'];
const shieldTabs = [['symbol', 'Emblema', 'shield-star'], ['shape', 'Formato', 'shape-outline'], ['pattern', 'Pintura', 'texture'], ['colors', 'Cores', 'palette-outline'], ['details', 'Acabamento', 'layers-triple'], ['type', 'Letras', 'format-text']];
const crestLetters = [['varsity', 'Universitária'], ['condensed', 'Placar'], ['serif', 'Clássica'], ['italic', 'Itálica'], ['block', 'Bloco']];
const crestOrnaments = [['none', 'Limpo'], ['stars', 'Estrelas'], ['laurel', 'Louro'], ['wings', 'Asas'], ['bolts', 'Raios']];
const crestBorderStyles = [['classic', 'Clássico'], ['double', 'Duplo'], ['metal', 'Metálico'], ['fine', 'Fino']];
const avatarTabs = [['appearance', 'Traços', 'face-man-shimmer'], ['hair', 'Cabelo', 'hair-dryer'], ['expression', 'Expressão', 'emoticon-happy-outline'], ['uniform', 'Uniforme', 'tshirt-crew-outline'], ['extras', 'Extras', 'glasses']];
const avatarSkinPalette = ['#F7D7C0', '#EFC09D', '#D99B75', '#B97756', '#966044', '#7E4E39', '#55352F'];
const avatarHairPalette = ['#171519', '#30251F', '#553527', '#8A4B27', '#B8783F', '#D9B27C', '#C7C5C2', '#F2E6D2'];
const avatarHairOptions = [
  ['bald', 'Careca', 'hair-front-bald'], ['buzz', 'Raspado', 'hair-front-buzz'], ['short', 'Curto', 'hair-front-short'],
  ['quiff', 'Topete', 'hair-front-quiff'], ['sidepart', 'Social', 'hair-front-sidepart'], ['curly', 'Cacheado', 'hair-front-curly'],
  ['afro', 'Afro', 'hair-front-afro'], ['coily', 'Crespo', 'hair-front-coily'], ['long-wavy', 'Longo', 'hair-front-long-wavy'],
  ['bob', 'Chanel', 'hair-front-bob'], ['pixie', 'Pixie', 'hair-front-pixie'], ['ponytail', 'Rabo de cavalo', 'hair-front-ponytail'],
  ['bun', 'Coque', 'hair-front-bun'], ['braids', 'Tranças', 'hair-front-braids'], ['dreads', 'Dreads', 'hair-front-dreads'],
  ['mullet', 'Mullet', 'hair-front-mullet'], ['rocker', 'Longo repicado', 'hair-front-rocker'],
];
const avatarExpressionOptions = [
  ['cheerful', 'Sorriso', ['eyes-round', 'brows-natural', 'mouth-smile']],
  ['joy', 'Comemora', ['eyes-happy', 'brows-arched', 'mouth-grin']],
  ['focus', 'Focado', ['eyes-narrow', 'brows-determined', 'mouth-neutral']],
  ['calm', 'Tranquilo', ['eyes-soft', 'brows-thin', 'mouth-neutral']],
  ['confident', 'Confiante', ['eyes-round', 'brows-arched', 'mouth-smirk']],
];
const avatarJerseyOptions = [
  ['solid', 'Clássica', 'jersey-solid'], ['vertical', 'Listras', 'jersey-vertical'], ['horizontal', 'Aros', 'jersey-horizontal'],
  ['diagonal', 'Diagonal', 'jersey-diagonal'], ['split', 'Metades', 'jersey-split'], ['central', 'Faixa central', 'jersey-central'],
  ['chevron', 'Chevron', 'jersey-chevron'], ['pinstripe', 'Fina', 'jersey-pinstripe'], ['shoulder', 'Ombros', 'jersey-shoulder'], ['retro', 'Retrô', 'jersey-retro'],
];
const kitPalette = ['#126AC2', '#168B58', '#E0A52A', '#D83A3A', '#702DB7', '#202B3D', '#E9F2F8', '#0B365B', '#F2C94C', '#111111'];
let formulaUsersCache = null;
let formulaUsersRequest = null;
let espnClubCatalogRequest = null;

export default function ConfigureProfileScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [clubName, setClubName] = useState('');
  const [baseTeamId, setBaseTeamId] = useState('');
  const [espnClubCatalog, setEspnClubCatalog] = useState([]);
  const [espnCatalogLoading, setEspnCatalogLoading] = useState(false);
  const [espnCatalogError, setEspnCatalogError] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [formulaTeamId, setFormulaTeamId] = useState('');
  const [existingFormulaTeamId, setExistingFormulaTeamId] = useState('');
  const [formulaTeams, setFormulaTeams] = useState(TEAM_COLORS);
  const [formulaTeamLocked, setFormulaTeamLocked] = useState(false);
  const [existingFavoriteTeam, setExistingFavoriteTeam] = useState(null);
  const [existingFavoriteTeamName, setExistingFavoriteTeamName] = useState('');
  const [shieldConfig, setShieldConfig] = useState(DEFAULT_SHIELD);
  const [shieldTab, setShieldTab] = useState('symbol');
  const [avatarConfig, setAvatarConfig] = useState(() => normalizeAvatarConfig(DEFAULT_AVATAR_CONFIG));
  const [avatarEditorTab, setAvatarEditorTab] = useState('appearance');
  const [shieldTouched, setShieldTouched] = useState(false);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [canLeave, setCanLeave] = useState(false);

  usePreventRemove(!canLeave, () => {});
  useEffect(() => { if (canLeave) router.replace('/home'); }, [canLeave, router]);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      router.replace('/entrar');
      return;
    }
    try {
      const snapshot = await get(ref(database, `users/${user.uid}`));
      const saved = snapshot.val() || {};
      if (isPlayerSetupComplete(saved)) {
        setCanLeave(true);
        return;
      }
      const [formulaTeamsSnapshot, formulaAssignmentSnapshot, seasonStatusSnapshot] = await Promise.all([
        get(ref(database, 'tournaments/formulaDepre/2027/teams')),
        get(ref(database, `tournaments/formulaDepre/2027/assignments/${user.uid}`)),
        get(ref(database, 'seasons/2027/status')).catch(() => null),
      ]);
      if (formulaTeamsSnapshot.exists()) {
        const rawTeams = formulaTeamsSnapshot.val();
        const normalizedTeams = Array.isArray(rawTeams)
          ? rawTeams.map((team) => [team.id, team.name, team.color])
          : Object.entries(rawTeams || {}).map(([id, team]) => [id, team.name, team.color]);
        setFormulaTeams(normalizedTeams.filter(([id, name]) => id && name));
      }
      const assignedFormulaTeam = formulaAssignmentSnapshot.exists() ? formulaAssignmentSnapshot.val() : saved.formulaDepreTeamId || '';
      setFormulaTeamLocked(['em_andamento', 'concluida', 'active', 'complete'].includes(String(seasonStatusSnapshot?.val?.() || '').toLowerCase().replace(/[ -]/g, '_')));
      setFullName(saved.name || user.displayName || '');
      setClubName(saved.customTeamName || '');
      setFormulaTeamId(assignedFormulaTeam || '');
      setExistingFormulaTeamId(assignedFormulaTeam || '');
      setExistingFavoriteTeam(saved.favoriteTeam ?? null);
      const savedTeam = saved.favoriteTeam;
      const savedEspnTeamId = typeof savedTeam === 'object' && savedTeam
        ? savedTeam.id || savedTeam.espnId
        : saved.teamId || (typeof saved.team === 'object' && saved.team ? saved.team.id || saved.team.espnId : '');
      const savedTeamId = String(savedEspnTeamId || '');
      setBaseTeamId(savedTeamId ? (savedTeamId.startsWith('espn-') ? savedTeamId : `espn-${savedTeamId}`) : '');
      setExistingFavoriteTeamName(savedTeam?.name || (typeof saved.team === 'object' && saved.team ? saved.team.name : typeof saved.team === 'string' ? saved.team : ''));
      if (saved.shieldConfig) {
        setShieldConfig({ ...DEFAULT_SHIELD, ...saved.shieldConfig });
        setShieldTouched(true);
      }
      if (saved.avatarConfig) {
        setAvatarConfig(normalizeAvatarConfig(saved.avatarConfig));
        setAvatarTouched(true);
      }
    } catch {
      setMessage('Não consegui carregar seu perfil e os times. Confira a conexão e tente novamente.');
    } finally {
      setReady(true);
    }
  }), [router]);

  async function loadEspnCatalog() {
    setEspnCatalogLoading(true);
    setEspnCatalogError(false);
    try {
      const catalog = await getEspnClubCatalog();
      setEspnClubCatalog(catalog);
      setBaseTeamId((current) => {
        if (catalog.some((club) => `espn-${club.id}` === current)) return current;
        const savedClub = catalog.find((club) => normalize(club.name) === normalize(existingFavoriteTeamName));
        return savedClub ? `espn-${savedClub.id}` : '';
      });
    } catch {
      setEspnCatalogError(true);
    } finally {
      setEspnCatalogLoading(false);
    }
  }

  function updateShield(key, value) {
    setShieldConfig((current) => ({ ...current, [key]: value }));
    setShieldTouched(true);
    setMessage('');
  }

  function updateAvatarPart(layer, id) {
    setAvatarConfig((current) => replaceAvatarPart(current, layer, id));
    setAvatarTouched(true);
    setMessage('');
  }

  function updateAvatarSetting(key, value) {
    setAvatarConfig((current) => ({ ...current, [key]: value }));
    setAvatarTouched(true);
    setMessage('');
  }

  function updateAvatarParts(ids) {
    setAvatarConfig((current) => ids.reduce((next, id) => {
      const layer = Object.entries(AVATAR_LAYERS).find(([, prefix]) => id.startsWith(prefix))?.[0];
      return layer ? replaceAvatarPart(next, layer, id) : next;
    }, current));
    setAvatarTouched(true);
    setMessage('');
  }

  function updateAvatarColor(token, value) {
    setAvatarConfig((current) => setAvatarColor(current, token, value));
    setAvatarTouched(true);
    setMessage('');
  }

  function toggleAvatarItem(id) {
    setAvatarConfig((current) => toggleAvatarAccessory(current, id));
    setAvatarTouched(true);
    setMessage('');
  }

  function setAvatarPresentation(presentation) {
    setAvatarConfig((current) => {
      const body = current.parts.find((part) => part.startsWith('body-')) || 'body-athletic';
      const bodyType = body.replace('body-', '').replace('feminine-', '');
      const head = current.parts.find((part) => part.startsWith('head-')) || 'head-round';
      const faceShape = head.replace('head-', '').replace('feminine-', '');
      const feminine = presentation === 'feminino';
      const nextBody = `body-${feminine ? 'feminine-' : ''}${bodyType}`;
      const nextShape = feminine ? 'oval' : faceShape === 'angular' ? 'square' : faceShape;
      const nextFace = `head-${feminine ? 'feminine-' : ''}${nextShape}`;
      let next = replaceAvatarPart(replaceAvatarPart(current, 'body', nextBody), 'head', nextFace);
      next = replaceAvatarPart(next, 'eyes', feminine ? 'eyes-lashes' : 'eyes-round');
      next = replaceAvatarPart(next, 'brows', feminine ? 'brows-arched' : 'brows-natural');
      return next;
    });
    setAvatarTouched(true);
    setMessage('');
  }

  async function nextStep() {
    setMessage('');
    if (step === 0 && fullName.trim().split(/\s+/).length < 2) return setMessage('Coloque nome e sobrenome para a turma te identificar.');
    if (step === 1 && clubName.trim().length < 2) return setMessage('Dê um nome para o seu time.');
    if (step === 1) {
      setStep(2);
      if (!espnClubCatalog.length) await loadEspnCatalog();
      return;
    }
    if (step === 2 && !baseTeam) return setMessage('Escolha o seu time do coração para continuar.');
    if (step === 3) {
      if (!formulaTeamId) return setMessage('Selecione uma escuderia para continuar.');
      if (formulaTeamLocked && formulaTeamId !== existingFormulaTeamId) return setMessage('As escuderias estão bloqueadas desde o início da temporada. Peça ao administrador para revisar sua atribuição.');
      try {
        const occupied = await getFormulaTeamOccupancy(formulaTeamId, auth.currentUser?.uid);
        if (occupied >= 2 && existingFormulaTeamId !== formulaTeamId) {
          return setMessage('Essa escuderia já tem dois pilotos. Escolha outra para garantir sua vaga.');
        }
      } catch {
        return setMessage('Não consegui confirmar as vagas agora. Tente novamente em instantes.');
      }
    }
    if (step === 4 && !shieldTouched) return setMessage('Mude pelo menos uma opção para criar seu escudo.');
    if (step === 5 && !avatarTouched) return setMessage('Escolha uma opção para personalizar seu avatar.');
    const user = auth.currentUser;
    if (user) {
      const draft = { name: fullName.trim().replace(/\s+/g, ' '), updatedAt: getEpochTimestamp() };
      if (step >= 1) draft.customTeamName = clubName.trim().replace(/\s+/g, ' ');
      if (step >= 2 && baseTeam) draft.favoriteTeam = { id: baseTeam.espnId, name: baseTeam.name, logo: baseTeam.logo || '', abbreviation: baseTeam.abbreviation || '', source: 'espn' };
      if (step >= 3) draft.formulaDepreTeamId = formulaTeamId;
      if (step >= 4) draft.shieldConfig = { ...shieldConfig, showAbbr: shieldConfig.showAbbr !== false };
      if (step >= 5) draft.avatarConfig = avatarConfig;
      try {
        await update(ref(database, `users/${user.uid}`), draft);
      } catch {
        return setMessage('Não consegui guardar seu progresso agora. Verifique a conexão e tente continuar de novo.');
      }
    }
    setStep((current) => Math.min(current + 1, 6));
  }

  async function confirmProfile() {
    const user = auth.currentUser;
    if (!user || !formulaTeamId || !baseTeam || !shieldTouched || !avatarTouched) return;
    const timestamp = getEpochTimestamp();
    setBusy(true);
    setMessage('');
    try {
      if (formulaTeamLocked && formulaTeamId !== existingFormulaTeamId) {
        setMessage('As escuderias estão bloqueadas desde o início da temporada. Peça ao administrador para revisar sua atribuição.');
        setStep(3);
        return;
      }
      const occupied = await getFormulaTeamOccupancy(formulaTeamId, user.uid);
      if (occupied >= 2 && existingFormulaTeamId !== formulaTeamId) {
        setMessage('Essa escuderia acabou de ficar sem vagas. Escolha outra antes de confirmar.');
        setStep(3);
        return;
      }
      await update(ref(database, `users/${user.uid}`), {
        name: fullName.trim().replace(/\s+/g, ' '),
        customTeamName: clubName.trim().replace(/\s+/g, ' '),
        favoriteTeam: baseTeam ? { id: baseTeam.espnId, name: baseTeam.name, logo: baseTeam.logo || '', abbreviation: baseTeam.abbreviation || '', source: 'espn' } : existingFavoriteTeam,
        formulaDepreTeamId: formulaTeamId,
        useCustomShield: true,
        shieldConfig: { ...shieldConfig, showAbbr: shieldConfig.showAbbr !== false },
        avatarConfig,
        onboardingComplete: true,
        profileCompletedAt: timestamp,
        updatedAt: timestamp,
      });
      markProfileSetupComplete();
      setCanLeave(true);
    } catch {
      setMessage('Não foi possível salvar seu perfil. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const formulaTeam = formulaTeams.find(([id]) => id === formulaTeamId);
  const selectableTeams = espnClubCatalog.map((club) => ({ ...club, espnId: club.id, id: `espn-${club.id}` }));
  const baseTeam = selectableTeams.find((team) => team.id === baseTeamId);
  const initials = makeTeamInitials(clubName);
  const visibleTeams = selectableTeams.filter((team) => normalize(team.name).includes(normalize(teamSearch)));
  const avatarBodyId = avatarConfig.parts.find((part) => part.startsWith('body-')) || 'body-athletic';
  const avatarPresentation = avatarBodyId.includes('feminine-') ? 'feminino' : 'masculino';
  const avatarBodyStyle = avatarBodyId.replace('body-', '').replace('feminine-', '');
  const avatarHeadId = avatarConfig.parts.find((part) => part.startsWith('head-')) || 'head-round';
  const avatarHairId = avatarConfig.parts.find((part) => part.startsWith('hair-front-')) || 'hair-front-curly';
  const avatarJerseyId = avatarConfig.parts.find((part) => part.startsWith('jersey-')) || 'jersey-solid';
  const avatarBeardId = avatarConfig.parts.find((part) => part.startsWith('beard-')) || 'beard-none';
  const avatarExpressionId = avatarExpressionOptions.find(([, , parts]) => parts.every((part) => avatarConfig.parts.includes(part)))?.[0] || 'cheerful';
  const avatarBodyOptions = avatarPresentation === 'feminino'
    ? [['body-feminine-slim', 'Leve'], ['body-feminine-athletic', 'Atlética'], ['body-feminine-robust', 'Forte']]
    : [['body-slim', 'Leve'], ['body-athletic', 'Atlético'], ['body-robust', 'Forte']];
  const avatarHeadOptions = avatarPresentation === 'feminino'
    ? [['head-feminine-round', 'Redondo'], ['head-feminine-oval', 'Oval'], ['head-feminine-angular', 'Angular']]
    : [['head-round', 'Redondo'], ['head-oval', 'Oval'], ['head-square', 'Quadrado']];

  if (!ready) return <SafeAreaView style={styles.root}><View style={styles.loading}><ActivityIndicator size="large" color="#A6F16A" /></View></SafeAreaView>;

  return (
    <View style={styles.root}>
      <Image source={STADIUM} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(3,12,33,.82)', 'rgba(4,17,46,.95)', '#06142F']} locations={[0, .45, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topbar}>
          <View style={styles.brand}><CryingBallLogo size={38} animated={false} decorative /><Text style={styles.brandName}>BRASILEIRÃO DA DEPRESSÃO</Text></View>
          <Text style={styles.stepCount}>{step + 1} / {STEPS.length}</Text>
        </View>
        <View style={styles.progressTrack}>{STEPS.map((name, index) => <View key={name} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />)}</View>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.stepEyebrow}>{STEPS[step]}</Text>
            <Text accessibilityRole="header" style={styles.title}>{STEP_TITLES[step]}</Text>
            <Text style={styles.subtitle}>{STEP_COPY[step]}</Text>

            {step === 0 && <TextInput value={fullName} onChangeText={(value) => { setFullName(value); setMessage(''); }} placeholder="Ex.: Elian Souza" placeholderTextColor="#8CA6C3" autoCapitalize="words" autoComplete="name" returnKeyType="next" onSubmitEditing={nextStep} style={styles.input} />}
            {step === 1 && <TextInput value={clubName} onChangeText={(value) => { setClubName(value); setMessage(''); }} placeholder="Ex.: ADM FC" placeholderTextColor="#8CA6C3" autoCapitalize="words" returnKeyType="next" onSubmitEditing={nextStep} style={styles.input} />}

            {step === 2 && (espnCatalogLoading ? <View style={styles.teamCatalogLoading}><ActivityIndicator size="large" color="#A6F16A" /><Text style={styles.teamCatalogLoadingText}>Carregando clubes…</Text></View> : espnCatalogError ? <View style={styles.teamCatalogLoading}><MaterialDesignIcons name="cloud-alert-outline" size={32} color="#FFC46B" /><Text style={styles.teamCatalogErrorText}>Não consegui carregar os clubes agora.</Text><Pressable accessibilityRole="button" onPress={loadEspnCatalog} style={styles.teamCatalogRetry}><Text style={styles.teamCatalogRetryText}>TENTAR DE NOVO</Text></Pressable></View> : <View style={styles.clubPicker}>
              <TextInput value={teamSearch} onChangeText={setTeamSearch} placeholder="Buscar clube" placeholderTextColor="#8CA6C3" style={styles.searchInput} />
              <View style={styles.clubList}>
                {visibleTeams.map((team) => {
                  const selected = baseTeamId === team.id;
                  return <Pressable key={team.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setBaseTeamId(team.id); setMessage(''); }} style={[styles.clubOption, selected && styles.clubOptionSelected]}>
                    <ClubBadge team={{ ...team, image: team.logo }} />
                    <Text numberOfLines={1} style={styles.clubOptionName}>{team.name}</Text>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
                  </Pressable>;
                })}
                {!visibleTeams.length && <Text style={styles.emptyTeams}>Nenhum clube encontrado.</Text>}
              </View>
            </View>)}

            {step === 3 && <><FormulaCarousel teams={formulaTeams} selected={formulaTeamId} existingTeamId={existingFormulaTeamId} locked={formulaTeamLocked} onSelect={(id) => { setFormulaTeamId(id); setMessage(''); }} />{formulaTeamLocked && <Text style={styles.availabilityError}>ESCUDERIA DEFINIDA PARA 2027 · ALTERAÇÕES BLOQUEADAS</Text>}</>}

            {step === 4 && <View style={styles.builderArea}>
              <View style={styles.crestPreview}>
                <View style={styles.previewHeading}><Text style={styles.previewTitle}>{clubName.trim() || 'SEU TIME'}</Text><Text style={styles.previewLive}>AO VIVO</Text></View>
                <PlayerCrest config={shieldConfig} initials={initials} size={158} />
                <Text style={styles.previewCaption}>PRÉVIA DO SEU ESCUDO</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shieldTabs}>
                {shieldTabs.map(([key, label, icon]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: shieldTab === key }} onPress={() => setShieldTab(key)} style={[styles.shieldTab, shieldTab === key && styles.shieldTabActive]}><MaterialDesignIcons name={icon} size={16} color={shieldTab === key ? '#102B25' : '#C0D1E2'} /><Text style={[styles.shieldTabText, shieldTab === key && styles.shieldTabTextActive]}>{label}</Text></Pressable>)}
              </ScrollView>
              {shieldTab === 'symbol' && <View style={styles.editorSection}>
                <Text style={styles.editorTitle}>Escolha o símbolo central</Text>
                <CrestIconChoices options={shieldIcons} value={shieldConfig.selectedIcon} onChange={(value) => updateShield('selectedIcon', value)} color={shieldConfig.colorIcon || '#FFFFFF'} />
                <OptionSection label="BASE DO EMBLEMA"><ChoiceChips options={[["disc", "Medalha"], ["ribbon", "Faixa"], ["none", "Sem base"]]} value={shieldConfig.iconBacking || 'disc'} onChange={(value) => updateShield('iconBacking', value)} /></OptionSection>
                <OptionSection label="TAMANHO DO SÍMBOLO"><ChoiceChips options={[["small", "Menor"], ["normal", "Padrão"], ["large", "Maior"]]} value={shieldConfig.iconScale || 'normal'} onChange={(value) => updateShield('iconScale', value)} /></OptionSection>
              </View>}
              {shieldTab === 'shape' && <View style={styles.editorSection}><Text style={styles.editorTitle}>Silhueta</Text><CrestShapeChoices options={shieldShapes} value={shieldConfig.shape} onChange={(value) => updateShield('shape', value)} config={shieldConfig} /></View>}
              {shieldTab === 'pattern' && <View style={styles.editorSection}><Text style={styles.editorTitle}>Pintura e faixas</Text><CrestPatternChoices options={shieldPatterns} value={shieldConfig.pattern} onChange={(value) => updateShield('pattern', value)} config={shieldConfig} /></View>}
              {shieldTab === 'colors' && <View style={styles.editorSection}>
                <Text style={styles.editorTitle}>Monte a paleta do seu clube</Text>
                <OptionSection label="COR PRINCIPAL"><ColorChoices colors={crestPalette} value={shieldConfig.colorPrimary} onChange={(value) => updateShield('colorPrimary', value)} /></OptionSection>
                <OptionSection label="COR DA PINTURA"><ColorChoices colors={crestPalette} value={shieldConfig.colorSecondary} onChange={(value) => updateShield('colorSecondary', value)} /></OptionSection>
                {shieldConfig.pattern === 'tricolor' && <OptionSection label="COR DA 3ª FAIXA"><ColorChoices colors={crestPalette} value={shieldConfig.colorTertiary || '#F2C94C'} onChange={(value) => updateShield('colorTertiary', value)} /></OptionSection>}
                <OptionSection label="CONTORNO"><ColorChoices colors={trimPalette} value={shieldConfig.colorBorder} onChange={(value) => updateShield('colorBorder', value)} /></OptionSection>
                <OptionSection label="SÍMBOLO"><ColorChoices colors={crestPalette} value={shieldConfig.colorIcon || '#FFFFFF'} onChange={(value) => updateShield('colorIcon', value)} /></OptionSection>
              </View>}
              {shieldTab === 'details' && <View style={styles.editorSection}>
                <Text style={styles.editorTitle}>Acabamento de competição</Text>
                <OptionSection label="ORNAMENTO"><ChoiceChips options={crestOrnaments} value={shieldConfig.ornament || 'none'} onChange={(value) => updateShield('ornament', value)} /></OptionSection>
                <OptionSection label="CONTORNO"><ChoiceChips options={crestBorderStyles} value={shieldConfig.borderStyle || 'classic'} onChange={(value) => updateShield('borderStyle', value)} /></OptionSection>
                <OptionSection label="BRILHO"><ChoiceChips options={[["gloss", "Verniz"], ["matte", "Fosco"]]} value={shieldConfig.finish || 'gloss'} onChange={(value) => updateShield('finish', value)} /></OptionSection>
              </View>}
              {shieldTab === 'type' && <View style={styles.editorSection}>
                <Text style={styles.editorTitle}>As iniciais na faixa</Text>
                <TextInput accessibilityLabel="Iniciais do escudo" value={shieldConfig.abbrText ?? initials} onChangeText={(value) => updateShield('abbrText', value.toUpperCase().slice(0, 4))} autoCapitalize="characters" maxLength={4} style={styles.crestInitialsInput} />
                <ChoiceChips options={crestLetters} value={shieldConfig.letterStyle || 'varsity'} onChange={(value) => updateShield('letterStyle', value)} />
                <OptionSection label="COR DAS INICIAIS"><ColorChoices colors={trimPalette} value={shieldConfig.colorText || '#08182D'} onChange={(value) => updateShield('colorText', value)} /></OptionSection>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: shieldConfig.showAbbr !== false }} onPress={() => updateShield('showAbbr', shieldConfig.showAbbr === false)} style={styles.toggleRow}><Text style={styles.toggleLabel}>Mostrar iniciais no escudo</Text><View style={[styles.toggleTrack, shieldConfig.showAbbr !== false && styles.toggleTrackOn]}><View style={[styles.toggleKnob, shieldConfig.showAbbr !== false && styles.toggleKnobOn]} /></View></Pressable>
              </View>}
            </View>}

            {step === 5 && <View style={styles.avatarBuilder}>
              <View style={styles.avatarPreview}>
                <View style={styles.avatarPreviewTop}><Text numberOfLines={1} style={styles.avatarPreviewName}>{fullName.trim().split(/\s+/)[0]?.toUpperCase() || 'SEU JOGADOR'}</Text><Text style={styles.avatarPreviewStatus}>PRÉVIA DO ELENCO</Text></View>
                <View style={styles.avatarFigureStage}><PlayerAvatar config={avatarConfig} crestConfig={shieldConfig} initials={initials} size={150} /></View>
                <Text style={styles.previewCaption}>SEU JOGADOR, SEU MANTO</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarTabs}>
                {avatarTabs.map(([key, label, icon]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: avatarEditorTab === key }} onPress={() => setAvatarEditorTab(key)} style={[styles.avatarTab, avatarEditorTab === key && styles.avatarTabActive]}><MaterialDesignIcons name={icon} size={17} color={avatarEditorTab === key ? '#102B25' : '#C0D1E2'} /><Text style={[styles.avatarTabText, avatarEditorTab === key && styles.avatarTabTextActive]}>{label}</Text></Pressable>)}
              </ScrollView>
              {avatarEditorTab === 'appearance' && <View style={styles.avatarEditorSection}>
                <OptionSection label="APRESENTAÇÃO"><ChoiceChips options={[["masculino", "Masculina"], ["feminino", "Feminina"]]} value={avatarPresentation} onChange={setAvatarPresentation} /></OptionSection>
                <OptionSection label="PORTE"><ChoiceChips options={avatarBodyOptions} value={avatarBodyId} onChange={(value) => updateAvatarPart('body', value)} /></OptionSection>
                <OptionSection label="FORMATO DO ROSTO"><ChoiceChips options={avatarHeadOptions} value={avatarHeadId} onChange={(value) => updateAvatarPart('head', value)} /></OptionSection>
                <OptionSection label="TOM DE PELE"><ColorChoices colors={avatarSkinPalette} value={avatarConfig.colors.SKIN} onChange={(value) => updateAvatarColor('SKIN', value)} /></OptionSection>
              </View>}
              {avatarEditorTab === 'hair' && <View style={styles.avatarEditorSection}>
                <OptionSection label="CORTE"><AvatarOptionRail options={avatarHairOptions} value={avatarHairId} config={avatarConfig} onSelect={(ids) => updateAvatarParts(ids)} /></OptionSection>
                <OptionSection label="COR DO CABELO"><ColorChoices colors={avatarHairPalette} value={avatarConfig.colors.HAIR} onChange={(value) => updateAvatarColor('HAIR', value)} /></OptionSection>
                <OptionSection label="BARBA E BIGODE"><AvatarOptionRail options={[["none", "Sem barba", "beard-none"], ["mustache", "Bigode", "beard-mustache"], ["short", "Por fazer", "beard-short"], ["full", "Cheia", "beard-full"], ["goatee", "Cavanhaque", "beard-goatee"]]} value={avatarBeardId} config={avatarConfig} onSelect={(ids) => updateAvatarParts(ids)} /></OptionSection>
              </View>}
              {avatarEditorTab === 'expression' && <View style={styles.avatarEditorSection}>
                <OptionSection label="ESCOLHA SUA CARA DE JOGO"><AvatarOptionRail options={avatarExpressionOptions} value={avatarExpressionId} config={avatarConfig} onSelect={(ids) => updateAvatarParts(ids)} /></OptionSection>
                <OptionSection label="OLHOS"><ChoiceChips options={[["eyes-round", "Abertos"], ["eyes-soft", "Suaves"], ["eyes-narrow", "Focados"], ["eyes-happy", "Fechados"], ["eyes-lashes", "Cílios"]]} value={avatarConfig.parts.find((part) => part.startsWith('eyes-')) || 'eyes-round'} onChange={(value) => updateAvatarPart('eyes', value)} /></OptionSection>
                <OptionSection label="SOBRANCELHAS"><ChoiceChips options={[["brows-natural", "Natural"], ["brows-bold", "Marcadas"], ["brows-thin", "Finas"], ["brows-determined", "Determinadas"], ["brows-arched", "Arqueadas"]]} value={avatarConfig.parts.find((part) => part.startsWith('brows-')) || 'brows-natural'} onChange={(value) => updateAvatarPart('brows', value)} /></OptionSection>
                <OptionSection label="NARIZ"><ChoiceChips options={[["nose-small", "Pequeno"], ["nose-round", "Arredondado"], ["nose-wide", "Largo"]]} value={avatarConfig.parts.find((part) => part.startsWith('nose-')) || 'nose-round'} onChange={(value) => updateAvatarPart('nose', value)} /></OptionSection>
                <OptionSection label="BOCA"><ChoiceChips options={[["mouth-smile", "Sorriso"], ["mouth-grin", "Aberta"], ["mouth-neutral", "Neutra"], ["mouth-smirk", "De lado"], ["mouth-lips", "Lábios"]]} value={avatarConfig.parts.find((part) => part.startsWith('mouth-')) || 'mouth-smile'} onChange={(value) => updateAvatarPart('mouth', value)} /></OptionSection>
              </View>}
              {avatarEditorTab === 'uniform' && <View style={styles.avatarEditorSection}>
                <OptionSection label="MODELO DA CAMISA"><AvatarOptionRail options={avatarJerseyOptions} value={avatarJerseyId} config={avatarConfig} onSelect={(ids) => updateAvatarParts(ids)} /></OptionSection>
                <OptionSection label="GOLA"><ChoiceChips options={[["collar-crew", "Redonda"], ["collar-v", "Gola V"], ["collar-polo", "Polo"]]} value={avatarConfig.parts.find((part) => part.startsWith('collar-')) || 'collar-crew'} onChange={(value) => updateAvatarPart('collar', value)} /></OptionSection>
                <OptionSection label="MANGA"><ChoiceChips options={[["short", "Curta"], ["long", "Longa"]]} value={avatarConfig.parts.find((part) => part.startsWith('sleeves-'))?.endsWith('-long') ? 'long' : 'short'} onChange={(value) => updateAvatarPart('sleeves', `sleeves-${avatarPresentation === 'feminino' ? 'feminine-' : ''}${avatarBodyStyle}-${value}`)} /></OptionSection>
                <Pressable accessibilityRole="button" onPress={() => { updateAvatarColor('JERSEY', shieldConfig.colorPrimary); updateAvatarColor('TRIM', shieldConfig.colorSecondary); }} style={styles.matchColorsButton}><MaterialDesignIcons name="palette-outline" size={16} color="#C9F5A3" /><Text style={styles.matchColorsText}>USAR AS CORES DO MEU ESCUDO</Text></Pressable>
                <OptionSection label="COR PRINCIPAL"><ColorChoices colors={kitPalette} value={avatarConfig.colors.JERSEY} onChange={(value) => updateAvatarColor('JERSEY', value)} /></OptionSection>
                <OptionSection label="COR DE DETALHE"><ColorChoices colors={kitPalette} value={avatarConfig.colors.TRIM} onChange={(value) => updateAvatarColor('TRIM', value)} /></OptionSection>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: avatarConfig.showCrest !== false }} onPress={() => { setAvatarConfig((current) => ({ ...current, showCrest: current.showCrest === false })); setAvatarTouched(true); setMessage(''); }} style={styles.toggleRow}><Text style={styles.toggleLabel}>Usar meu escudo no peito</Text><View style={[styles.toggleTrack, avatarConfig.showCrest !== false && styles.toggleTrackOn]}><View style={[styles.toggleKnob, avatarConfig.showCrest !== false && styles.toggleKnobOn]} /></View></Pressable>
                {avatarConfig.showCrest !== false && <>
                  <OptionSection label="POSIÇÃO DO ESCUDO"><ChoiceChips options={[["right", "Peito direito"], ["center", "Centro do peito"]]} value={avatarConfig.crestPosition || 'right'} onChange={(value) => updateAvatarSetting('crestPosition', value)} /></OptionSection>
                  <OptionSection label="TAMANHO DO ESCUDO"><ChoiceChips options={[["small", "Pequeno"], ["normal", "Médio"], ["large", "Grande"]]} value={avatarConfig.crestSize || 'normal'} onChange={(value) => updateAvatarSetting('crestSize', value)} /></OptionSection>
                </>}
                <OptionSection label="PATROCINADOR MASTER · OPCIONAL">
                  <TextInput
                    accessibilityLabel="Texto do patrocinador master"
                    value={avatarConfig.sponsorText || ''}
                    onChangeText={(value) => updateAvatarSetting('sponsorText', value.slice(0, 18))}
                    placeholder="Ex.: NOME DA MARCA"
                    placeholderTextColor="#7892AE"
                    maxLength={18}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    style={styles.input}
                  />
                </OptionSection>
              </View>}
              {avatarEditorTab === 'extras' && <View style={styles.avatarEditorSection}>
                <OptionSection label="ITENS DE ROSTO"><AvatarAccessoryChoices options={[["accessory-headband", "Bandana"], ["accessory-glasses", "Óculos"], ["accessory-freckles", "Sardas"], ["accessory-earrings", "Brincos"], ["accessory-facepaint", "Pintura"]]} selected={avatarConfig.parts} onToggle={toggleAvatarItem} /></OptionSection>
                {avatarConfig.parts.includes('accessory-headband') && <OptionSection label="COR DA BANDANA"><ColorChoices colors={kitPalette} value={avatarConfig.colors.BANDANA} onChange={(value) => updateAvatarColor('BANDANA', value)} /></OptionSection>}
                {avatarConfig.parts.includes('accessory-glasses') && <OptionSection label="COR DA ARMAÇÃO"><ColorChoices colors={kitPalette} value={avatarConfig.colors.GLASSES} onChange={(value) => updateAvatarColor('GLASSES', value)} /></OptionSection>}
                {avatarConfig.parts.includes('accessory-facepaint') && <OptionSection label="COR DA PINTURA"><ColorChoices colors={kitPalette} value={avatarConfig.colors.ITEM} onChange={(value) => updateAvatarColor('ITEM', value)} /></OptionSection>}
                <OptionSection label="MUNHEQUEIRA"><ChoiceChips options={[["wrist-none", "Sem"], ["wrist-athletic", "Esportiva"]]} value={avatarConfig.parts.find((part) => part.startsWith('wrist-')) || 'wrist-none'} onChange={(value) => updateAvatarPart('wrist', value)} /></OptionSection>
                {avatarConfig.parts.includes('wrist-athletic') && <OptionSection label="COR DA MUNHEQUEIRA"><ColorChoices colors={kitPalette} value={avatarConfig.colors.WRIST} onChange={(value) => updateAvatarColor('WRIST', value)} /></OptionSection>}
              </View>}
            </View>}

            {step === 6 && <View style={styles.reviewCard}>
              <View style={styles.reviewArtRow}>
                <View style={styles.reviewArt}><PlayerCrest config={shieldConfig} initials={initials} size={92} /><Text style={styles.artLabel}>ESCUDO</Text></View>
                <View style={styles.reviewArt}><PlayerAvatar config={avatarConfig} crestConfig={shieldConfig} initials={initials} size={88} /><Text style={styles.artLabel}>AVATAR</Text></View>
              </View>
              <View style={styles.reviewFields}>
                <ReviewLine label="JOGADOR" value={fullName.trim() || '—'} />
                <ReviewLine label="TIME" value={clubName.trim() || '—'} />
                <ReviewLine label="TIME DO CORAÇÃO" value={baseTeam?.name || '—'} />
                <ReviewLine label="ESCUDERIA" value={formulaTeam?.[1] || '—'} />
              </View>
              {formulaTeam && <View style={styles.reviewFormula}><FormulaCarBadge color={formulaTeam[2]} size={94} /><Text style={styles.formulaName}>{formulaTeam[1]}</Text></View>}
              <Text style={styles.futureNote}>Você poderá editar nome, time, escudo e avatar nas próximas visitas.</Text>
            </View>}

            {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.actions}>
              {step > 0 && <Pressable accessibilityRole="button" onPress={() => { setMessage(''); setStep((current) => current - 1); }} style={styles.backButton}><BackArrow /><Text style={styles.backText}>VOLTAR</Text></Pressable>}
              <Pressable accessibilityRole="button" disabled={busy} onPress={step === 6 ? confirmProfile : nextStep} style={({ pressed }) => [styles.nextButton, pressed && !busy && styles.nextPressed, busy && styles.nextBusy]}>
                {busy ? <ActivityIndicator color="#092447" /> : <><Text style={styles.nextText}>{step === 6 ? 'CONFIRMAR E ENTRAR' : 'CONTINUAR'}</Text><ForwardArrow color="#092447" /></>}
              </Pressable>
            </View>
            <Text style={styles.lockNote}>PERFIL OBRIGATÓRIO · CONFIRME PARA ENTRAR</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function FormulaCarousel({ teams, selected, existingTeamId, locked, onSelect }) {
  const visibleTeams = locked && existingTeamId ? teams.filter(([id]) => id === existingTeamId) : teams;
  const initialIndex = Math.max(0, visibleTeams.findIndex(([id]) => id === selected));
  const [index, setIndex] = useState(initialIndex);
  const [occupancy, setOccupancy] = useState({});
  const [checking, setChecking] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const occupancyRef = useRef(occupancy);
  const [bob] = useState(() => new Animated.Value(0));
  const [smoke] = useState(() => new Animated.Value(0));
  const [selectionScale] = useState(() => new Animated.Value(1));
  const team = visibleTeams[index];
  const [teamId, name, color] = team || [];
  const checkingTeam = checking && Boolean(teamId) && !locked;
  const currentOccupancy = occupancy[teamId] ?? 0;
  const occupancyKnown = Object.prototype.hasOwnProperty.call(occupancy, teamId);
  const hasSlot = teamId === existingTeamId || (occupancyKnown && currentOccupancy < 2);
  const isSelected = selected === teamId;

  useEffect(() => {
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1050, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1050, useNativeDriver: true }),
    ]));
    const smokeMotion = Animated.loop(Animated.sequence([
      Animated.timing(smoke, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(smoke, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    motion.start();
    smokeMotion.start();
    return () => { motion.stop(); smokeMotion.stop(); };
  }, [bob, smoke]);

  useEffect(() => { occupancyRef.current = occupancy; }, [occupancy]);

  useEffect(() => {
    if (!teamId || locked) return;
    if (occupancyRef.current[teamId] !== undefined) { setChecking(false); return; }
    let live = true;
    setChecking(true);
    setError('');
    getFormulaTeamOccupancy(teamId, auth.currentUser?.uid).then((count) => {
      if (live) setOccupancy((current) => ({ ...current, [teamId]: count }));
      if (!live || count < 2 || teamId === existingTeamId) return;
      (async () => {
        for (let offset = 1; offset < teams.length; offset += 1) {
          const nextIndex = (index + offset) % teams.length;
          const [candidateId] = teams[nextIndex];
          const nextCount = occupancyRef.current[candidateId] ?? await getFormulaTeamOccupancy(candidateId, auth.currentUser?.uid);
          if (!live) return;
          setOccupancy((current) => ({ ...current, [candidateId]: nextCount }));
          if (nextCount < 2 || candidateId === existingTeamId) { setIndex(nextIndex); return; }
        }
        if (live) setError('Todas as escuderias estão sem vagas. Avise o administrador.');
      })().catch(() => { if (live) setError('Não consegui consultar as vagas. Confira a conexão e tente de novo.'); });
    }).catch(() => {
      if (live) setError('Não foi possível consultar as vagas. Tente novamente.');
    }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [teamId, existingTeamId, index, teams, locked]);

  const move = useCallback(async (direction) => {
    if (locked || moving || teams.length < 2) return;
    setMoving(true);
    setError('');
    try {
      for (let offset = 1; offset <= teams.length; offset += 1) {
        const nextIndex = (index + direction * offset + teams.length) % teams.length;
        const [candidateId] = teams[nextIndex];
        let count = occupancy[candidateId];
        if (count === undefined) {
          count = await getFormulaTeamOccupancy(candidateId, auth.currentUser?.uid);
          setOccupancy((current) => ({ ...current, [candidateId]: count }));
        }
        if (candidateId === existingTeamId || count < 2) {
          setIndex(nextIndex);
          return;
        }
      }
      setError('Todas as escuderias estão sem vagas. Avise o administrador.');
    } catch {
      setError('Não consegui consultar as vagas. Confira a conexão e tente de novo.');
    } finally {
      setMoving(false);
    }
  }, [locked, moving, teams, occupancy, index, existingTeamId]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -45) move(1);
      if (gesture.dx > 45) move(-1);
    },
  });
  const carBob = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const smokeOpacity = smoke.interpolate({ inputRange: [0, .25, 1], outputRange: [0, .38, 0] });
  const smokeX = smoke.interpolate({ inputRange: [0, 1], outputRange: [6, -45] });
  const smokeY = smoke.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return <View style={styles.formulaCarousel}>
    <View style={styles.formulaCarouselTop}>
      <Text style={styles.formulaIndex}>{String(index + 1).padStart(2, '0')} <Text style={styles.formulaOf}>/ {String(teams.length).padStart(2, '0')}</Text></Text>
      <View style={styles.formulaTopRight}>
        <Text style={[styles.formulaChoiceState, isSelected && styles.formulaChoiceStateSelected]}>{isSelected ? 'SUA ESCUDERIA' : 'PRÉVIA'}</Text>
        <View style={styles.carouselDots}>{teams.map(([id], dotIndex) => <View key={id} style={[styles.carouselDot, index === dotIndex && { backgroundColor: color }]} />)}</View>
      </View>
    </View>
    <View style={styles.formulaTrack} {...panResponder.panHandlers}>
      <View style={styles.trackBackdrop} />
      <View style={styles.trackLaneLine} />
      <View style={[styles.trackAccent, { backgroundColor: color }]} />
      <Animated.View pointerEvents="none" style={[styles.smokePuff, { opacity: smokeOpacity, transform: [{ translateX: smokeX }, { translateY: smokeY }] }]} />
      <Animated.View style={{ transform: [{ translateY: carBob }] }}>
        <FormulaCarBadge color={color || '#2563eb'} size={250} />
      </Animated.View>
      <Text style={styles.swipeHint}>DESLIZE PARA TROCAR</Text>
    </View>
    <View style={styles.formulaTeamInfo}>
      <View style={styles.teamTitleBlock}>
        <Text style={styles.teamMeta}>ESCUDERIA {String(index + 1).padStart(2, '0')}</Text>
        <Text numberOfLines={1} accessibilityRole="header" style={styles.carouselTeamName}>{name}</Text>
      </View>
      <View style={[styles.teamColorMark, { backgroundColor: color }]} />
    </View>
    <View style={styles.teamAvailability}>
      {checkingTeam ? <><ActivityIndicator size="small" color="#A6F16A" /><Text style={styles.availabilityText}>CONSULTANDO VAGAS</Text></> : <>
        <View style={[styles.availabilityLight, { backgroundColor: hasSlot ? '#A6F16A' : '#F08B73' }]} />
        <Text style={[styles.availabilityText, !hasSlot && styles.availabilityUnavailable]}>{error ? 'VAGAS NÃO CONFIRMADAS' : hasSlot ? `DISPONÍVEL · ${Math.max(0, 2 - currentOccupancy)} VAGA${2 - currentOccupancy === 1 ? '' : 'S'}` : 'INDISPONÍVEL · EQUIPE COMPLETA'}</Text>
      </>}
    </View>
    <Text style={styles.formulaSaveHint}>{isSelected ? 'Escolhida nesta ficha; será gravada ao confirmar o perfil.' : 'Prévia da equipe. Toque para escolhê-la nesta ficha.'}</Text>
    <View style={styles.carouselControls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Escuderia anterior" disabled={moving || locked} onPress={() => move(-1)} style={[styles.carouselArrow, (moving || locked) && styles.controlDisabled]}><BackArrow /></Pressable>
      <Animated.View style={[styles.selectTeamWrap, { transform: [{ scale: selectionScale }] }]}>
        <Pressable accessibilityRole="button" disabled={!hasSlot || checkingTeam || moving} onPress={() => {
          if (!teamId || !hasSlot || checkingTeam) return;
          selectionScale.setValue(.94);
          Animated.spring(selectionScale, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }).start();
          onSelect(teamId);
        }} style={[styles.selectTeamButton, (!hasSlot || checkingTeam || moving) && styles.selectTeamDisabled, isSelected && styles.selectTeamChosen]}>
          {checkingTeam ? <ActivityIndicator color="#092447" /> : <Text style={styles.selectTeamText}>{locked ? 'ESCUDERIA DEFINIDA PARA 2027' : isSelected ? 'ESCOLHIDA PARA ESTA FICHA' : hasSlot ? 'ESCOLHER ESTA ESCUDERIA' : 'SEM VAGAS'}</Text>}
        </Pressable>
      </Animated.View>
      <Pressable accessibilityRole="button" accessibilityLabel="Próxima escuderia" disabled={moving || locked} onPress={() => move(1)} style={[styles.carouselArrow, (moving || locked) && styles.controlDisabled]}><ForwardArrow /></Pressable>
    </View>
    {!!error && <Text accessibilityLiveRegion="polite" style={styles.availabilityError}>{error}</Text>}
  </View>;
}

async function getFormulaTeamOccupancy(teamId, currentUid) {
  if (!teamId) return 0;
  if (!formulaUsersCache) {
    formulaUsersRequest ||= get(ref(database, 'users')).then((snapshot) => {
      formulaUsersCache = snapshot.val() || {};
      return formulaUsersCache;
    }).catch((error) => {
      formulaUsersRequest = null;
      throw error;
    });
    await formulaUsersRequest;
  }
  const users = formulaUsersCache || {};
  return Object.entries(users).filter(([uid, user]) => uid !== currentUid && user?.formulaDepreTeamId === teamId).length;
}

function ClubBadge({ team }) {
  if (team.image) return <Image source={{ uri: team.image }} resizeMode="contain" style={styles.clubBadge} />;
  return <View style={styles.clubBadgeFallback}><Text style={styles.clubInitial}>{makeTeamInitials(team.name).slice(0, 2)}</Text></View>;
}

async function getEspnClubCatalog() {
  if (!espnClubCatalogRequest) {
    espnClubCatalogRequest = fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/teams')
      .then((response) => {
        if (!response.ok) throw new Error('ESPN teams request failed');
        return response.json();
      })
      .then((payload) => {
        const entries = payload?.sports?.[0]?.leagues?.[0]?.teams || [];
        const catalog = entries.map(({ team }) => ({
          id: String(team?.id || ''),
          name: team?.displayName || team?.name || team?.location || '',
          aliases: [team?.name, team?.location, team?.shortDisplayName, team?.abbreviation].filter(Boolean),
          logo: team?.logos?.find((logo) => logo?.rel?.includes('default'))?.href || team?.logos?.[0]?.href || null,
        })).filter((team) => team.id && team.name && team.logo);
        if (!catalog.length) throw new Error('Empty ESPN team catalog');
        return catalog;
      })
      .catch((error) => {
        espnClubCatalogRequest = null;
        throw error;
      });
  }
  return espnClubCatalogRequest;
}

function OptionSection({ label, children }) {
  return <View style={styles.optionSection}><Text style={styles.optionTitle}>{label}</Text>{children}</View>;
}

function CrestShapeChoices({ options, value, onChange, config }) {
  return <View style={styles.crestChoiceGrid}>{options.map(([key, label]) => {
    const selected = value === key;
    return <Pressable key={key} accessibilityRole="radio" accessibilityLabel={`Formato ${label}`} accessibilityState={{ checked: selected }} onPress={() => onChange(key)} style={[styles.crestChoiceTile, selected && styles.crestChoiceTileSelected]}>
      <CrestMiniature shape={key} pattern={config.pattern} colorPrimary={config.colorPrimary} colorSecondary={config.colorSecondary} colorTertiary={config.colorTertiary} colorBorder={config.colorBorder} selected={selected} size={38} />
      <Text numberOfLines={1} style={[styles.crestChoiceLabel, selected && styles.crestChoiceLabelSelected]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function CrestPatternChoices({ options, value, onChange, config }) {
  return <View style={styles.crestChoiceGrid}>{options.map(([key, label]) => {
    const selected = value === key;
    return <Pressable key={key} accessibilityRole="radio" accessibilityLabel={`Pintura ${label}`} accessibilityState={{ checked: selected }} onPress={() => onChange(key)} style={[styles.crestChoiceTile, selected && styles.crestChoiceTileSelected]}>
      <CrestMiniature shape={config.shape} pattern={key} colorPrimary={config.colorPrimary} colorSecondary={config.colorSecondary} colorTertiary={config.colorTertiary} colorBorder={config.colorBorder} selected={selected} size={38} />
      <Text numberOfLines={1} style={[styles.crestChoiceLabel, selected && styles.crestChoiceLabelSelected]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function CrestIconChoices({ options, value, onChange, color }) {
  const selectedValue = legacyCrestIconNames[value] || value;
  return <View style={styles.crestIconGrid}>{options.map(([key, label]) => {
    const selected = selectedValue === key;
    return <Pressable key={key} accessibilityRole="radio" accessibilityLabel={`Símbolo ${label}`} accessibilityState={{ checked: selected }} onPress={() => onChange(key)} style={[styles.crestIconOption, selected && styles.crestIconOptionSelected]}>
      <CrestGlyph name={key} color={selected ? '#F2C94C' : color} size={30} />
      <Text numberOfLines={1} style={[styles.crestIconLabel, selected && styles.crestIconLabelSelected]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function ChoiceChips({ options, value, onChange }) {
  return <View style={styles.choiceChips}>{options.map(([key, label]) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: value === key }} onPress={() => onChange(key)} style={[styles.choiceChip, value === key && styles.choiceChipSelected]}><Text style={[styles.choiceChipText, value === key && styles.choiceChipTextSelected]}>{label}</Text></Pressable>)}</View>;
}

function ColorChoices({ colors, value, onChange }) {
  return <View style={styles.colorChoices}>{colors.map((color) => <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`Cor ${color}`} accessibilityState={{ checked: value === color }} onPress={() => onChange(color)} style={[styles.colorChoice, { backgroundColor: color }, value === color && styles.colorChoiceSelected]} />)}</View>;
}

function AvatarOptionRail({ options, value, config, onSelect }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarOptionRail}>
    {options.map(([key, label, selection]) => {
      const ids = Array.isArray(selection) ? selection : selection ? [selection] : [];
      const previewConfig = ids.reduce((current, id) => {
        const layer = Object.entries(AVATAR_LAYERS).find(([, prefix]) => id.startsWith(prefix))?.[0];
        return layer ? replaceAvatarPart(current, layer, id) : current;
      }, config);
      const selected = (ids.length > 0 && ids.every((id) => config.parts.includes(id))) || value === key || value === selection;
      return <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={() => onSelect(ids)} style={[styles.avatarOptionCard, selected && styles.avatarOptionCardSelected]}>
        <PlayerAvatar config={{ ...previewConfig, showCrest: false }} size={60} />
        <Text numberOfLines={1} style={[styles.avatarOptionLabel, selected && styles.avatarOptionLabelSelected]}>{label}</Text>
        {selected && <MaterialDesignIcons name="check-circle" size={13} color="#A6F16A" style={styles.avatarOptionCheck} />}
      </Pressable>;
    })}
  </ScrollView>;
}

function AvatarAccessoryChoices({ options, selected = [], onToggle }) {
  return <View style={styles.choiceChips}>{options.map(([id, label]) => {
    const active = selected.includes(id);
    return <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => onToggle(id)} style={[styles.choiceChip, active && styles.choiceChipSelected]}>
      <MaterialDesignIcons name={active ? 'check-circle' : 'plus-circle-outline'} size={15} color={active ? '#C9F5A3' : '#AFC3D8'} />
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextSelected]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function ReviewLine({ label, value }) {
  return <View style={styles.reviewLine}><Text style={styles.reviewLabel}>{label}</Text><Text numberOfLines={2} style={styles.reviewValue}>{value}</Text></View>;
}

function BackArrow() {
  return <Svg width="18" height="18" viewBox="0 0 18 18"><Path d="m11.5 3.5-5.5 5.5 5.5 5.5M6 9h10" stroke="#DCE9F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function ForwardArrow({ color = '#DCE9F8' }) {
  return <Svg width="19" height="19" viewBox="0 0 19 19"><Path d="M3 9.5h12m-5-5 5 5-5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function getEpochTimestamp() {
  return Date.now();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071735' },
  safe: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 7, paddingBottom: 6 },
  flex: { flex: 1 },
  contentScroll: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071735' },
  topbar: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { maxWidth: 195, color: '#EEF5FF', fontSize: 10, letterSpacing: .7, fontWeight: '900' },
  stepCount: { color: '#C9D8E9', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressTrack: { flexDirection: 'row', gap: 4, marginTop: 9, marginBottom: 16 },
  progressSegment: { flex: 1, height: 4, borderRadius: 3, backgroundColor: 'rgba(190,213,237,.2)' },
  progressSegmentActive: { backgroundColor: '#A6F16A' },
  scroll: { flexGrow: 1, paddingTop: 5, paddingBottom: 24 },
  stepEyebrow: { color: '#B4EF76', fontSize: 9, letterSpacing: 1.5, fontWeight: '900' },
  title: { color: '#FFFFFF', fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 7 },
  subtitle: { color: '#C1D2E6', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 17 },
  input: { minHeight: 56, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#5680A8', borderBottomWidth: 4, borderBottomColor: '#0A2344', color: '#FFFFFF', backgroundColor: 'rgba(7,29,62,.88)', fontSize: 16, fontWeight: '700' },
  clubPicker: { gap: 9 },
  teamCatalogLoading: { minHeight: 265, alignItems: 'center', justifyContent: 'center', gap: 13, borderRadius: 18, borderWidth: 1, borderColor: '#284C72', backgroundColor: 'rgba(7,29,62,.72)' },
  teamCatalogLoadingText: { color: '#D8E7F7', fontSize: 13, fontWeight: '800' },
  teamCatalogErrorText: { color: '#F0D6B5', fontSize: 13, fontWeight: '700' },
  teamCatalogRetry: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#A6F16A' },
  teamCatalogRetryText: { color: '#102B25', fontSize: 10, fontWeight: '900', letterSpacing: .6 },
  searchInput: { minHeight: 46, color: '#FFFFFF', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#385E82', backgroundColor: '#0A2243', fontSize: 13 },
  clubList: { gap: 7 },
  clubOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#254566', backgroundColor: 'rgba(9,32,65,.9)', marginBottom: 7 },
  clubOptionSelected: { backgroundColor: '#103852', borderColor: '#A6F16A' },
  clubBadge: { width: 36, height: 36, borderRadius: 18 },
  clubBadgeFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#18436A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6490B7' },
  clubInitial: { color: '#D9EDFF', fontSize: 10, fontWeight: '900' },
  clubOptionName: { flex: 1, color: '#F1F6FD', fontSize: 12, fontWeight: '800' },
  emptyTeams: { color: '#FFD58A', padding: 14, textAlign: 'center' },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: '#8CA7C2', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#A6F16A' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#A6F16A' },
  formulaCarousel: { borderRadius: 19, padding: 12, backgroundColor: 'rgba(7,26,53,.94)', borderWidth: 1, borderColor: '#31577D', borderBottomWidth: 4, borderBottomColor: '#06152B', overflow: 'hidden' },
  formulaCarouselTop: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formulaTopRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  formulaChoiceState: { color: '#AFC4DD', fontSize: 8, letterSpacing: .65, fontWeight: '900' },
  formulaChoiceStateSelected: { color: '#C8FFA3' },
  formulaIndex: { color: '#F2F7FE', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  formulaOf: { color: '#829CB9', fontWeight: '700' },
  carouselDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  carouselDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#47627E' },
  formulaTrack: { height: 230, borderRadius: 13, marginTop: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#0B2442' },
  trackBackdrop: { position: 'absolute', left: -40, right: -40, bottom: 13, height: 96, borderTopWidth: 2, borderColor: 'rgba(224,239,255,.24)', backgroundColor: '#101C2B', transform: [{ rotate: '-5deg' }] },
  trackLaneLine: { position: 'absolute', left: -22, right: -22, bottom: 58, height: 2, backgroundColor: 'rgba(235,243,250,.32)', transform: [{ rotate: '-5deg' }] },
  trackAccent: { position: 'absolute', width: '60%', height: 2, left: 25, bottom: 26, opacity: .9, transform: [{ rotate: '-5deg' }] },
  smokePuff: { position: 'absolute', width: 28, height: 16, borderRadius: 18, left: '27%', top: '57%', backgroundColor: '#D9E8F5' },
  swipeHint: { position: 'absolute', bottom: 8, right: 10, color: '#8EA5BE', fontSize: 7, letterSpacing: 1, fontWeight: '900' },
  formulaTeamInfo: { minHeight: 59, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, paddingTop: 5 },
  teamTitleBlock: { flex: 1, gap: 3 },
  teamMeta: { color: '#A8C1D9', fontSize: 8, letterSpacing: 1.2, fontWeight: '900' },
  carouselTeamName: { color: '#FFFFFF', fontSize: 21, lineHeight: 25, fontWeight: '900' },
  teamColorMark: { width: 8, height: 34, borderRadius: 3, marginLeft: 12 },
  teamAvailability: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 9, backgroundColor: 'rgba(255,255,255,.06)' },
  availabilityLight: { width: 7, height: 7, borderRadius: 4 },
  availabilityText: { flex: 1, color: '#CDE5C0', fontSize: 8, letterSpacing: .55, fontWeight: '900' },
  availabilityUnavailable: { color: '#FFB2A1' },
  availabilityError: { color: '#FFD58A', fontSize: 10, lineHeight: 15, marginTop: 8 },
  formulaSaveHint: { color: '#AFC4D9', fontSize: 9, lineHeight: 13, marginTop: 6, paddingHorizontal: 2 },
  carouselControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  carouselArrow: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#416486', backgroundColor: '#102D50' },
  controlDisabled: { opacity: .5 },
  selectTeamWrap: { flex: 1 },
  selectTeamButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#A6F16A', borderWidth: 1, borderColor: '#D1FFA2', borderBottomWidth: 4, borderBottomColor: '#4B9E42' },
  selectTeamChosen: { backgroundColor: '#D7F8B9' },
  selectTeamDisabled: { opacity: .48, backgroundColor: '#91A3B7', borderColor: '#BAC5D0', borderBottomColor: '#536274' },
  selectTeamText: { color: '#092447', fontSize: 9, letterSpacing: .2, fontWeight: '900' },
  builderArea: { gap: 12 },
  crestPreview: { minHeight: 250, paddingVertical: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B2749', borderWidth: 1, borderColor: '#345A7C' },
  previewHeading: { width: '100%', minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  previewTitle: { color: '#EAF3FC', fontSize: 12, fontWeight: '900' },
  previewLive: { color: '#9DB5CD', fontSize: 7, letterSpacing: 1, fontWeight: '900' },
  shieldTabs: { gap: 7, paddingRight: 10 },
  shieldTab: { minHeight: 38, minWidth: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0B2345' },
  shieldTabActive: { backgroundColor: '#C7F49F', borderColor: '#E2FFD0' },
  shieldTabText: { color: '#C0D1E2', fontSize: 10, fontWeight: '800' },
  shieldTabTextActive: { color: '#102B25', fontWeight: '900' },
  editorSection: { gap: 12, padding: 13, borderRadius: 14, backgroundColor: 'rgba(10,34,69,.82)', borderWidth: 1, borderColor: '#29496B' },
  editorTitle: { color: '#F3F7FD', fontSize: 14, fontWeight: '900' },
  crestIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'space-between' },
  crestIconOption: { width: '23.5%', minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 10, borderWidth: 1, borderColor: '#2B4C70', backgroundColor: '#0A1F3B' },
  crestIconOptionSelected: { borderColor: '#F2C94C', backgroundColor: '#123653' },
  crestIconLabel: { maxWidth: '100%', color: '#AFC3D8', fontSize: 8, fontWeight: '700' },
  crestIconLabelSelected: { color: '#FFF1B4', fontWeight: '900' },
  crestChoiceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  crestChoiceTile: { width: '31.8%', minHeight: 83, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: 11, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0A1F3B' },
  crestChoiceTileSelected: { borderColor: '#55799D', backgroundColor: '#123451' },
  crestChoiceLabel: { maxWidth: '100%', color: '#AFC3D8', fontSize: 8, fontWeight: '700' },
  crestChoiceLabelSelected: { color: '#C9F5A3', fontWeight: '900' },
  crestInitialsInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#3D6287', backgroundColor: '#0A1F3B', color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 2 },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: 'rgba(190,213,237,.16)', paddingTop: 8 },
  toggleLabel: { color: '#E4EDF8', fontSize: 12, fontWeight: '700' },
  toggleTrack: { width: 43, height: 24, justifyContent: 'center', paddingHorizontal: 3, borderRadius: 13, backgroundColor: '#49617D' },
  toggleTrackOn: { backgroundColor: '#4A9D5C' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  toggleKnobOn: { alignSelf: 'flex-end' },
  previewCaption: { color: '#E3EEF9', fontSize: 9, letterSpacing: 1, fontWeight: '900', marginTop: 4 },
  optionSection: { gap: 7 },
  optionTitle: { color: '#ACC1D8', fontSize: 9, letterSpacing: 1.1, fontWeight: '900' },
  choiceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#35577A', backgroundColor: '#0B2345' },
  choiceChipSelected: { borderColor: '#A6F16A', backgroundColor: '#164B48' },
  choiceChipText: { color: '#C5D5E6', fontSize: 10, fontWeight: '700' },
  choiceChipTextSelected: { color: '#F4FFE7', fontWeight: '900' },
  colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorChoice: { width: 29, height: 29, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,.35)' },
  colorChoiceSelected: { borderWidth: 3, borderColor: '#FFFFFF', transform: [{ scale: 1.1 }] },
  avatarBuilder: { gap: 11 },
  avatarPreview: { height: 260, borderRadius: 17, backgroundColor: '#0D3158', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', borderWidth: 1, borderColor: '#3D6891' },
  avatarPreviewTop: { position: 'absolute', zIndex: 2, top: 11, left: 13, right: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarPreviewName: { flex: 1, color: '#EFF7FF', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  avatarPreviewStatus: { color: '#B5D4EE', fontSize: 7, letterSpacing: .8, fontWeight: '900' },
  avatarFigureStage: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  avatarTabs: { gap: 7, paddingRight: 10 },
  avatarTab: { minHeight: 39, minWidth: 91, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0B2345' },
  avatarTabActive: { backgroundColor: '#C7F49F', borderColor: '#E2FFD0' },
  avatarTabText: { color: '#C0D1E2', fontSize: 9, fontWeight: '800' },
  avatarTabTextActive: { color: '#102B25', fontWeight: '900' },
  avatarEditorSection: { gap: 13, padding: 13, borderRadius: 14, backgroundColor: 'rgba(10,34,69,.82)', borderWidth: 1, borderColor: '#29496B' },
  avatarOptionRail: { gap: 8, paddingRight: 4 },
  avatarOptionCard: { width: 78, height: 112, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 7, borderRadius: 12, backgroundColor: '#091D38', borderWidth: 1, borderColor: '#2C4D70', overflow: 'hidden' },
  avatarOptionCardSelected: { borderColor: '#A6F16A', backgroundColor: '#12394F' },
  avatarOptionLabel: { maxWidth: '100%', color: '#C4D4E5', fontSize: 8, fontWeight: '800' },
  avatarOptionLabelSelected: { color: '#E9FFD4', fontWeight: '900' },
  avatarOptionCheck: { position: 'absolute', top: 5, right: 5 },
  matchColorsButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#12394F', borderWidth: 1, borderColor: '#3E725B' },
  matchColorsText: { color: '#D6F7C1', fontSize: 9, letterSpacing: .4, fontWeight: '900' },
  reviewCard: { padding: 12, borderRadius: 16, backgroundColor: 'rgba(10,34,69,.92)', borderWidth: 1, borderColor: '#35597D' },
  reviewArtRow: { flexDirection: 'row', gap: 9 },
  reviewArt: { flex: 1, height: 148, borderRadius: 12, backgroundColor: '#0E315A', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  artLabel: { color: '#EFF7FF', backgroundColor: '#082244', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, marginTop: -4, fontSize: 8, letterSpacing: .7, fontWeight: '900' },
  reviewFields: { marginTop: 8 },
  reviewLine: { minHeight: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, borderBottomWidth: 1, borderColor: 'rgba(184,210,239,.15)' },
  reviewLabel: { color: '#9DB4CF', fontSize: 8, letterSpacing: .65, fontWeight: '900' },
  reviewValue: { flex: 1, color: '#FFFFFF', textAlign: 'right', fontSize: 12, fontWeight: '800' },
  reviewFormula: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 5 },
  formulaName: { color: '#E7F0FA', fontSize: 11, fontWeight: '900' },
  futureNote: { color: '#B9CBE0', fontSize: 10, lineHeight: 15, marginTop: 8 },
  message: { color: '#FFD58A', fontSize: 12, lineHeight: 17, marginTop: 12, fontWeight: '700' },
  footer: { flexShrink: 0, paddingTop: 10, paddingBottom: 2, backgroundColor: 'rgba(6,20,47,.96)', borderTopWidth: 1, borderTopColor: 'rgba(190,213,237,.18)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#496C90', backgroundColor: 'rgba(9,32,64,.82)' },
  backText: { color: '#DCE9F8', fontSize: 10, fontWeight: '900' },
  nextButton: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#A6F16A', borderWidth: 1, borderColor: '#D1FFA2', borderBottomWidth: 4, borderBottomColor: '#4B9E42', elevation: 4 },
  nextPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  nextBusy: { opacity: .75 },
  nextText: { color: '#092447', fontSize: 10, letterSpacing: .25, fontWeight: '900' },
  lockNote: { color: '#91A9C5', textAlign: 'center', fontSize: 8, letterSpacing: .9, fontWeight: '800', paddingTop: 7 },
});
