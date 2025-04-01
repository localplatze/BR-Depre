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
import { signInWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase, ref, set, push, query, orderByChild, equalTo, get, serverTimestamp } from 'firebase/database';
import auth from '@react-native-firebase/auth'
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  GoogleSignin.configure({
    webClientId: "518178501674-b962r77his9jjnp4c65ln4i98ljsilmv.apps.googleusercontent.com",
  });

  const checkExistingUser = async (email) => {
    const usersRef = ref(FIREBASE_DB, 'users');
    const emailQuery = query(usersRef, orderByChild('mail'), equalTo(email));
    const snapshot = await get(emailQuery);
    return snapshot.exists();
  };

  const createNewUser = async (userData) => {
    const usersRef = ref(FIREBASE_DB, 'users');
    const newUserRef = push(usersRef);
    await set(newUserRef, {
      ...userData,
      createdAt: serverTimestamp(),
      plan: 'free',
      bio: '',
      city: '',
      country: '',
    });
  };

  const handleEmailLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        FIREBASE_AUTH, 
        email, 
        password
      );
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      Alert.alert('Erro de Login', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      
      const userInfo = await GoogleSignin.signIn();
      console.log(JSON.stringify(userInfo))
      const idToken = userInfo.data?.idToken;
      
      if (!idToken) throw new Error('Token não encontrado');
      
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(FIREBASE_AUTH, credential);
      
      const userExists = await checkExistingUser(userCredential.user.email);
      
      if (!userExists) {
        await createNewUser({
          name: userCredential.user.displayName,
          mail: userCredential.user.email,
          image: userCredential.user.photoURL || ''
        });
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });

    } catch (error) {
      Alert.alert('Erro no Login', error.message);
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

        <Text style={styles.title}>Entre na sua Conta</Text>
        <Text style={styles.subtitle}>Bem-vindo ao For Helpers</Text>

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

        <TouchableOpacity onPress={() => navigation.navigate('Recover')}>
          <Text style={styles.forgotPassword}>Esqueci a Senha</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleEmailLogin}
        >
          <Text style={styles.buttonText}>Fazer Login</Text>
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
          <Text style={styles.footerText}>Não tem conta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Criar Uma</Text>
          </TouchableOpacity>
        </View>
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