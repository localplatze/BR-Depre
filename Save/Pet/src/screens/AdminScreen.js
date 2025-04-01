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

export const AdminScreen = ({ navigation }) => {
  const [requestedPets, setRequestedPets] = useState([]);
  const [allPets, setAllPets] = useState([]);
  const [loading, setLoading] = useState(true);

  const getStatusIcon = (status) => {
    switch (status) {
      case 0:
        return { name: "fiber-new", color: "#4CAF50" };
      case 3:
        return { name: "remove-circle", color: "#F44336" };
      case 4:
      case 41:
        return { name: "favorite", color: "#2196F3" };
      case 6:
        return { name: "pets", color: "#2196F3" };
      default:
        return null;
    }
  };

  useEffect(() => {
    // Referências para os dados que queremos observar
    const petsRef = ref(FIREBASE_DB, 'pets');
    const usersRef = ref(FIREBASE_DB, 'users');
    
    // Variáveis para armazenar os dados
    let petsData = null;
    let usersData = null;
    
    // Função para processar os dados quando ambos estiverem disponíveis
    const processData = () => {
      if (!petsData || !usersData) return;
      
      // Process pet requests
      const requestedPetsArray = [];
      Object.entries(usersData).forEach(([userId, user]) => {
        if (user.pets) {
          const userPets = user.pets.split(';');
          userPets.forEach(petInfo => {
            const [petId, status] = petInfo.split(',');
            const statusNum = parseInt(status);
            
            // Filter only status 0, 3, 4, or 41
            if ([0, 3, 4, 41].includes(statusNum)) {
              const pet = petsData[petId];
              if (pet) {
                requestedPetsArray.push({
                  id: petId,
                  name: pet.name,
                  image: pet.image || require('../assets/pet1.png'),
                  status: statusNum,
                  user: user.email,
                  statusIcon: getStatusIcon(statusNum)
                });
              }
            }
          });
        }
      });

      setRequestedPets(requestedPetsArray);

      // Process all pets
      const allPetsArray = Object.entries(petsData).map(([id, pet]) => ({
        id,
        name: pet.name,
        age: pet.age,
        gender: convertGender(pet.gender),
        size: convertSize(pet.size),
        image: pet.image || require('../assets/pet1.png'),
        status: pet.status
      }));

      setAllPets(allPetsArray);
      setLoading(false);
    };

    // Observer para dados dos pets
    const petsListener = onValue(petsRef, (snapshot) => {
      petsData = snapshot.val();
      processData();
    }, (error) => {
      console.error('Erro ao observar dados dos pets:', error);
      setLoading(false);
    });

    // Observer para dados dos usuários
    const usersListener = onValue(usersRef, (snapshot) => {
      usersData = snapshot.val();
      processData();
    }, (error) => {
      console.error('Erro ao observar dados dos usuários:', error);
      setLoading(false);
    });

    // Limpeza ao desmontar o componente
    return () => {
      off(petsRef, petsListener);
      off(usersRef, usersListener);
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Administração</Text>
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('ManageWalk')}>
            <MaterialIcons name="directions-walk" size={32} color="#7A5038" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <MaterialIcons name="person" size={32} color="#7A5038" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.sectionSubtitle}>Pedidos de Apadrinhamento / Adoção</Text>

      <View style={styles.myPetsCard}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando pedidos...</Text>
          </View>
        ) : requestedPets.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {requestedPets.map((pet, index) => (
              <TouchableOpacity
                key={`${pet.id}-${pet.userId}-${pet.status}`}
                onPress={() => 
                  navigation.navigate('Request', {
                    petId: pet.id,
                    userId: pet.user,
                    requestType: pet.status
                  })
                }
                style={[
                  styles.petItem,
                  index === 0 ? { marginLeft: 0 } : null,
                  index === requestedPets.length - 1 ? { marginRight: 0 } : null,
                ]}
              >
                <View style={styles.petImageContainer}>
                  <Image 
                    source={typeof pet.image === 'string' ? { uri: pet.image } : pet.image} 
                    style={styles.petImage} 
                  />
                  {pet.statusIcon && (
                    <View style={styles.statusIconContainer}>
                      <MaterialIcons 
                        name={pet.statusIcon.name} 
                        size={24} 
                        color={pet.statusIcon.color} 
                      />
                    </View>
                  )}
                </View>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petUser} numberOfLines={1} ellipsizeMode="tail">
                  {pet.user}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              Não há pedidos pendentes
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('NewPet')}
      >
        <Text style={styles.menuButtonText}>Cadastrar Pet</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Pets Cadastrados</Text>

      <View style={styles.adoptionList}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando pets...</Text>
          </View>
        ) : allPets.length > 0 ? (
          allPets.map((pet) => (
            <TouchableOpacity 
              key={pet.id}
              onPress={() => navigation.navigate('EditPet', { petId: pet.id })}
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
              Não há pets cadastrados
            </Text>
          </View>
        )}
        <View style={{height: 80}}/>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    color: '#7A5038',
    fontWeight: 'bold',
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  myPetsCard: {
    borderWidth: 2,
    borderColor: '#7A5038',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  petItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 120,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    elevation: 2,
    marginBottom: 8,
  },
  petName: {
    fontSize: 16,
    color: '#7A5038',
    textAlign: 'center',
  },
  petUser: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    width: '100%',
  },
  emptyStateContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    color: '#7A5038',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#7A5038',
    marginBottom: 16,
  },
  adoptionList: {
    gap: 16,
  },
  adoptionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  adoptionPetImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    elevation: 2,
  },
  petInfo: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  adoptionPetName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7A5038',
    marginBottom: 8,
  },
  petDetails: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  menuButton: {
    backgroundColor: '#7A5038',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  petImageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  statusIconContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
    elevation: 3,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  }
});