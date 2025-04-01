import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  StyleSheet,
  Alert 
} from 'react-native';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { BackButton } from '../components/BackButton';
import { SocialButton } from '../components/SocialButton';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, serverTimestamp } from 'firebase/database';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isChecked, setIsChecked] = useState(false);

  GoogleSignin.configure({
    webClientId: "518178501674-b962r77his9jjnp4c65ln4i98ljsilmv.apps.googleusercontent.com",
  });

  const handleEmailRegister = async () => {
    if (!isChecked) {
      Alert.alert('Erro', 'Por favor aceite os termos e condições');
      return;
    }

    if (!name || !email || !password) {
      Alert.alert('Erro', 'Por favor preencha todos os campos');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        FIREBASE_AUTH,
        email,
        password
      );
      
      const uid = userCredential.user.uid;
      const userRef = ref(FIREBASE_DB, `users/${uid}`);
      
      // Create user profile
      await set(userRef, {
        name,
        mail,
        createdAt: serverTimestamp(),
        plan: 'free',
        bio: '',
        city: '',
        country: '',
        image: ''
      });

      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Erro no Cadastro', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isChecked) {
      Alert.alert('Erro', 'Por favor aceite os termos e condições');
      return;
    }

    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
  
      if (!idToken) throw new Error('Token não encontrado');
  
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      const uid = userCredential.user.uid;
      const userRef = ref(FIREBASE_DB, `users/${uid}`);
      
      // Create user profile
      await set(userRef, {
        name: userInfo.data.user.name,
        mail: userInfo.data.user.email,
        createdAt: serverTimestamp(),
        plan: 'free',
        bio: '',
        city: '',
        country: '',
        image: ''
      });
  
      navigation.navigate('Home');
      
    } catch (error) {
      Alert.alert('Erro no Cadastro', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <BackButton />
        
        <Image 
          source={require('../assets/ic_helpers.png')}
          style={styles.logo}
        />

        <Text style={styles.title}>Criar uma Conta</Text>
        <Text style={styles.subtitle}>Insira as informações abaixo</Text>

        <Text style={styles.label}>Nome:</Text>
        <TextInput 
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Digite seu nome"
        />

        <Text style={styles.label}>Endereço de E-mail:</Text>
        <TextInput
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          placeholder="Digite seu e-mail"
        />

        <Text style={styles.label}>Senha:</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Digite sua senha"
        />

        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            onPress={() => setIsChecked(!isChecked)}
            style={[
              styles.checkbox,
              isChecked && styles.checkboxChecked
            ]}
          />
          <Text style={styles.checkboxLabel}>
            Aceito os{' '}
            <Text style={styles.link}>Termos e Política do App</Text>
          </Text>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleEmailRegister}
        >
          <Text style={styles.buttonText}>Fazer Cadastro</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>Ou continue com</Text>
          <View style={styles.divider} />
        </View>

        <SocialButton 
          title="Entrar com Google" 
          icon={require('../assets/ic_google.png')}
          onPress={handleGoogleSignIn}
        />
        <SocialButton 
          title="Entrar com Facebook" 
          icon={require('../assets/ic_facebook.png')}
          marginTop={16}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Fazer Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollView: {
    marginHorizontal: 32,
    marginTop: 40,
  },
  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginTop: 48,
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 32,
    color: 'black',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: 'gray',
  },
  label: {
    fontSize: 16,
    color: 'gray',
    marginTop: 24,
  },
  input: {
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    marginTop: 8,
    padding: 16,
  },
  forgotPassword: {
    fontSize: 16,
    color: '#3A82F6',
    textAlign: 'right',
    marginTop: 16,
  },
  spacer: {
    height: 48,
  },
  bottomContainer: {
    marginHorizontal: 32,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#3A82F6',
    borderRadius: 4,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'gray',
  },
  dividerText: {
    marginHorizontal: 16,
    color: 'gray',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    color: 'gray',
    fontSize: 16,
  },
  footerLink: {
    color: '#3A82F6',
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'black',
    backgroundColor: '#F5F5F5',
  },
  checkboxChecked: {
    backgroundColor: '#3A82F6',
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 12,
    color: 'gray',
  },
  link: {
    color: '#3A82F6',
  },
});