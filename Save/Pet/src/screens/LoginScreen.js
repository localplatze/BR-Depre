import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPersistentLogin();
  }, []);

  const checkPersistentLogin = async () => {
    try {
      setIsLoading(true);
      const storedUserData = await AsyncStorage.getItem('userData');
      if (storedUserData) {
        const userData = JSON.parse(storedUserData);
        // Attempt to sign in with stored credentials
        const userCredential = await signInWithEmailAndPassword(
          FIREBASE_AUTH, 
          userData.email, 
          userData.password
        );
        
        const user = userCredential.user;
        const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const userDetails = snapshot.val();
          const isAdmin = userDetails.isAdmin;

          const updatedUserData = {...userData, isAdmin};
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
          
          navigation.reset({
            index: 0,
            routes: [{ name: userData.isAdmin ? 'Admin' : 'Home' }]
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }]
          });
        }
      }
    } catch (error) {
      // If stored login fails, clear stored data
      await AsyncStorage.removeItem('userData');
      console.error('Stored login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
      const user = userCredential.user;

      // Save login credentials securely
      await AsyncStorage.setItem('userData', JSON.stringify({
        email,
        password,
        uid: user.uid,
        isAdmin: userData.isAdmin
      }));

      // Verificar se é admin no Realtime Database
      const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        navigation.reset({
          index: 0,
          routes: [{ name: userData.isAdmin ? 'Admin' : 'Home' }]
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }]
        });
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Email ou senha inválidos');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>Abraço Pet</Text>
        </View>
        <View style={[styles.content, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#7A5038" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Abraço Pet</Text>
      </View>
      
      <View style={styles.content}>
        <Image
          style={styles.logo}
          source={require('../assets/pet.png')}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Endereço de e-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={24}
                color="#7A5038"
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Recover')}
          style={styles.forgotPassword}
        >
          <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
        >
          <Text style={styles.loginButtonText}>Fazer Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          style={styles.createAccount}
        >
          <Text style={styles.createAccountText}>Criar uma Conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    toolbar: {
      height: 80,
      backgroundColor: '#FFE6D8',
      justifyContent: 'center',
      paddingTop: 24,
      paddingHorizontal: 16,
      elevation: 4,
    },
    toolbarTitle: {
      fontSize: 20,
      color: '#7A5038',
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
    },
    scrollContent: {
      padding: 24,
      alignItems: 'center',
    },
    logo: {
      width: 200,
      height: 200,
      marginBottom: 32,
    },
    inputContainer: {
      width: '100%',
      marginBottom: 16,
    },
    input: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: 16,
      marginBottom: 16,
      borderColor: '#FFE6D8',
      borderWidth: 2,
      width: '100%',
    },
    passwordContainer: {
      position: 'relative',
      width: '100%',
    },
    passwordInput: {
      paddingRight: 50,
    },
    eyeIcon: {
      position: 'absolute',
      right: 16,
      top: 16,
    },
    forgotPassword: {
      alignSelf: 'flex-end',
      marginBottom: 24,
    },
    forgotPasswordText: {
      color: '#7A5038',
    },
    loginButton: {
      backgroundColor: '#7A5038',
      borderRadius: 24,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginBottom: 16,
    },
    loginButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    registerButton: {
      backgroundColor: '#7A5038',
      borderRadius: 24,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 16,
    },
    registerButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    recoverButton: {
      backgroundColor: '#7A5038',
      borderRadius: 24,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 16,
    },
    recoverButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    createAccount: {
      marginTop: 16,
    },
    createAccountText: {
      color: '#7A5038',
      fontSize: 16,
    },
    haveAccount: {
      marginTop: 16,
    },
    haveAccountText: {
      color: '#7A5038',
      fontSize: 16,
    },
    backButton: {
      marginTop: 16,
    },
    backButtonText: {
      color: '#7A5038',
      fontSize: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#7A5038',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: '#666666',
      textAlign: 'center',
      marginBottom: 24,
    },
    loadingContainer: {
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 10,
      color: '#7A5038',
      fontSize: 16,
    }
});