import { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CryingBallLogo } from './CryingBallLogo';
import Svg, { Path } from 'react-native-svg';
import { auth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword } from '../services/firebaseAuth';
import { database, get, ref } from '../services/firebaseDatabase';
import { isPlayerSetupComplete } from '../services/onboardingSession';

const STADIUM = require('../../assets/brand/stadium-night.jpg');

export function AuthScreen({ mode }) {
  const router = useRouter();
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInput = useRef(null);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const snapshot = await get(ref(database, `users/${user.uid}`));
      router.replace(isPlayerSetupComplete(snapshot.val()) ? '/home' : '/configurar-perfil');
    } catch {
      setMessage('Não foi possível conferir seu perfil. Tente novamente.');
    }
  }), [isRegister, router]);

  async function submit() {
    if (isRegister && name.trim().length < 2) {
      setMessage('Informe seu nome para continuar.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage('Digite um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setMessage('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (isRegister) {
      setMessage('O cadastro será liberado em breve. Para entrar, use uma conta já aprovada.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
        'auth/wrong-password': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
        'auth/user-not-found': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
        'auth/user-disabled': 'Esta conta está desativada. Fale com o administrador da liga.',
        'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.',
        'auth/network-request-failed': 'Sem conexão com a internet. Confira sua rede e tente novamente.',
        'auth/operation-not-allowed': 'O acesso por e-mail ainda não está habilitado no Firebase.',
      };
      setMessage(messages[error.code] || 'Não foi possível entrar agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  }

  async function recoverPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage('Digite seu e-mail acima para receber o link de recuperação.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setMessage('Link enviado! Confira sua caixa de entrada e a pasta de spam.');
    } catch (error) {
      const messages = {
        'auth/invalid-email': 'Confira o formato do e-mail e tente novamente.',
        'auth/user-not-found': 'Se houver uma conta com esse e-mail, você receberá o link de recuperação.',
        'auth/too-many-requests': 'Muitas solicitações seguidas. Aguarde um pouco e tente de novo.',
        'auth/network-request-failed': 'Sem conexão com a internet. Confira sua rede e tente novamente.',
      };
      setMessage(messages[error.code] || 'Não foi possível enviar o link agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Image source={STADIUM} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(3,12,33,.88)', 'rgba(4,17,46,.90)', 'rgba(3,12,33,.98)']} locations={[0, .45, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <BackChevron /><Text style={styles.backLabel}>VOLTAR</Text>
        </Pressable>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}><CryingBallLogo size={50} animated={false} decorative /><Text style={styles.brandName}>BRASILEIRÃO{ '\n' }DA DEPRESSÃO</Text></View>
            <>
            <Text accessibilityRole="header" style={styles.title}>{isRegister ? 'VEM PRA TURMA.' : 'ENTRE NO JOGO.'}</Text>
            <Text style={styles.subtitle}>{isRegister ? 'Monte seu acesso. A entrada depende da aprovação do administrador.' : 'Entre para acompanhar seus palpites e disputar a temporada.'}</Text>

            {isRegister && <Field label="SEU NOME" value={name} onChangeText={(value) => { setName(value); setMessage(''); }} placeholder="Como a turma te conhece?" autoComplete="name" />}
            <Field label="E-MAIL" value={email} onChangeText={(value) => { setEmail(value); setMessage(''); }} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />
            <Field ref={passwordInput} label="SENHA" value={password} onChangeText={(value) => { setPassword(value); setMessage(''); }} placeholder="Sua senha" secureTextEntry={!showPassword} autoComplete={isRegister ? 'new-password' : 'current-password'} returnKeyType="go" onSubmitEditing={submit} rightAccessory={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} hitSlop={10} onPress={() => setShowPassword((visible) => !visible)} style={styles.eyeButton}><EyeIcon visible={showPassword} /></Pressable>} />

            {!isRegister && <Pressable accessibilityRole="button" disabled={busy} onPress={recoverPassword} style={styles.forgotButton}>
              <Text style={styles.forgotText}>ESQUECI A SENHA</Text>
            </Pressable>}

            {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
            <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={({ pressed }) => [styles.primary, pressed && !busy && styles.primaryPressed, busy && styles.primaryBusy]}>
              {busy ? <ActivityIndicator color="#092447" /> : <><Text style={styles.primaryText}>{isRegister ? 'CRIAR CONTA' : 'ENTRAR'}</Text><ForwardChevron /></>}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.replace(isRegister ? '/entrar' : '/cadastro')} style={styles.switch}>
              <Text style={styles.switchText}>{isRegister ? 'JÁ TEM CONTA? ' : 'AINDA NÃO TEM CONTA? '}</Text>
              <Text style={styles.switchAction}>{isRegister ? 'ENTRAR' : 'CRIAR CONTA'}</Text>
            </Pressable>
            </>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const Field = forwardRef(function Field({ label, rightAccessory, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputFrame, focused && styles.inputFrameFocused]}>
        <TextInput
          {...props}
          ref={ref}
          style={styles.input}
          accessibilityLabel={label}
          placeholderTextColor="#A7BED3"
          selectionColor="#9BF05A"
          onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
          underlineColorAndroid="transparent"
        />
        {rightAccessory}
      </View>
    </View>
  );
});

function BackChevron() {
  return <Svg width="18" height="18" viewBox="0 0 18 18"><Path d="m11 3-6 6 6 6M5 9h10" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function ForwardChevron() {
  return <Svg width="19" height="19" viewBox="0 0 19 19"><Path d="M3 9.5h12m-5-5 5 5-5 5" stroke="#092447" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function EyeIcon({ visible }) {
  return <Svg width="21" height="21" viewBox="0 0 24 24">
    <Path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6S2.5 12 2.5 12Z" fill="none" stroke="#C1D8EB" strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" fill="none" stroke="#C1D8EB" strokeWidth="1.8" />
    {!visible && <Path d="m4 4 16 16" stroke="#C1D8EB" strokeWidth="1.8" strokeLinecap="round" />}
  </Svg>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071739' },
  safe: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 },
  flex: { flex: 1 },
  back: { minHeight: 48, minWidth: 76, flexDirection: 'row', alignItems: 'center', gap: 9 },
  backLabel: { color: '#C5D9EC', fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingTop: 10, paddingBottom: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  brandName: { color: '#F4FAFF', fontSize: 10, lineHeight: 13, letterSpacing: 1.15, fontWeight: '900' },
  title: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, letterSpacing: -.5, fontWeight: '900' },
  subtitle: { color: '#C1D8EB', fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 22, maxWidth: 390 },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#D7E8F7', fontSize: 10, letterSpacing: 1.25, fontWeight: '800', marginBottom: 7 },
  inputFrame: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(213,235,255,.34)', backgroundColor: 'rgba(5,25,65,.78)', paddingRight: 12 },
  inputFrameFocused: { borderColor: '#A0F05D', borderWidth: 2, backgroundColor: 'rgba(8,35,71,.96)' },
  input: { minHeight: 52, flex: 1, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 15 },
  eyeButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  forgotButton: { minHeight: 40, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 2, marginTop: -10, marginBottom: 6 },
  forgotText: { color: '#A4F36E', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  message: { color: '#FFE18A', fontSize: 13, lineHeight: 18, marginTop: 1, marginBottom: 12 },
  primary: { minHeight: 56, borderRadius: 12, backgroundColor: '#9BF05A', borderBottomWidth: 4, borderBottomColor: '#57B63F', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  primaryPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  primaryBusy: { opacity: 0.75 },
  primaryText: { color: '#092447', fontSize: 13, letterSpacing: 1.4, fontWeight: '900' },
  switch: { minHeight: 52, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  switchText: { color: '#C1D8EB', fontSize: 10, letterSpacing: .7, fontWeight: '700' },
  switchAction: { color: '#A4F36E', fontSize: 10, letterSpacing: .9, fontWeight: '900' },
});
