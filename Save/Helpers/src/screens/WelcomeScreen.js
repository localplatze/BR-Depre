import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { FIREBASE_DB, FIREBASE_AUTH } from '../firebaseConnection';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

const { width, height } = Dimensions.get('window');

export const WelcomeScreen = ({ navigation }) => {
  const [welcomeImage, setWelcomeImage] = useState('');
  const [welcomeTitle, setWelcomeTitle] = useState('');

  useEffect(() => {
    // 🔹 Verifica se há um usuário autenticado
    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      if (user) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    });

    // 🔹 Busca a imagem e título da tela de boas-vindas do Firebase Database
    const infosRef = ref(FIREBASE_DB, 'infos');
    onValue(infosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setWelcomeImage(data.welcomeImage || '');
        setWelcomeTitle(data.welcomeTitle || '');
      }
    });

    return () => unsubscribe(); // 🔹 Remove o listener ao desmontar o componente
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.topContainer}>
        <View style={styles.ellipseContainer}>
          {welcomeImage ? (
            <Image 
              source={{ uri: welcomeImage }} 
              style={styles.image} 
              resizeMode="cover"
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Text>Carregando imagem...</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.description}>{welcomeTitle || 'Carregando...'}</Text>

      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.buttonText}>CRIAR PERFIL</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>ENTRAR</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.linkText}>BUSCAR VAGAS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4D073',
  },
  topContainer: {
    width: width,
    height: height * 0.4,
  },
  ellipseContainer: {
    position: 'absolute',
    top: -height * 0.3,
    width: width * 1.5,
    height: height * 0.7,
    borderRadius: height * 0.35,
    backgroundColor: 'white',
    alignSelf: 'center',
    overflow: 'hidden', // Isso faz com que a imagem seja recortada pela elipse
  },
  image: {
    width: width * 1.5,
    height: height * 0.7,
    position: 'absolute',
    top: height * 0.3, // Ajuste conforme necessário para posicionar a imagem
    alignSelf: 'center',
  },
  loadingContainer: {
    width: width,
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.3,
  },
  description: {
    color: 'white',
    fontSize: 18,
    marginHorizontal: 32,
    marginTop: 20,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 32,
    left: 32,
    right: 32,
  },
  primaryButton: {
    backgroundColor: '#3A82F6',
    borderRadius: 4,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F4D073',
    borderRadius: 4,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'white',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
  linkText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 24,
  },
});