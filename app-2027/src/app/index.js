import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { CryingBallLogo } from '../components/CryingBallLogo';
import { auth, onAuthStateChanged } from '../services/firebaseAuth';
import { database, get, ref } from '../services/firebaseDatabase';
import { isPlayerSetupComplete } from '../services/onboardingSession';

const STADIUM = require('../../assets/brand/stadium-night.jpg');

export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [enter] = useState(() => new Animated.Value(0));
  const [sessionChecked, setSessionChecked] = useState(false);
  const compact = height < 740;
  const mascotSize = Math.min(width - 78, compact ? 254 : 302);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  useEffect(() => {
    let alive = true;
    const stop = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (alive) setSessionChecked(true);
        return;
      }
      try {
        const snapshot = await get(ref(database, `users/${user.uid}`));
        if (alive) router.replace(isPlayerSetupComplete(snapshot.val()) ? '/home' : '/configurar-perfil');
      } catch {
        if (alive) router.replace('/home');
      }
    });
    return () => {
      alive = false;
      stop();
    };
  }, [router]);

  if (!sessionChecked) {
    return <View style={styles.loading}><ActivityIndicator color="#A0F05D" size="large" /></View>;
  }

  const arrival = enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View style={styles.root}>
      <Image source={STADIUM} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(4,13,36,.72)', 'rgba(5,20,55,.48)', 'rgba(4,17,48,.76)', 'rgba(3,13,39,.97)']}
        locations={[0, .31, .58, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <CryingBallLogo size={47} animated={false} decorative />
            <View>
              <Text style={styles.brandTop}>BRASILEIRÃO</Text>
              <Text style={styles.brandBottom}>DA DEPRESSÃO</Text>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.hero, compact && styles.heroCompact, { opacity: enter, transform: [{ translateY: arrival }] }]}>
          <View style={styles.mascotStage}>
            <CryingBallLogo size={mascotSize} />
          </View>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>PALPITOU?{ '\n' }A TURMA VAI COBRAR.</Text>
            <Text style={styles.subtitle}>O campeonato entre amigos: placares, torneios e resenha até a última rodada.</Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/entrar')}
            style={({ pressed }) => [styles.enterButton, pressed && styles.enterPressed]}
          >
            <Text style={styles.enterText}>ENTRAR</Text>
            <View style={styles.enterArrow}><ForwardChevron /></View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/cadastro')} style={styles.createButton}>
            <Text style={styles.createText}>CRIAR CONTA</Text>
          </Pressable>
          <Text style={styles.approval}>A entrada de novos jogadores depende da aprovação do administrador.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ForwardChevron() {
  return <Svg width="18" height="18" viewBox="0 0 18 18"><Path d="M2.5 9h12m-5-5 5 5-5 5" stroke="#082347" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071739' },
  root: { flex: 1, backgroundColor: '#071739', overflow: 'hidden' },
  safe: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 13 },
  topbar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  brandTop: { color: '#FFFFFF', fontSize: 11, letterSpacing: 1.1, fontWeight: '900' },
  brandBottom: { color: '#A2EE6A', fontSize: 9, letterSpacing: 1.05, fontWeight: '900' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 6, paddingBottom: 5 },
  heroCompact: { paddingTop: 0, paddingBottom: 0 },
  mascotStage: { width: '100%', minHeight: 254, flex: 1, justifyContent: 'center', alignItems: 'center' },
  copy: { width: '100%', paddingHorizontal: 5, paddingTop: 2 },
  title: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, letterSpacing: -.65, fontWeight: '900' },
  titleCompact: { fontSize: 27, lineHeight: 30 },
  subtitle: { color: '#D1E4F4', fontSize: 14, lineHeight: 20, marginTop: 9, maxWidth: 390 },
  actions: { width: '100%', alignItems: 'center', gap: 4, paddingTop: 8 },
  enterButton: { width: '100%', maxWidth: 420, minHeight: 58, paddingHorizontal: 20, borderRadius: 13, backgroundColor: '#A0F05D', borderBottomWidth: 4, borderBottomColor: '#5BBF42', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enterPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  enterText: { color: '#082347', fontSize: 14, letterSpacing: 1.6, fontWeight: '900' },
  enterArrow: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#C6F89C', alignItems: 'center', justifyContent: 'center' },
  createButton: { minWidth: 132, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  createText: { color: '#F0F7FF', fontSize: 11, letterSpacing: 1.15, fontWeight: '800' },
  approval: { maxWidth: 330, textAlign: 'center', color: '#9BB7CF', fontSize: 10, lineHeight: 14, marginTop: 2 },
});
