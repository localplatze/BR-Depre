import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  StyleSheet, 
  Alert 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { updateProfile, updateEmail } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ProfileScreen = ({ navigation }) => {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const currentUser = FIREBASE_AUTH.currentUser;
      if (currentUser) {
        // Query Realtime Database to find user by email
        const usersRef = ref(FIREBASE_DB, 'users');
        const userQuery = query(usersRef, orderByChild('email'), equalTo(currentUser.email));
        
        const snapshot = await get(userQuery);
        
        if (snapshot.exists()) {
          // Get the first (and should be only) matching user
          const userData = Object.entries(snapshot.val())[0];
          const [userKey, userDetails] = userData;
          
          // Set state with database user details
          setUserId(userKey);
          setUserName(userDetails.name || currentUser.displayName || '');
          setEmail(currentUser.email || '');
          setPhoneNumber(userDetails.phone || '');
        } else {
          // Fallback to authentication user data if no matching user found
          setUserName(currentUser.displayName || '');
          setEmail(currentUser.email || '');
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do usuário');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const currentUser = FIREBASE_AUTH.currentUser;
      if (currentUser) {
        // Prepare update object for Realtime Database
        const userUpdates = {
          name: userName,
          email: email,
          phoneNumber: phoneNumber
        };

        // Update Firebase Authentication fields
        if (userName !== currentUser.displayName) {
          await updateProfile(currentUser, { displayName: userName });
        }

        if (email !== currentUser.email) {
          await updateEmail(currentUser, email);
        }

        // Update Realtime Database if we have a user ID
        if (userId) {
          const userRef = ref(FIREBASE_DB, `users/${userId}`);
          await update(userRef, userUpdates);
        }

        Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o perfil');
    }
  };

  const handleLogout = async () => {
    try {
      await FIREBASE_AUTH.signOut();
      await AsyncStorage.removeItem('userData');
      
      // Reset navigation to initial login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }]
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Erro', 'Não foi possível fazer logout');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="person" size={48} color="#7A5038" />
        <Text style={styles.greeting}>Olá, {userName || 'Usuário'}!</Text>
      </View>
      <Text style={styles.sectionTitle}>Dados do Perfil</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nome e Sobrenome"
          placeholderTextColor="#666"
          value={userName}
          onChangeText={setUserName}
        />
        <TextInput
          style={styles.input}
          placeholder="Endereço de E-mail"
          placeholderTextColor="#666"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Número de Telefone"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.updateButton}
          onPress={handleUpdateProfile}
        >
          <Text style={styles.buttonText}>Atualizar Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Sair da Conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      padding: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    greeting: {
      marginLeft: 16,
      fontSize: 24,
      fontWeight: '600',
      color: '#7A5038',
    },
    sectionTitle: {
      fontSize: 16,
      color: '#000000',
      marginBottom: 24,
    },
    form: {
      gap: 16,
    },
    input: {
      borderWidth: 2,
      borderColor: '#7A5038',
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 24,
      left: 24,
      right: 24,
      gap: 16,
    },
    updateButton: {
      backgroundColor: '#7A5038',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
    },
    logoutButton: {
      backgroundColor: '#FF0000',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '500',
    },
  });
  