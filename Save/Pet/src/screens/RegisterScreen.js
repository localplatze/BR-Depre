import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, set, serverTimestamp } from 'firebase/database';
import { Alert } from 'react-native';

export const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    try {
      // Criar usuário no Authentication
      const userCredential = await createUserWithEmailAndPassword(
        FIREBASE_AUTH,
        formData.email,
        formData.password
      );

      // Salvar dados adicionais no Realtime Database
      const userRef = ref(FIREBASE_DB, `users/${userCredential.user.uid}`);
      await set(userRef, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        isAdmin: false,
        createdAt: serverTimestamp()
      });

      Alert.alert('Sucesso', 'Conta criada com sucesso!');
      navigation.navigate('Login');

    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível criar a conta');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          style={styles.logo}
          source={require('../assets/pet.png')}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nome e Sobrenome"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />

          <TextInput
            style={styles.input}
            placeholder="Endereço de e-mail"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Número de Telefone"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Crie uma Senha"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
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

          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Confirme a Senha"
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <MaterialIcons
                name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                size={24}
                color="#7A5038"
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
        >
          <Text style={styles.registerButtonText}>Concluir Cadastro</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.haveAccount}
        >
          <Text style={styles.haveAccountText}>Já tenho uma Conta</Text>
        </TouchableOpacity>
      </ScrollView>
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