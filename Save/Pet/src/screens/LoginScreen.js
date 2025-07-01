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
      const storedUserDataJSON = await AsyncStorage.getItem('userData');
      if (storedUserDataJSON) {
        const parsedStoredUserData = JSON.parse(storedUserDataJSON);

        // Verificar se temos email e senha para tentar o login
        if (!parsedStoredUserData.email || !parsedStoredUserData.password) {
          console.warn("Dados de login persistente incompletos no AsyncStorage.");
          await AsyncStorage.removeItem('userData'); // Limpar dados inválidos
          setIsLoading(false);
          return;
        }

        // Tentar re-autenticar com as credenciais armazenadas
        const userCredential = await signInWithEmailAndPassword(
          FIREBASE_AUTH,
          parsedStoredUserData.email,
          parsedStoredUserData.password // Novamente, CUIDADO ao armazenar/usar senhas assim
        );

        const user = userCredential.user;

        // Buscar os detalhes mais recentes do usuário, incluindo isAdmin
        const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
        const snapshot = await get(userRef);

        let isCurrentUserAdmin = false; // Status de admin para esta checagem
        if (snapshot.exists()) {
          const userDetailsFromDB = snapshot.val();
          isCurrentUserAdmin = userDetailsFromDB.isAdmin || false;
        } else {
          console.warn(`Usuário ${user.uid} (login persistente) não encontrado no Realtime Database.`);
        }

        // Atualizar o AsyncStorage com a informação isAdmin mais recente
        // e manter as outras informações necessárias (uid, email, e a senha se você insistir nessa abordagem)
        const dataToStoreAgain = {
          email: parsedStoredUserData.email,
          password: parsedStoredUserData.password, // NÃO RECOMENDADO
          uid: user.uid,
          isAdmin: isCurrentUserAdmin
        };
        await AsyncStorage.setItem('userData', JSON.stringify(dataToStoreAgain));

        navigation.reset({
          index: 0,
          routes: [{ name: isCurrentUserAdmin ? 'Admin' : 'Home' }]
        });

      }
    } catch (error) {
      // Se o login persistente falhar (ex: senha alterada, conta deletada, credenciais inválidas),
      // limpar os dados armazenados.
      if (error.code === 'auth/user-not-found' ||
          error.code === 'auth/wrong-password' ||
          error.code === 'auth/invalid-credential' || // Novo código de erro
          error.code === 'auth/user-disabled') {
        await AsyncStorage.removeItem('userData');
      }
      console.error('Login persistente falhou:', error.message);
      // Não é ideal mostrar um Alert aqui, pois é uma checagem em background.
      // O usuário simplesmente permanecerá na tela de login se falhar.
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
      // 1. Autenticar o usuário
      const userCredential = await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
      const user = userCredential.user;

      // 2. Buscar dados do usuário no Realtime Database para obter isAdmin
      const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
      const snapshot = await get(userRef);

      let isCurrentUserAdmin = false; // Valor padrão, caso o usuário não exista no DB ou não tenha a propriedade
      if (snapshot.exists()) {
        const userDataFromDB = snapshot.val(); // Dados do Realtime DB
        isCurrentUserAdmin = userDataFromDB.isAdmin || false; // Pega o valor de isAdmin, ou false se não existir
      } else {
        // O usuário está autenticado no Firebase Auth, mas não tem um nó correspondente
        // em /users/{uid} no Realtime Database.
        // Você precisa decidir como lidar com isso. Por exemplo, tratar como não-admin.
        console.warn(`Usuário ${user.uid} autenticado, mas não encontrado em /users/${user.uid} no Realtime Database.`);
      }

      // 3. Salvar dados no AsyncStorage, incluindo o isAdmin correto
      // ATENÇÃO MUITO IMPORTANTE: Armazenar a senha do usuário em plain text
      // (como 'password: password') no AsyncStorage é uma PÉSSIMA PRÁTICA DE SEGURANÇA.
      // O Firebase Authentication já gerencia a sessão do usuário.
      // Considere usar onAuthStateChanged para verificar o estado de login
      // e não armazenar a senha. Se for manter essa abordagem para login persistente,
      // esteja ciente dos riscos.
      await AsyncStorage.setItem('userData', JSON.stringify({
        email,          // Email usado no login
        password,       // Senha usada no login (NÃO RECOMENDADO)
        uid: user.uid,
        isAdmin: isCurrentUserAdmin // Status de admin obtido do DB
      }));

      // 4. Navegar para a tela correta com base no status de admin
      navigation.reset({
        index: 0,
        routes: [{ name: isCurrentUserAdmin ? 'Admin' : 'Home' }]
      });

    } catch (error) {
      console.error("Erro detalhado no login:", error); // Log completo do erro para depuração
      let errorMessage = 'Email ou senha inválidos.'; // Mensagem padrão
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-email':
          case 'auth/invalid-credential': // Novo código de erro para credenciais inválidas no Firebase v9+
            errorMessage = 'Email ou senha inválidos.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Muitas tentativas de login. Por favor, tente novamente mais tarde.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
            break;
          default:
            errorMessage = 'Ocorreu um erro ao tentar fazer login. Tente novamente.';
        }
      }
      Alert.alert('Erro de Login', errorMessage);
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