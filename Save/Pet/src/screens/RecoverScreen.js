import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebaseConnection';
import { Alert } from 'react-native';

export const RecoverScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');

  const handleRecover = async () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, informe seu email');
      return;
    }

    try {
      await sendPasswordResetEmail(FIREBASE_AUTH, email);
      Alert.alert(
        'Email enviado',
        'Verifique sua caixa de entrada e siga as instruções para recuperar sua senha',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível enviar o email de recuperação');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          style={styles.logo}
          source={require('../assets/pet.png')}
        />

        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.subtitle}>
          Informe seu endereço de e-mail cadastrado para receber um código e gerar uma nova senha
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Endereço de e-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.recoverButton}
          onPress={handleRecover}
        >
          <Text style={styles.recoverButtonText}>Recuperar Senha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
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
      height: 56,
      backgroundColor: '#FFE6D8',
      justifyContent: 'center',
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
});