import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
  Alert, 
  SafeAreaView, // Adicionado
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, onValue, off, get, set } from 'firebase/database';
import Toast from 'react-native-toast-message';


const PixKeyModal = ({ visible, onClose, onSave, initialPixKey }) => {
  const [pixKeyValue, setPixKeyValue] = useState(initialPixKey || '');

  useEffect(() => {
    setPixKeyValue(initialPixKey || '');
  }, [initialPixKey]);

  const handleSave = () => {
    if (!pixKeyValue.trim()) {
      Alert.alert("Erro", "A chave PIX não pode estar vazia.");
      return;
    }
    onSave(pixKeyValue);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayPix}>
        <View style={styles.modalContentPix}>
          <View style={styles.modalHeaderPix}>
            <Text style={styles.modalTitlePix}>Configurar Chave PIX</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={28} color="#555" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalInstructionsPix}>
            Insira a chave PIX que será exibida para doações.
          </Text>
          <TextInput
            style={styles.pixInput}
            placeholder="Digite sua chave PIX aqui"
            value={pixKeyValue}
            onChangeText={setPixKeyValue}
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.saveButtonPix} onPress={handleSave}>
            <Text style={styles.saveButtonTextPix}>Salvar Chave PIX</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};


export const AdminScreen = ({ navigation }) => {
  const [requestedPets, setRequestedPets] = useState([]);
  const [allPets, setAllPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPixModal, setShowPixModal] = useState(false);
  const [currentPixKey, setCurrentPixKey] = useState('');

  // getRequestStatusIcon já retorna nome e cor, está correto.
  const getRequestStatusIcon = (status) => {
    switch (status) {
      case 0: return { name: "fiber-new", color: "#FF9800" }; 
      case 3: return { name: "remove-circle-outline", color: "#F44336" }; 
      case 4: case 41: return { name: "volunteer-activism", color: "#2196F3" }; 
      // Você pode adicionar um ícone para pets adotados (status 6) se quiser exibi-los aqui.
      // case 6: return { name: "pets", color: "#4CAF50" };
      default: return null;
    }
  };

  const loadPixKey = async () => {
    try {
      const settingsRef = ref(FIREBASE_DB, 'settings/pixKey');
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        setCurrentPixKey(snapshot.val());
      } else {
        setCurrentPixKey('');
      }
    } catch (error) {
      console.error("Erro ao carregar chave PIX:", error);
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível carregar a chave PIX.' });
    }
  };

  const handleOpenPixModal = async () => {
    await loadPixKey(); 
    setShowPixModal(true);
  };

  const handleSavePixKey = async (newPixKey) => {
    try {
      const settingsRef = ref(FIREBASE_DB, 'settings/pixKey');
      await set(settingsRef, newPixKey);
      setCurrentPixKey(newPixKey); 
      setShowPixModal(false);
      Toast.show({ type: 'success', text1: 'Sucesso', text2: 'Chave PIX salva!' });
    } catch (error) {
      console.error("Erro ao salvar chave PIX:", error);
      Alert.alert("Erro", "Não foi possível salvar a chave PIX.");
    }
  };


  useEffect(() => {
    const petsRef = ref(FIREBASE_DB, 'pets');
    const usersRef = ref(FIREBASE_DB, 'users');
    
    let petsDataSnapshot = null;
    let usersDataSnapshot = null;
    
    const processSnapshots = () => {
      if (!petsDataSnapshot || !usersDataSnapshot) return;

      const petsData = petsDataSnapshot.val();
      const usersData = usersDataSnapshot.val();

      if (!petsData || !usersData) {
          setRequestedPets([]);
          setAllPets([]);
          setLoading(false);
          return;
      }
      
      const requestedPetsArray = [];
      Object.entries(usersData).forEach(([userId, user]) => {
        if (user.pets && user.email) {
          const userPets = user.pets.split(';');
          userPets.forEach(petInfo => {
            const [petId, status] = petInfo.split(',');
            const statusNum = parseInt(status);
            
            // Filtra para status 0 (novo apadrinhamento), 3 (desapadrinhar), 4/41 (adoção)
            if ([0, 3, 4, 41].includes(statusNum)) {
              const pet = petsData[petId];
              if (pet) {
                requestedPetsArray.push({
                  id: petId,
                  name: pet.name,
                  image: pet.image ? { uri: pet.image } : require('../assets/pet1.png'),
                  status: statusNum,
                  userId: userId, 
                  userEmail: user.email, 
                  requestIconInfo: getRequestStatusIcon(statusNum) // Salva o objeto {name, color}
                });
              }
            }
          });
        }
      });
      requestedPetsArray.sort((a, b) => {
        const order = { 0: 1, 4: 2, 41: 2, 3: 3 }; // Pedidos de apadrinhamento/adoção primeiro
        return (order[a.status] || 99) - (order[b.status] || 99);
      });
      setRequestedPets(requestedPetsArray);

      const allPetsArray = Object.entries(petsData)
        .map(([id, pet]) => ({
            id,
            name: pet.name,
            age: pet.age, 
            gender: convertGender(pet.gender),
            size: convertSize(pet.size),
            image: pet.image ? { uri: pet.image } : require('../assets/pet1.png'),
      }));
      setAllPets(allPetsArray);
      setLoading(false);
    };

    const petsListener = onValue(petsRef, (snapshot) => {
      petsDataSnapshot = snapshot;
      processSnapshots();
    }, (error) => {
      console.error('Erro ao observar dados dos pets:', error);
      setLoading(false);
    });

    const usersListener = onValue(usersRef, (snapshot) => {
      usersDataSnapshot = snapshot;
      processSnapshots();
    }, (error) => {
      console.error('Erro ao observar dados dos usuários:', error);
      setLoading(false);
    });

    return () => {
      off(petsRef, 'value', petsListener);
      off(usersRef, 'value', usersListener);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Administração</Text>
          <View style={styles.iconContainer}>
            <TouchableOpacity onPress={handleOpenPixModal}>
              <MaterialIcons name="monetization-on" size={28} color="#7A5038" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ManageWalk')}>
              <MaterialIcons name="directions-walk" size={28} color="#7A5038" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <MaterialIcons name="person" size={28} color="#7A5038" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.sectionTitle}>Pedidos Pendentes</Text>
        <View style={styles.requestsCard}>
          {loading ? (
            <View style={styles.loadingContainer}><Text style={styles.loadingText}>Carregando pedidos...</Text></View>
          ) : requestedPets.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {requestedPets.map((pet) => (
                <TouchableOpacity
                  key={`${pet.id}-${pet.userId}-${pet.status}`}
                  onPress={() => 
                    navigation.navigate('Request', {
                      petId: pet.id,
                      userId: pet.userId, 
                      requestType: pet.status
                    })
                  }
                  style={styles.requestItem}
                >
                  <View style={styles.requestImageContainer}>
                    <Image source={pet.image} style={styles.requestImage} />
                    {/* Renderizar o ícone de status do pedido */}
                    {pet.requestIconInfo && (
                      <View style={[styles.requestStatusIconBadge, {backgroundColor: pet.requestIconInfo.color}]}>
                        <MaterialIcons 
                          name={pet.requestIconInfo.name} 
                          size={16} // Ícone um pouco menor para o badge
                          color="#FFFFFF" 
                        />
                      </View>
                    )}
                  </View>
                  <Text style={styles.requestPetName} numberOfLines={1}>{pet.name}</Text>
                  <Text style={styles.requestUserEmail} numberOfLines={1} ellipsizeMode="tail">
                    {pet.userEmail}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateContainer}><Text style={styles.emptyStateText}>Não há pedidos pendentes.</Text></View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.newPetButton}
          onPress={() => navigation.navigate('NewPet')}
        >
          <MaterialIcons name="add-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.newPetButtonText}>Cadastrar Novo Pet</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Todos os Pets Cadastrados</Text>

        {loading && allPets.length === 0 ? (
            <View style={styles.loadingContainer}><Text style={styles.loadingText}>Carregando pets...</Text></View>
        ) : !loading && allPets.length === 0 ? (
            <View style={styles.emptyStateContainerFullWidth}><Text style={styles.emptyStateText}>Não há pets cadastrados.</Text></View>
        ) : (
          <View style={styles.allPetsList}>
            {allPets.map((pet) => (
              <TouchableOpacity 
                key={pet.id}
                onPress={() => navigation.navigate('EditPet', { petId: pet.id })}
                style={styles.petCardOuter}
              >
                <View style={styles.petCard}>
                  <Image source={pet.image} style={styles.petImageLarge} />
                  <View style={styles.petCardInfo}>
                    <Text style={styles.petCardName}>{pet.name}</Text>
                    <Text style={styles.petCardDetails}>Idade: {pet.age}</Text>
                    <Text style={styles.petCardDetails}>Sexo: {pet.gender}</Text>
                    <Text style={styles.petCardDetails}>Porte: {pet.size}</Text>
                  </View>
                   <MaterialIcons name="edit" size={20} color="#7A5038" style={styles.editIcon}/>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      <PixKeyModal
        visible={showPixModal}
        onClose={() => setShowPixModal(false)}
        onSave={handleSavePixKey}
        initialPixKey={currentPixKey}
      />
      <Toast /> 
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ... (estilos do modal PIX e outros estilos existentes) ...
  modalOverlayPix: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentPix: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 25,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeaderPix: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 10,
  },
  modalTitlePix: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  modalInstructionsPix: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  pixInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  saveButtonPix: {
    backgroundColor: '#7A5038',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonTextPix: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  container: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 30, 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 25 : 10,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 22,
    color: '#7A5038',
    fontWeight: 'bold',
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 20, 
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    color: '#333333',
    fontWeight: 'bold',
    marginTop: 25,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  requestsCard: { 
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingVertical: 15,
    paddingHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 160, // Aumentar um pouco para acomodar o nome do usuário
  },
  horizontalScroll: { 
    paddingLeft: 10, 
    paddingRight: 5,
  },
  requestItem: {
    alignItems: 'center',
    marginRight: 15,
    width: 100, 
  },
  requestImageContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  requestImage: {
    width: 80,
    height: 80,
    borderRadius: 10, 
    borderWidth: 1,
    borderColor: '#EDEDED',
  },
  requestStatusIconBadge: { // Estilo para o badge de status do pedido
    position: 'absolute',
    top: -4,  // Ajustar posição
    right: -4,
    borderRadius: 12, // Círculo
    padding: 3, // Padding interno menor
    elevation: 3,
    borderWidth: 1, // Adicionar uma pequena borda branca para destacar
    borderColor: '#FFFFFF',
  },
  requestPetName: {
    fontSize: 14,
    color: '#444444',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  requestUserEmail: {
    fontSize: 11,
    color: '#777777',
    textAlign: 'center',
    width: '95%', // Para evitar que o texto muito longo quebre o layout
  },
  emptyStateContainer: { 
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1, 
  },
  emptyStateText: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
  },
  newPetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7A5038',
    borderRadius: 25, 
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 25, 
    marginBottom: 10, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  newPetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  allPetsList: { 
    marginHorizontal: 16,
    gap: 12,
  },
  petCardOuter: { 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  petCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center', 
    overflow: 'hidden',
  },
  petImageLarge: { 
    width: 70, 
    height: 70,
    borderRadius: 8,
  },
  petCardInfo: {
    marginLeft: 12,
    flex: 1, 
    justifyContent: 'center',
  },
  petCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 3,
  },
  petCardDetails: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 1,
  },
  editIcon: {
    padding: 5, 
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#666666',
  },
  emptyStateContainerFullWidth: { 
    paddingVertical: 30,
    alignItems: 'center',
    marginHorizontal: 16,
  },
});