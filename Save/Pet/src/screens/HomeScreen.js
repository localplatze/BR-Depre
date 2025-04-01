import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
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
    if ([2, 4, 5].includes(statusNum)) return 1;
    if (statusNum === 3) return 2;
    if (statusNum === 0) return 3;
    if ([1, 41, 51].includes(statusNum)) return 4;
    if (statusNum === 6) return 5;
    return 6;
  };

  const getStatusIcon = (priority) => {
    switch (priority) {
      case 1:
        return "error";
      case 2:
      case 3:
        return "sync";
      case 6:
        return "pets";
      default:
        return null;
    }
  };

  useEffect(() => {
    const currentUser = FIREBASE_AUTH.currentUser;
    if (!currentUser) return;

    // Referências para os dados que queremos observar
    const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
    const petsRef = ref(FIREBASE_DB, 'pets');
    
    // Função para processar os dados e atualizar o estado
    const processData = (userData, petsData) => {
      if (!userData || !petsData) return;
      
      // Processar os pets do usuário
      if (userData.pets) {
        const userPetsWithStatus = userData.pets
          .split(';')
          .map(petEntry => {
            const [petId, status] = petEntry.split(',');
            const pet = petsData[petId];
            if (!pet) return null;

            const priority = getPriorityLevel(status);
            
            return {
              id: petId,
              name: pet.name,
              image: pet.image || require('../assets/pet1.png'),
              priority,
              statusIcon: getStatusIcon(priority)
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.priority - b.priority);

        setMyPets(userPetsWithStatus);
      } else {
        setMyPets([]);
      }

      // Processar os pets disponíveis
      const userPetIds = userData?.pets ? userData.pets.split(';').map(pet => pet.split(',')[0]) : [];
      const availablePetsArray = Object.entries(petsData)
        .filter(([id, pet]) => 
          pet.status === 0 && !userPetIds.includes(id)
        )
        .map(([id, pet]) => ({
          id,
          name: pet.name,
          age: pet.age,
          gender: convertGender(pet.gender),
          size: convertSize(pet.size),
          image: pet.image || require('../assets/pet1.png'),
        }));

      setAvailablePets(availablePetsArray);
      setLoading(false);
    };

    // Dados do usuário
    let userData = null;
    let petsData = null;

    // Observer para dados do usuário
    const userListener = onValue(userRef, (snapshot) => {
      userData = snapshot.val();
      if (petsData) {
        processData(userData, petsData);
      }
    }, (error) => {
      console.error('Erro ao observar dados do usuário:', error);
      setLoading(false);
    });

    // Observer para todos os pets
    const petsListener = onValue(petsRef, (snapshot) => {
      petsData = snapshot.val();
      if (userData) {
        processData(userData, petsData);
      }
    }, (error) => {
      console.error('Erro ao observar dados dos pets:', error);
      setLoading(false);
    });

    // Limpeza ao desmontar o componente
    return () => {
      off(userRef, userListener);
      off(petsRef, petsListener);
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

  const PetStatusIcon = ({ iconName }) => {
    if (!iconName) return null;
    
    return (
      <View style={styles.statusIconContainer}>
        <MaterialIcons name={iconName} size={24} color="#FF4444" />
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Pets</Text>
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('WalkList')}>
            <MaterialIcons name="directions-walk" size={32} color="#7A5038" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <MaterialIcons name="person" size={32} color="#7A5038" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.myPetsCard}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Carregando seus pets...</Text>
          </View>
        ) : myPets.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {myPets.map((pet, index) => (
              <TouchableOpacity 
                key={pet.id}
                onPress={() => navigation.navigate('PetDetail', { petId: pet.id })}
                style={[
                  styles.petItem,
                  index === 0 ? { marginLeft: 0 } : null,
                  index === myPets.length - 1 ? { marginRight: 0 } : null,
                ]}
              >
                <View style={styles.petImageContainer}>
                  <Image 
                    source={typeof pet.image === 'string' ? { uri: pet.image } : pet.image} 
                    style={styles.petImage} 
                  />
                  <PetStatusIcon iconName={pet.statusIcon} />
                </View>
                <Text style={styles.petName}>{pet.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              Você ainda não possui pets cadastrados
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Apadrinhar um Pet</Text>

      <View style={styles.adoptionList}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Carregando pets disponíveis...</Text>
          </View>
        ) : availablePets.length > 0 ? (
          availablePets.map((pet) => (
            <TouchableOpacity 
              key={pet.id}
              onPress={() => navigation.navigate('PetDetail', { petId: pet.id })}
            >
              <View style={styles.adoptionCard}>
                <Image 
                  source={typeof pet.image === 'string' ? { uri: pet.image } : pet.image} 
                  style={styles.adoptionPetImage} 
                />
                <View style={styles.petInfo}>
                  <Text style={styles.adoptionPetName}>{pet.name}</Text>
                  <Text style={styles.petDetails}>Idade: {pet.age} anos</Text>
                  <Text style={styles.petDetails}>Sexo: {pet.gender}</Text>
                  <Text style={styles.petDetails}>Porte: {pet.size}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              Não há pets disponíveis para apadrinhamento no momento
            </Text>
          </View>
        )}
      </View>
      <View style={{height: 64}}/>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  myPetsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  petItem: {
    marginRight: 16,
    alignItems: 'center',
    width: 100,
  },
  petImageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  petImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  statusIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },
  petName: {
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyStateContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    textAlign: 'center',
  },
  adoptionList: {
    marginHorizontal: 16,
  },
  adoptionCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    marginBottom: 4,
  },
  petDetails: {
    color: '#666',
    marginBottom: 2,
  }
});