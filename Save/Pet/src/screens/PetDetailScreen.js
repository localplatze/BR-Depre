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
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, set } from 'firebase/database';

const { width } = Dimensions.get('window');

const InfoDialog = ({ visible, onClose, title, content }) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.dialogContainer}>
        <View style={styles.dialogHeader}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#7A5038" />
          </TouchableOpacity>
        </View>
        <Text style={styles.dialogContent}>{content}</Text>
      </View>
    </View>
  </Modal>
);

const HistoryDialog = ({ visible, onClose, history }) => {
  const parseHistory = (historyString) => {
    try {
      return historyString.split(';').map(entry => {
        const [date, status] = entry.split(',');
        return {
          date,
          status: status === 'pad' ? 'Apadrinhado' : 'Desapadrinhado'
        };
      });
    } catch {
      return null;
    }
  };

  const historyEntries = history ? parseHistory(history) : null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.dialogContainer}>
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle}>Histórico</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#7A5038" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.historyList}>
            {historyEntries ? (
              historyEntries.map((entry, index) => (
                <View key={index} style={styles.historyEntry}>
                  <Text style={styles.historyDate}>{entry.date}</Text>
                  <Text style={styles.historyStatus}>{entry.status}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.errorText}>
                Não foi possível apresentar as informações no momento.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const PetDetailScreen = ({ navigation, route }) => {
  const [pet, setPet] = useState(null);
  const [sponsorshipStatus, setSponsorshipStatus] = useState(null);
  const [showHealthInfo, setShowHealthInfo] = useState(false);
  const [showBehaviorInfo, setShowBehaviorInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  useEffect(() => {
    const fetchPetDetails = async () => {
      try {
        const { petId } = route.params;
        const currentUser = FIREBASE_AUTH.currentUser;
        
        // Fetch pet details
        const petRef = ref(FIREBASE_DB, `pets/${petId}`);
        const petSnapshot = await get(petRef);
        const petData = petSnapshot.val();
        
        if (petData) {
          setPet(petData);
          
          // Check user's sponsorship status for this pet
          if (currentUser) {
            const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();
            
            if (userData?.pets) {
              const userPets = userData.pets.split(';');
              const thisPet = userPets.find(p => p.split(',')[0] === petId);
              if (thisPet) {
                setSponsorshipStatus(parseInt(thisPet.split(',')[1]));
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching pet details:', error);
      }
    };
    
    fetchPetDetails();
  }, [route.params]);

  const getStatusConfig = () => {
    if (sponsorshipStatus === null) return {
      text: pet?.status === 0 ? 'Disponível' : 'Indisponível',
      color: pet?.status === 0 ? '#00FF00' : '#FF0000'
    };
    
    switch (sponsorshipStatus) {
      case 0:
        return {
          text: 'Aguardando Confirmação de Apadrinhamento',
          color: '#FFA500'
        };
      case 1:
        return {
          text: 'Apadrinhado',
          color: '#00FF00'
        };
      case 2:
        return {
          text: 'Apadrinhamento Negado',
          color: '#FF0000'
        };
      case 3:
        return {
          text: 'Solicitando Desapadrinhamento',
          color: '#FF0000'
        };
      case 4:
        return {
          text: 'Aguardando Confirmação de Adoção',
          color: '#FFA500'
        };
      case 41:
        return {
          text: 'Aguardando Confirmação de Adoção',
          color: '#FFA500'
        };
      case 5:
        return {
          text: 'Adoção Negada',
          color: '#FF0000'
        };
      case 51:
        return {
          text: 'Adoção Negada',
          color: '#FF0000'
        };
      case 6:
        return {
          text: 'Adoção Aceita',
          color: '#00FF00'
        };
      default:
        return {
          text: 'Status Desconhecido',
          color: '#666666'
        };
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

  const handleSponsorshipAction = async () => {
    try {
      const currentUser = FIREBASE_AUTH.currentUser;
      if (!currentUser) return;
  
      const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();
  
      let userPets = userData?.pets ? userData.pets.split(';') : [];
      const petId = route.params.petId;
  
      if (sponsorshipStatus === null) {
        // New sponsorship
        userPets.push(`${petId},0`);
      } else if (sponsorshipStatus === 1) {
        // Navigate to calendar with petId
        navigation.navigate('Calendar', { petId: petId });
        return;
      }
  
      // Update user's pets in Firebase
      await set(userRef, {
        ...userData,
        pets: userPets.join(';')
      });
  
      setSponsorshipStatus(0);
    } catch (error) {
      console.error('Error updating sponsorship:', error);
    }
  };

  const handleAdoption = () => {
    Alert.alert(
      "Adoção",
      "Você realmente deseja adotar este pet?",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Sim",
          onPress: async () => {
            try {
              const currentUser = FIREBASE_AUTH.currentUser;
              if (!currentUser) return;

              const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
              const userSnapshot = await get(userRef);
              const userData = userSnapshot.val();

              let userPets = userData?.pets ? userData.pets.split(';') : [];
              const petId = route.params.petId;
              const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);

              // Determine o novo status baseado no status atual
              const newStatus = [1, 51].includes(sponsorshipStatus) ? 41 : 4;

              if (petIndex >= 0) {
                userPets[petIndex] = `${petId},${newStatus}`;
              } else {
                userPets.push(`${petId},${newStatus}`);
              }

              await set(userRef, {
                ...userData,
                pets: userPets.join(';')
              });

              setSponsorshipStatus(newStatus);
            } catch (error) {
              console.error('Error updating adoption status:', error);
            }
          }
        }
      ]
    );
  };

  const handleUnsponsor = () => {
    Alert.alert(
      "Desapadrinhar",
      "Você realmente deseja desapadrinhar este pet?",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Sim",
          onPress: async () => {
            try {
              const currentUser = FIREBASE_AUTH.currentUser;
              if (!currentUser) return;

              const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
              const userSnapshot = await get(userRef);
              const userData = userSnapshot.val();

              let userPets = userData?.pets ? userData.pets.split(';') : [];
              const petId = route.params.petId;
              const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);

              if (petIndex >= 0) {
                userPets[petIndex] = `${petId},3`;
              }

              await set(userRef, {
                ...userData,
                pets: userPets.join(';')
              });

              setSponsorshipStatus(3);
            } catch (error) {
              console.error('Error updating sponsorship status:', error);
            }
          }
        }
      ]
    );
  };

  if (!pet) return null;

  const statusConfig = getStatusConfig();
  const showLeftAction = sponsorshipStatus !== 3 || sponsorshipStatus !== 0 || sponsorshipStatus !== 6;
  const showRightAction = sponsorshipStatus !== 4 || sponsorshipStatus !== 41 || sponsorshipStatus !== 6;
  const showUnsponsorButton = sponsorshipStatus === 1 || sponsorshipStatus === 41|| sponsorshipStatus === 51 || sponsorshipStatus !== 6;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>{pet.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={pet.image ? { uri: pet.image } : require('../assets/pet1.png')}
            style={styles.petImage}
          />
          <View style={styles.actionButtons}>
            {showLeftAction && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleSponsorshipAction}
              >
                <Text style={styles.actionButtonText}>
                  {sponsorshipStatus === 1 || sponsorshipStatus === 41 || sponsorshipStatus === 51 ? 'Visita' : 'Apadrinhar'}
                </Text>
              </TouchableOpacity>
            )}
            {showRightAction && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleAdoption}
              >
                <Text style={styles.actionButtonText}>
                  Adotar
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={styles.statusText}>
              Status: {statusConfig.text}
            </Text>
          </View>

          <Text style={styles.nameLabel}>Nome: {pet.name}</Text>
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {pet.age} anos - Porte {convertSize(pet.size)} - {convertGender(pet.gender)}
            </Text>
          </View>

          <View style={styles.menuButtons}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setShowHealthInfo(true)}
            >
              <Text style={styles.menuButtonText}>Informações de Saúde</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setShowBehaviorInfo(true)}
            >
              <Text style={styles.menuButtonText}>Comportamento</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setShowHistory(true)}
            >
              <Text style={styles.menuButtonText}>Histórico</Text>
            </TouchableOpacity>

            {showUnsponsorButton && (
              <TouchableOpacity 
                style={[styles.menuButton, styles.unsponsorButton]}
                onPress={handleUnsponsor}
              >
                <Text style={styles.menuButtonText}>Desapadrinhar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <InfoDialog
        visible={showHealthInfo}
        onClose={() => setShowHealthInfo(false)}
        title="Informações de Saúde"
        content={pet.health || "Não há informações disponíveis"}
      />

      <InfoDialog
        visible={showBehaviorInfo}
        onClose={() => setShowBehaviorInfo(false)}
        title="Comportamento"
        content={pet.behavior || "Não há informações disponíveis"}
      />

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
  },
  imageContainer: {
    position: 'relative',
  },
  petImage: {
    width: width,
    height: width,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
  },
  detailsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    marginTop: -24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00FF00',
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
  },
  nameLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoContainer: {
    marginBottom: 24,
  },
  infoText: {
    fontSize: 16,
  },
  menuButtons: {
    gap: 16,
  },
  menuButton: {
    backgroundColor: '#7A5038',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '90%',
    maxHeight: '80%',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  dialogContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  historyList: {
    maxHeight: 300,
  },
  historyEntry: {
    marginBottom: 16,
  },
  historyDate: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: 16,
    color: '#000000',
  },
  errorText: {
    fontSize: 16,
    color: '#FF0000',
    textAlign: 'center',
  },
  unsponsorButton: {
    backgroundColor: '#FF4444',
  },
});

export default PetDetailScreen;