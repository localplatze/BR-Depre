import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB, FIREBASE_STORAGE } from '../firebaseConnection';
import { ref, get, set, remove, query, orderByChild, equalTo } from 'firebase/database';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import HistoryDialog from './../components/HistoryDialog';

const { width } = Dimensions.get('window');

export const RequestScreen = ({ navigation, route }) => {
  const [pet, setPet] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestType, setRequestType] = useState(null);
  const [alreadySponsor, setAlreadySponsor] = useState(false);
  const [sponsorshipDuration, setSponsorshipDuration] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { petId, userId, requestType } = route.params;
        
        setRequestType(requestType);
        
        // Fetch pet details
        const petRef = ref(FIREBASE_DB, `pets/${petId}`);
        const petSnapshot = await get(petRef);
        const petData = petSnapshot.val();
        
        if (petData) {
          setPet(petData);
        }
        
        // Fetch user details by userId
        const usersRef = ref(FIREBASE_DB, 'users');
        const userQuery = query(usersRef, orderByChild('email'), equalTo(userId));
        const userSnapshot = await get(userQuery);
        
        if (userSnapshot.exists()) {
          // Get the first user with matching email
          const userData = Object.values(userSnapshot.val())[0];
          setUser(userData);
          
          // Check if the user is already a sponsor
          if (userData.pets && petId) {
            const userPets = userData.pets.split(';');
            const thisPet = userPets.find(p => p.split(',')[0] === petId);
            
            if (thisPet) {
              const status = parseInt(thisPet.split(',')[1]);
              setAlreadySponsor(status === 1 || status === 41);
              
              // If this is a sponsor, calculate duration
              if (status === 1 || status === 41) {
                calculateSponsorshipDuration(petData.historic);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Erro', 'Não foi possível carregar os dados necessários.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [route.params]);
  
  const calculateSponsorshipDuration = (historic) => {
    if (!historic) return;
    
    try {
      const events = historic.split(';');
      // Find most recent 'pad' event
      const padEvents = events.filter(e => e.split(',')[1] === 'pad');
      
      if (padEvents.length > 0) {
        const latestPadEvent = padEvents[padEvents.length - 1];
        const padDate = latestPadEvent.split(',')[0];
        
        // Parse date and calculate duration
        const [day, month, year] = padDate.split('/');
        const sponsorshipStartDate = new Date(`${year}-${month}-${day}`);
        const now = new Date();
        
        // Calculate difference in days
        const diffTime = Math.abs(now - sponsorshipStartDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        setSponsorshipDuration(diffDays);
      }
    } catch (error) {
      console.error('Error calculating sponsorship duration:', error);
    }
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + 
                      (now.getMonth() - date.getMonth());
    
    return diffMonths === 0 ? "Menos de 1 mês" : `${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'}`;
  };
  
  const formatPetsInfo = (petsString) => {
    if (!petsString) return "Nenhum pet apadrinhado";
    
    const petsCount = petsString.split(';').length;
    return `${petsCount} ${petsCount === 1 ? 'pet' : 'pets'} apadrinhados`;
  };
  
  const getCurrentDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    
    return `${day}/${month}/${year}`;
  };
  
  const handleAccept = async () => {
    try {
      if (!user || !pet) return;
      
      const petId = route.params.petId;
      const usersRef = ref(FIREBASE_DB, 'users');
      const userQuery = query(usersRef, orderByChild('email'), equalTo(user.email));
      const userSnapshot = await get(userQuery);
      
      if (!userSnapshot.exists()) {
        throw new Error('Usuário não encontrado');
      }
      
      // Get user key and data
      const userKey = Object.keys(userSnapshot.val())[0];
      const userData = userSnapshot.val()[userKey];
      const userPets = userData.pets ? userData.pets.split(';') : [];
      const petRef = ref(FIREBASE_DB, `pets/${petId}`);
      const currentPetData = (await get(petRef)).val();
      let updatedPetHistoric = currentPetData.historic || '';
      const currentDate = getCurrentDate();
      
      // Find the pet in user's pets
      const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);
      
      if (requestType === 0) {
        // Accept sponsorship request
        if (petIndex >= 0) {
          userPets[petIndex] = `${petId},1`;
        } else {
          // If pet is not in user's list, add it
          userPets.push(`${petId},1`);
        }
        
        // Update pet historic
        if (updatedPetHistoric) {
          updatedPetHistoric += `;${currentDate},pad`;
        } else {
          updatedPetHistoric = `${currentDate},pad`;
        }
        
        // Update pet data
        await set(petRef, {
          ...currentPetData,
          historic: updatedPetHistoric
        });
      } else if (requestType === 3) {
        // Accept unsponsor request
        if (petIndex >= 0) {
          userPets.splice(petIndex, 1);
        }
        
        // Update pet historic
        if (updatedPetHistoric) {
          updatedPetHistoric += `;${currentDate},des`;
        } else {
          updatedPetHistoric = `${currentDate},des`;
        }
        
        // Update pet data
        await set(petRef, {
          ...currentPetData,
          historic: updatedPetHistoric
        });
      } else if (requestType === 4 || requestType === 41) {
        // Accept adoption request
        if (petIndex >= 0) {
          userPets[petIndex] = `${petId},6`;
        } else {
          // If pet is not in user's list, add it
          userPets.push(`${petId},6`);
        }
        
        // Update pet data (change status but don't modify historic)
        await set(petRef, {
          ...currentPetData,
          status: "6" // Assuming you're tracking status at pet level too
        });
      } else if (requestType === 6) {
        // Finalize adoption
        if (petIndex >= 0) {
          userPets.splice(petIndex, 1);
        }
        
        // Delete pet from database
        await remove(petRef);
        
        // Delete pet image from storage if exists
        if (currentPetData.image) {
          try {
            const imageRef = storageRef(FIREBASE_STORAGE, currentPetData.image);
            await deleteObject(imageRef);
          } catch (imgError) {
            console.error('Error deleting image:', imgError);
            // Continue with the process even if image deletion fails
          }
        }
      }
      
      // Update user data
      const userRef = ref(FIREBASE_DB, `users/${userKey}`);
      await set(userRef, {
        ...userData,
        pets: userPets.length > 0 ? userPets.join(';') : ""
      });
      
      Alert.alert(
        'Sucesso',
        'Solicitação processada com sucesso',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error handling accept:', error);
      Alert.alert('Erro', 'Não foi possível processar a solicitação.');
    }
  };  
  
  const handleReject = async () => {
    try {
      if (!user || !pet) return;
      
      const petId = route.params.petId;
      const usersRef = ref(FIREBASE_DB, 'users');
      const userQuery = query(usersRef, orderByChild('email'), equalTo(user.email));
      const userSnapshot = await get(userQuery);
      
      if (!userSnapshot.exists()) {
        throw new Error('Usuário não encontrado');
      }
      
      // Get user key and data
      const userKey = Object.keys(userSnapshot.val())[0];
      const userData = userSnapshot.val()[userKey];
      const userPets = userData.pets ? userData.pets.split(';') : [];
      const petRef = ref(FIREBASE_DB, `pets/${petId}`);
      const currentPetData = (await get(petRef)).val();
      
      // Find the pet in user's pets
      const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);
      let newStatus = null;
      
      if (requestType === 0) {
        // Reject sponsorship
        newStatus = "2";
        if (petIndex >= 0) {
          userPets[petIndex] = `${petId},2`;
        } else {
          userPets.push(`${petId},2`);
        }
      } else if (requestType === 4) {
        // Reject adoption for non-sponsor
        newStatus = "5";
        if (petIndex >= 0) {
          userPets[petIndex] = `${petId},5`;
        } else {
          userPets.push(`${petId},5`);
        }
      } else if (requestType === 41) {
        // Reject adoption for existing sponsor
        newStatus = "51";
        if (petIndex >= 0) {
          userPets[petIndex] = `${petId},51`;
        } else {
          userPets.push(`${petId},51`);
        }
      }
      
      // Update pet data if status was changed
      if (newStatus) {
        await set(petRef, {
          ...currentPetData,
          status: newStatus
        });
      }
      
      // Update user data
      const userRef = ref(FIREBASE_DB, `users/${userKey}`);
      await set(userRef, {
        ...userData,
        pets: userPets.length > 0 ? userPets.join(';') : ""
      });
      
      Alert.alert(
        'Sucesso',
        'Solicitação rejeitada com sucesso',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error handling reject:', error);
      Alert.alert('Erro', 'Não foi possível rejeitar a solicitação.');
    }
  };

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

  const getRequestDescription = (requestType) => {
    const descriptions = {
      0: "Solicitação de Apadrinhamento",
      2: "Solic. de Desapadrinhamento",
      4: "Solic. de Adoção",
      41: "Solic. de Adoção (Padrinho)",
      6: "Adoção Aprovada"
    };
    return descriptions[requestType] || "Solicitação Desconhecida";
  };
  
  if (loading || !pet || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
          </TouchableOpacity>
          <Text style={styles.toolbarTitle}>Carregando...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Carregando informações...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Define showRejectButton here before using it in JSX
  const showRejectButton = requestType === 0 || requestType === 4 || requestType === 41;
  
  let requestTypeText = "Solicitação";
  if (requestType === "0") requestTypeText = "Solicitação de Apadrinhamento";
  else if (requestType === "3") requestTypeText = "Solicitação de Desapadrinhamento";
  else if (requestType === "4" || requestType === "41") requestTypeText = "Solicitação de Adoção";
  else if (requestType === "6") requestTypeText = "Finalização de Adoção";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>{requestTypeText}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Pet Information Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Informações do Pet</Text>
          
          <View style={styles.petInfoContainer}>
            <Image
              source={pet.image ? { uri: pet.image } : require('../assets/pet1.png')}
              style={styles.petImage}
            />
            
            <View style={styles.petDetails}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petInfo}>
                {pet.age} anos - Porte {convertSize(pet.size)} - {convertGender(pet.gender)}
              </Text>
              
              {(requestType === "4" || requestType === "41") && alreadySponsor && sponsorshipDuration && (
                <Text style={styles.sponsorInfo}>
                  {user.name} é padrinho há {sponsorshipDuration} dias
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.requestTypeText}>
            {getRequestDescription(route.params.requestType)}
          </Text>
          
          <View style={styles.petAttributesContainer}>
            <Text style={styles.attributeTitle}>Saúde</Text>
            <Text style={styles.attributeText}>{pet.health || "Não informado"}</Text>
            
            <Text style={styles.attributeTitle}>Comportamento</Text>
            <Text style={styles.attributeText}>{pet.behavior || "Não informado"}</Text>
            
            <View style={styles.historyHeader}>
              <Text style={styles.attributeTitle}>Histórico</Text>
              {pet.historic && (
                <TouchableOpacity 
                  style={styles.viewHistoryButton}
                  onPress={() => setShowHistory(true)}
                >
                  <Text style={styles.viewHistoryText}>Ver Detalhes</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        
        {/* User Information Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Informações do Solicitante</Text>
          
          <View style={styles.userInfoItem}>
            <Text style={styles.infoLabel}>Nome:</Text>
            <Text style={styles.infoValue}>{user.name}</Text>
          </View>
          
          <View style={styles.userInfoItem}>
            <Text style={styles.infoLabel}>Contato:</Text>
            <Text style={styles.infoValue}>{user.phone || "Não informado"}</Text>
          </View>
          
          <View style={styles.userInfoItem}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
          
          <View style={styles.userInfoItem}>
            <Text style={styles.infoLabel}>Outros pets:</Text>
            <Text style={styles.infoValue}>{formatPetsInfo(user.pets)}</Text>
          </View>
          
          <View style={styles.userInfoItem}>
            <Text style={styles.infoLabel}>Tempo no app:</Text>
            <Text style={styles.infoValue}>{formatTimestamp(user.createdAt)}</Text>
          </View>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={handleAccept}
          >
            <Text style={styles.buttonText}>Aceitar</Text>
          </TouchableOpacity>
          
          {showRejectButton && (
            <TouchableOpacity 
              style={styles.rejectButton}
              onPress={handleReject}
            >
              <Text style={styles.buttonText}>Recusar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <HistoryDialog 
        visible={showHistory} 
        onClose={() => setShowHistory(false)} 
        history={pet.historic}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 32
  },
  toolbarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7A5038',
    marginBottom: 16,
  },
  petInfoContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  petDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  petName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  petInfo: {
    fontSize: 14,
    color: '#666666',
  },
  sponsorInfo: {
    fontSize: 14,
    color: '#008000',
    marginTop: 8,
  },
  petAttributesContainer: {
    marginTop: 8,
  },
  attributeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  attributeText: {
    fontSize: 14,
    color: '#333333',
  },
  userInfoItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  infoLabel: {
    width: 100,
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#7A5038',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestTypeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7A5038',
    textAlign: 'center',
    marginVertical: 8,
  }
});

export default RequestScreen;