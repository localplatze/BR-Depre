import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform, 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, onValue, off } from 'firebase/database';

export const HomeScreen = ({ navigation }) => {
  const [myPets, setMyPets] = useState([]);
  const [availablePets, setAvailablePets] = useState([]);
  const [loading, setLoading] = useState(true);

  const getPriorityLevel = (status) => {
    const statusNum = parseInt(status);
    if (statusNum === 2 || statusNum === 5 || statusNum === 51) return 1; // Pendências críticas (negado)
    if (statusNum === 4 || statusNum === 41) return 2; // Adoção em andamento
    if (statusNum === 3) return 3; // Pedido de desapadrinhamento (ação necessária)
    if (statusNum === 0) return 4; // Apadrinhamento pendente (aguardando confirmação)
    if (statusNum === 1) return 5; // Apadrinhado 
    if (statusNum === 6) return 6; // Adotado
    return 7; 
  };

  // Ajustar getStatusIcon para retornar um objeto com nome e cor
  const getStatusIconAndColor = (priority) => {
    switch (priority) {
      case 1: return { name: "error", color: "#F44336" }; // Vermelho para críticas
      case 2: return { name: "hourglass-top", color: "#2196F3" }; // Azul para adoção em andamento
      case 3: return { name: "warning", color: "#FFC107" }; // Amarelo para desapadrinhar
      case 4: return { name: "hourglass-empty", color: "#FF9800" }; // Laranja para pendente
      // Para prioridade 5 (Apadrinhado) e 6 (Adotado), não mostraremos ícone por padrão, 
      // mas você pode adicionar se quiser.
      default: return null;
    }
  };

  useEffect(() => {
    const currentUser = FIREBASE_AUTH.currentUser;
    if (!currentUser) {
        setLoading(false);
        return;
    }

    const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
    const petsRef = ref(FIREBASE_DB, 'pets');
    
    let userDataSnapshot = null;
    let petsDataSnapshot = null;

    const processSnapshots = () => {
      if (!userDataSnapshot || !petsDataSnapshot) return;

      const userData = userDataSnapshot.val();
      const petsData = petsDataSnapshot.val();

      if (!petsData) {
        setMyPets([]);
        setAvailablePets([]);
        setLoading(false);
        return;
      }
      
      if (userData && userData.pets) {
        const userPetsWithStatus = userData.pets
          .split(';')
          .map(petEntry => {
            const [petId, status] = petEntry.split(',');
            const pet = petsData[petId];
            if (!pet) return null;

            const priority = getPriorityLevel(status);
            const iconInfo = getStatusIconAndColor(priority); // Pega nome e cor
            
            return {
              id: petId,
              name: pet.name,
              image: pet.image ? { uri: pet.image } : require('../assets/pet1.png'),
              priority,
              statusIconName: iconInfo ? iconInfo.name : null, // Salva o nome do ícone
              statusIconColor: iconInfo ? iconInfo.color : null, // Salva a cor do ícone
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.priority - b.priority);

        setMyPets(userPetsWithStatus);
      } else {
        setMyPets([]);
      }

      const userPetIds = (userData && userData.pets) ? userData.pets.split(';').map(pet => pet.split(',')[0]) : [];
      const availablePetsArray = Object.entries(petsData)
        .filter(([id, pet]) => 
          pet && pet.status === 0 && !userPetIds.includes(id)
        )
        .map(([id, pet]) => ({
          id,
          name: pet.name,
          age: pet.age,
          gender: convertGender(pet.gender),
          size: convertSize(pet.size),
          image: pet.image ? { uri: pet.image } : require('../assets/pet1.png'),
        }));

      setAvailablePets(availablePetsArray);
      setLoading(false);
    };

    const userListener = onValue(userRef, (snapshot) => {
      userDataSnapshot = snapshot;
      processSnapshots();
    }, (error) => {
      console.error('Erro ao observar dados do usuário:', error);
      setLoading(false);
    });

    const petsListener = onValue(petsRef, (snapshot) => {
      petsDataSnapshot = snapshot;
      processSnapshots();
    }, (error) => {
      console.error('Erro ao observar dados dos pets:', error);
      setLoading(false);
    });

    return () => {
      off(userRef, 'value', userListener);
      off(petsRef, 'value', petsListener);
    };
  }, []);

  const convertGender = (gender) => {
    switch (gender) {
      case 'M': return 'Macho';
      case 'F': return 'Fêmea';
      default: return 'Não Definido';
    }
  };

  const convertSize = (size) => {
    switch (size) {
      case 'P': return 'Pequeno';
      case 'M': return 'Médio';
      case 'G': return 'Grande';
      default: return 'Não Definido';
    }
  };

  // PetStatusIcon agora recebe a cor também
  const PetStatusIcon = ({ iconName, iconColor }) => {
    if (!iconName) return null;
    
    return (
      <View style={[styles.statusIconContainer, iconColor ? { backgroundColor: iconColor } : {}]}>
        <MaterialIcons name={iconName} size={18} color="#FFFFFF" /> 
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bem-vindo!</Text> 
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('WalkList')}>
            <MaterialIcons name="directions-walk" size={28} color="#7A5038" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <MaterialIcons name="person" size={28} color="#7A5038" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.myPetsCard}>
        <Text style={styles.cardTitle}>Meus Pets</Text>
        {loading ? (
          <View style={styles.loadingContainer}><Text>Carregando seus pets...</Text></View>
        ) : myPets.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {myPets.map((pet) => (
              <TouchableOpacity 
                key={pet.id}
                onPress={() => navigation.navigate('PetDetail', { petId: pet.id })}
                style={styles.petItem}
              >
                <View style={styles.petImageContainer}>
                  <Image source={pet.image} style={styles.petImage} />
                  {/* Passar nome e cor do ícone para PetStatusIcon */}
                  <PetStatusIcon iconName={pet.statusIconName} iconColor={pet.statusIconColor} />
                </View>
                <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyStateContainer}><Text style={styles.emptyStateText}>Você ainda não apadrinhou nenhum pet.</Text></View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Disponíveis para Apadrinhar</Text>

      {loading && availablePets.length === 0 ? (
          <View style={styles.loadingContainer}><Text>Carregando pets disponíveis...</Text></View>
      ) : !loading && availablePets.length === 0 ? (
          <View style={styles.emptyStateContainerFullWidth}><Text style={styles.emptyStateText}>Não há pets disponíveis para apadrinhamento no momento.</Text></View>
      ) : (
        <View style={styles.adoptionList}>
          {availablePets.map((pet) => (
            <TouchableOpacity 
              key={pet.id}
              onPress={() => navigation.navigate('PetDetail', { petId: pet.id })}
              style={styles.adoptionCardOuter}
            >
              <View style={styles.adoptionCard}>
                <Image source={pet.image} style={styles.adoptionPetImage} />
                <View style={styles.petInfo}>
                  <Text style={styles.adoptionPetName}>{pet.name}</Text>
                  <Text style={styles.petDetails}>Idade: {pet.age}</Text>
                  <Text style={styles.petDetails}>Sexo: {pet.gender}</Text>
                  <Text style={styles.petDetails}>Porte: {pet.size}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 25 : 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  myPetsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 15,
    paddingHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 150, // Para dar espaço mesmo se vazio
  },
  cardTitle: {
    fontSize: 18, // Título do card um pouco maior
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12, // Mais espaço abaixo do título
    paddingLeft: 10,
  },
  horizontalScroll: {
    paddingLeft: 10,
    paddingRight: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  petItem: {
    marginRight: 12,
    alignItems: 'center',
    width: 90,
  },
  petImageContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    marginBottom: 5,
  },
  petImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusIconContainer: { // Estilo ajustado para o ícone de status
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 12, // Círculo
    padding: 4, // Padding interno
    elevation: 2, // Sombra
    // A cor de fundo será definida dinamicamente
  },
  petName: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: '#444444',
    textAlign: 'center',
  },
  emptyStateContainer: {
    paddingVertical: 25, // Mais padding vertical
    alignItems: 'center',
    minHeight: 100, 
    justifyContent: 'center',
  },
  emptyStateContainerFullWidth: {
    paddingVertical: 30,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  emptyStateText: {
    color: '#777777',
    textAlign: 'center',
    fontSize: 14,
  },
  adoptionList: {
    marginHorizontal: 16,
    gap: 12,
  },
  adoptionCardOuter: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  adoptionCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    overflow: 'hidden',
  },
  adoptionPetImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  petInfo: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center',
  },
  adoptionPetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  petDetails: {
    color: '#666666',
    fontSize: 13,
    marginBottom: 2,
  }
});