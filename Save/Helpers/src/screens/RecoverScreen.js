import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
} from 'react-native';
import { BackButton } from '../components/BackButton';

export const RecoverScreen = ({ navigation }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const ConfirmationDialog = () => (
    <Modal
      visible={showConfirmation}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <BackButton />
          
          <Image 
            source={require('../assets/ic_helpers.png')}
            style={styles.logo}
          />

          <Text style={styles.title}>
            Verifique seu E-mail
          </Text>

          <Text style={styles.description}>
            Redefina sua senha e faça login para acessar o For Helpers
          </Text>

          <TouchableOpacity 
            style={[styles.primaryButton, styles.modalButton]}
            onPress={() => {
              setShowConfirmation(false);
              navigation.navigate('Login');
            }}
          >
            <Text style={styles.buttonText}>Voltar ao Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <BackButton />
        
        <Image 
          source={require('../assets/ic_helpers.png')}
          style={styles.logo}
        />

        <Text style={styles.title}>
          Esqueci a Senha
        </Text>

        <Text style={styles.description}>
          Informe o e-mail associado com sua conta, e enviaremos uma mensagem para recuperar sua conta
        </Text>

        <Text style={styles.label}>
          Endereço de E-mail:
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Digite seu e-mail"
          placeholderTextColor="#999"
        />
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => setShowConfirmation(true)}
        >
          <Text style={styles.buttonText}>Enviar E-mail</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>
            Voltar ao Login
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmationDialog />
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
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7F0FB',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: 'gray',
    marginTop: 8,
    lineHeight: 24,
  },
  label: {
    fontSize: 16,
    color: 'gray',
    marginTop: 24,
    marginBottom: 8,
  },
  input: {
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    paddingHorizontal: 16,
    fontSize: 16,
    color: 'black',
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
    fontWeight: '500',
  },
  backLink: {
    color: 'gray',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalButton: {
    marginTop: 24,
  },
});