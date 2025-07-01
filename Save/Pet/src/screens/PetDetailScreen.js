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
  Platform,
  Clipboard, // Importar Clipboard
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, set } from 'firebase/database'; // 'set' já estava, mas garantindo
import Toast from 'react-native-toast-message'; // Para feedback de cópia


const { width } = Dimensions.get('window');

// ... (Seus componentes InfoDialog e HistoryDialog permanecem os mesmos) ...
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

  // --- NOVO ESTADO PARA CHAVE PIX ---
  const [pixKey, setPixKey] = useState('');
  const [loadingPixKey, setLoadingPixKey] = useState(true);
  // --- FIM NOVO ESTADO ---
  
  useEffect(() => {
    const fetchPetDetailsAndPix = async () => { // Renomeado para clareza
      try {
        const { petId } = route.params;
        const currentUser = FIREBASE_AUTH.currentUser;
        
        // Fetch pet details
        const petRef = ref(FIREBASE_DB, `pets/${petId}`);
        const petSnapshot = await get(petRef);
        const petData = petSnapshot.val();
        
        if (petData) {
          setPet(petData);
          
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

      // --- CARREGAR CHAVE PIX ---
      try {
        setLoadingPixKey(true);
        const settingsRef = ref(FIREBASE_DB, 'settings/pixKey');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          setPixKey(snapshot.val());
        }
      } catch (error) {
        console.error("Erro ao carregar chave PIX para doação:", error);
      } finally {
        setLoadingPixKey(false);
      }
      // --- FIM CARREGAR CHAVE PIX ---
    };
    
    fetchPetDetailsAndPix();
  }, [route.params]);


  // --- FUNÇÃO PARA COPIAR PIX ---
  const copyToClipboard = () => {
    if (pixKey) {
      Clipboard.setString(pixKey);
      Toast.show({
        type: 'success',
        text1: 'Chave PIX Copiada!',
        text2: pixKey,
      });
    }
  };
  // --- FIM FUNÇÃO PARA COPIAR PIX ---


  const getStatusConfig = () => {
    if (sponsorshipStatus === null) return {
      text: pet?.status === 0 ? 'Disponível' : 'Indisponível',
      color: pet?.status === 0 ? '#4CAF50' : '#F44336' // Cores mais vibrantes
    };
    
    switch (sponsorshipStatus) {
      case 0: return { text: 'Aguardando Confirmação de Apadrinhamento', color: '#FF9800' };
      case 1: return { text: 'Apadrinhado por você', color: '#4CAF50' };
      case 2: return { text: 'Apadrinhamento Negado', color: '#F44336' };
      case 3: return { text: 'Solicitando Desapadrinhamento', color: '#FFC107' };
      case 4: case 41: return { text: 'Aguardando Confirmação de Adoção', color: '#2196F3' };
      case 5: case 51: return { text: 'Adoção Negada', color: '#F44336' };
      case 6: return { text: 'Adotado por você', color: '#00BCD4' }; // Cor diferente para adotado
      default: return { text: 'Status Desconhecido', color: '#9E9E9E' };
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
      if (!currentUser) {
        Alert.alert("Login Necessário", "Você precisa estar logado para apadrinhar.");
        // Opcional: navigation.navigate('Login');
        return;
      }
  
      const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();
  
      let userPets = userData?.pets ? userData.pets.split(';') : [];
      const petId = route.params.petId;
  
      // Se o pet já está na lista do usuário com outro status, atualiza. Senão, adiciona.
      const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);

      if (sponsorshipStatus === null && pet?.status === 0) { // Só pode apadrinhar se disponível
        if (petIndex >= 0) {
            userPets[petIndex] = `${petId},0`; // Atualiza para pendente de apadrinhamento
        } else {
            userPets.push(`${petId},0`);
        }
        await set(userRef, { ...userData, pets: userPets.join(';') });
        setSponsorshipStatus(0); // Atualiza o estado local
        Toast.show({type: 'info', text1: 'Solicitação Enviada', text2: 'Aguardando confirmação do abrigo.'});

      } else if (sponsorshipStatus === 1) { // Se já apadrinhado, vai para o calendário
        navigation.navigate('Calendar', { petId: petId });
        return;
      } else if (pet?.status !== 0 && sponsorshipStatus === null) {
        Alert.alert("Indisponível", "Este pet não está disponível para apadrinhamento no momento.");
      }
  
    } catch (error) {
      console.error('Error updating sponsorship:', error);
      Alert.alert("Erro", "Ocorreu um erro ao processar sua solicitação.");
    }
  };

  const handleAdoption = () => {
    const currentUser = FIREBASE_AUTH.currentUser;
      if (!currentUser) {
        Alert.alert("Login Necessário", "Você precisa estar logado para solicitar adoção.");
        return;
    }
    Alert.alert(
      "Confirmar Adoção", "Ao confirmar, você iniciará o processo de adoção. Entraremos em contato para os próximos passos. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sim, quero adotar!", onPress: async () => {
            try {
              const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
              const userSnapshot = await get(userRef);
              const userData = userSnapshot.val();
              let userPets = userData?.pets ? userData.pets.split(';') : [];
              const petId = route.params.petId;
              const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);
              
              // Se o usuário já apadrinha (status 1 ou 51-adoção negada e quer tentar de novo) -> 41
              // Senão, é uma nova solicitação de adoção -> 4
              const newStatus = (sponsorshipStatus === 1 || sponsorshipStatus === 51) ? 41 : 4;

              if (petIndex >= 0) userPets[petIndex] = `${petId},${newStatus}`;
              else userPets.push(`${petId},${newStatus}`);

              await set(userRef, { ...userData, pets: userPets.join(';') });
              setSponsorshipStatus(newStatus); // Atualiza o estado local
              Toast.show({type: 'info', text1: 'Solicitação de Adoção Enviada', text2: 'Aguarde nosso contato!'});
            } catch (error) { 
                console.error('Error updating adoption status:', error); 
                Alert.alert("Erro", "Não foi possível processar a solicitação de adoção.");
            }
          }
        }
      ]
    );
  };

  const handleUnsponsor = () => {
    const currentUser = FIREBASE_AUTH.currentUser;
      if (!currentUser) {
        Alert.alert("Login Necessário", "Você precisa estar logado.");
        return;
    }
    Alert.alert(
      "Desapadrinhar Pet", "Tem certeza que deseja cancelar o apadrinhamento deste pet? Sentiremos sua falta!",
      [
        { text: "Manter Apadrinhamento", style: "cancel" },
        { text: "Sim, desapadrinhar", style: "destructive", onPress: async () => {
            try {
              const userRef = ref(FIREBASE_DB, `users/${currentUser.uid}`);
              const userSnapshot = await get(userRef);
              const userData = userSnapshot.val();
              let userPets = userData?.pets ? userData.pets.split(';') : [];
              const petId = route.params.petId;
              const petIndex = userPets.findIndex(p => p.split(',')[0] === petId);

              if (petIndex >= 0) {
                // Se o status for 1 (apadrinhado), muda para 3 (solicitando desapadrinhamento)
                // Se for outro status (ex: adoção pendente), permite cancelar a interação
                if (sponsorshipStatus === 1) {
                    userPets[petIndex] = `${petId},3`; 
                    await set(userRef, { ...userData, pets: userPets.join(';') });
                    setSponsorshipStatus(3);
                    Toast.show({type: 'info', text1: 'Solicitação de Desapadrinhamento Enviada'});
                } else if ([0,4,41,5,51].includes(sponsorshipStatus)) { // Permite cancelar outras solicitações
                    userPets.splice(petIndex, 1); // Remove o pet da lista do usuário
                    await set(userRef, { ...userData, pets: userPets.join(';') });
                    setSponsorshipStatus(null); // Volta ao estado inicial
                    Toast.show({type: 'info', text1: 'Solicitação Cancelada'});
                }
              } else {
                 Alert.alert("Erro", "Não encontramos este pet em sua lista.");
              }
            } catch (error) { 
                console.error('Error updating sponsorship status:', error); 
                Alert.alert("Erro", "Não foi possível processar o desapadrinhamento.");
            }
          }
        }
      ]
    );
  };

  if (!pet) return (
    <SafeAreaView style={styles.container}>
        <View style={styles.toolbar}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
                <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
            </TouchableOpacity>
            <Text style={styles.toolbarTitle}>Carregando...</Text>
            <View style={{ width: 24 }} />
        </View>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <Text>Carregando detalhes do pet...</Text>
        </View>
    </SafeAreaView>
  );


  const statusConfig = getStatusConfig();
  // Lógica de exibição dos botões de ação principal
  const canSponsor = sponsorshipStatus === null && pet.status === 0; // Só pode apadrinhar se disponível e não interagiu
  const isSponsoring = sponsorshipStatus === 1; // Já está apadrinhando (botão de visita)
  const canAdopt = sponsorshipStatus !== 6 && sponsorshipStatus !==4 && sponsorshipStatus !==41; // Não pode adotar se já adotou ou está em processo

  // Lógica para botão de cancelar/desapadrinhar
  // Mostra se tem alguma interação (0,1,3,4,41,5,51) mas não se já adotou (6)
  const showCancelOrUnsponsorButton = sponsorshipStatus !== null && sponsorshipStatus !== 6;
  let cancelOrUnsponsorText = "Cancelar Solicitação";
  if (sponsorshipStatus === 1) cancelOrUnsponsorText = "Desapadrinhar";
  else if (sponsorshipStatus === 3) cancelOrUnsponsorText = "Cancelar Desapadrinhamento";


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>{pet.name}</Text>
        <View style={{ width: 24 }} /> 
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          <Image
            source={pet.image ? { uri: pet.image } : require('../assets/pet1.png')}
            style={styles.petImage}
          />
          <View style={styles.actionButtons}>
            {(canSponsor || isSponsoring) && ( // Mostrar "Apadrinhar" ou "Visita"
              <TouchableOpacity 
                style={[styles.actionButton, isSponsoring && styles.visitButton]}
                onPress={handleSponsorshipAction}
              >
                <MaterialIcons name={isSponsoring ? "event" : "volunteer-activism"} size={20} color={isSponsoring ? "#FFFFFF" : "#7A5038"} style={{marginRight: 8}} />
                <Text style={[styles.actionButtonText, isSponsoring && styles.visitButtonText]}>
                  {isSponsoring ? 'Agendar Visita' : 'Apadrinhar'}
                </Text>
              </TouchableOpacity>
            )}
            {canAdopt && ( // Mostrar "Adotar"
              <TouchableOpacity 
                style={[styles.actionButton, styles.adoptButton]}
                onPress={handleAdoption}
              >
                <MaterialIcons name="pets" size={20} color="#FFFFFF" style={{marginRight: 8}}/>
                <Text style={[styles.actionButtonText, styles.adoptButtonText]}>
                  Adotar {pet.name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={styles.statusText}>{statusConfig.text}</Text>
          </View>

          <Text style={styles.nameLabel}>{pet.name}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
                <MaterialIcons name="cake" size={20} color="#7A5038" />
                <Text style={styles.infoTextItem}>{pet.age}</Text>
            </View>
            <View style={styles.infoBlock}>
                <MaterialIcons name={pet.gender === 'M' ? "male" : "female"} size={20} color="#7A5038" />
                <Text style={styles.infoTextItem}>{convertGender(pet.gender)}</Text>
            </View>
            <View style={styles.infoBlock}>
                <MaterialIcons name="straighten" size={20} color="#7A5038" />
                <Text style={styles.infoTextItem}>{convertSize(pet.size)}</Text>
            </View>
          </View>
          

          {/* --- CARD DE DOAÇÃO PIX --- */}
          {!loadingPixKey && pixKey ? (
            <View style={styles.donationCard}>
              <View style={styles.donationHeader}>
                <MaterialIcons name="favorite" size={24} color="#E91E63" />
                <Text style={styles.donationTitle}>Ajude o Abraço Pet!</Text>
              </View>
              <Text style={styles.donationText}>
                Sua doação nos ajuda a continuar cuidando de pets como o(a) {pet.name} e muitos outros.
                Qualquer valor faz a diferença!
              </Text>
              <Text style={styles.pixLabel}>Nossa chave PIX:</Text>
              <TouchableOpacity onPress={copyToClipboard} style={styles.pixKeyContainer}>
                <Text style={styles.pixKeyText} numberOfLines={1} ellipsizeMode="middle">{pixKey}</Text>
                <MaterialIcons name="content-copy" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}
          {/* --- FIM CARD DE DOAÇÃO PIX --- */}


          <View style={styles.menuButtons}>
            <TouchableOpacity style={styles.menuButton} onPress={() => setShowHealthInfo(true)}>
              <MaterialIcons name="healing" size={20} color="#FFFFFF" style={{marginRight: 10}}/>
              <Text style={styles.menuButtonText}>Informações de Saúde</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuButton} onPress={() => setShowBehaviorInfo(true)}>
              <MaterialIcons name="psychology" size={20} color="#FFFFFF" style={{marginRight: 10}}/>
              <Text style={styles.menuButtonText}>Comportamento</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuButton} onPress={() => setShowHistory(true)}>
              <MaterialIcons name="history" size={20} color="#FFFFFF" style={{marginRight: 10}}/>
              <Text style={styles.menuButtonText}>Histórico do Pet</Text>
            </TouchableOpacity>

            {showCancelOrUnsponsorButton && (
              <TouchableOpacity 
                style={[styles.menuButton, styles.unsponsorButton]}
                onPress={handleUnsponsor}
              >
                <MaterialIcons name="cancel" size={20} color="#FFFFFF" style={{marginRight: 10}}/>
                <Text style={styles.menuButtonText}>{cancelOrUnsponsorText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <InfoDialog
        visible={showHealthInfo}
        onClose={() => setShowHealthInfo(false)}
        title="Informações de Saúde"
        content={pet.health || "Não há informações de saúde disponíveis."}
      />

      <InfoDialog
        visible={showBehaviorInfo}
        onClose={() => setShowBehaviorInfo(false)}
        title="Comportamento"
        content={pet.behavior || "Não há informações sobre o comportamento disponíveis."}
      />

      <HistoryDialog
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        history={pet.historic}
      />
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9', // Um fundo levemente acinzentado
  },
  scrollContent: {
    paddingBottom: 30, // Espaço no final do scroll
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 25 : (Platform.OS === 'ios' ? 10 : 48),
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF', // Fundo branco para a toolbar
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2, // Sombra leve no Android
    shadowColor: '#000', // Sombra no iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    position: 'relative', // Para o posicionamento absoluto dos botões
    width: width,
    height: width * 0.75, // Altura da imagem um pouco menor
  },
  petImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover', // Garante que a imagem cubra a área
  },
  actionButtons: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly', // Espaçar igualmente
    paddingHorizontal: 20, 
    alignItems: 'center', // Para alinhar botões de alturas diferentes
  },
  actionButton: {
    flexDirection: 'row', // Ícone e texto lado a lado
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30, // Botões bem arredondados
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 4, // Sombra mais pronunciada
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 150, // Largura mínima
  },
  actionButtonText: {
    color: '#7A5038', // Cor do texto padrão
    fontSize: 15,
    fontWeight: '600',
  },
  visitButton: { // Estilo específico para o botão de visita
    backgroundColor: '#7A5038',
  },
  visitButtonText: {
    color: '#FFFFFF',
  },
  adoptButton: { // Estilo específico para o botão de adotar
    backgroundColor: '#4CAF50', // Verde para adoção
  },
  adoptButtonText: {
    color: '#FFFFFF',
  },
  detailsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30, // Cantos arredondados para sobrepor a imagem
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 45, // Espaço para os botões que sobem da imagem
    paddingBottom: 20,
    marginTop: -30, // Puxar para cima para sobrepor a imagem
    elevation: 3, // Sombra para destacar
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#F0F0F0', // Fundo suave para o status
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20, // Cantos arredondados
    alignSelf: 'flex-start', // Para não ocupar a largura toda
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  nameLabel: {
    fontSize: 26, // Nome maior
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10, // Mais espaço abaixo do nome
    textAlign: 'center', // Centralizar nome
  },
  infoRow: { // Para exibir idade, sexo e porte lado a lado
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 25,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
  },
  infoBlock: {
    alignItems: 'center',
  },
  infoTextItem: { // Texto para cada item da infoRow
    fontSize: 15,
    color: '#555555',
    marginTop: 4,
  },
  menuButtons: {
    marginTop: 20, // Espaço antes dos botões de menu
    gap: 12,
  },
  menuButton: {
    flexDirection: 'row', // Ícone e texto lado a lado
    alignItems: 'center',
    justifyContent: 'center', // Centralizar conteúdo do botão
    backgroundColor: '#7A5038',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    elevation: 2,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  // --- ESTILOS PARA O CARD DE DOAÇÃO ---
  donationCard: {
    backgroundColor: '#FFF9C4', // Um amarelo claro para doação
    borderRadius: 12,
    padding: 20,
    marginVertical: 25, // Espaçamento
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#FFC107', // Borda amarela
  },
  donationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  donationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#795548', // Marrom para o título
    marginLeft: 10,
  },
  donationText: {
    fontSize: 15,
    color: '#5D4037', // Marrom mais claro para o texto
    lineHeight: 22,
    marginBottom: 15,
    textAlign: 'center',
  },
  pixLabel: {
    fontSize: 14,
    color: '#795548',
    marginBottom: 5,
    fontWeight: '500',
  },
  pixKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#7A5038', // Fundo escuro para a chave
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  pixKeyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1, // Para o ellipsizeMode funcionar
    marginRight: 10,
  },
  // --- FIM DOS ESTILOS DE DOAÇÃO ---

  // Estilos dos Modais (InfoDialog, HistoryDialog)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', // Mais escuro
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15, // Cantos mais arredondados
    padding: 20,
    width: '90%', // Um pouco mais largo
    maxWidth: 450, // Largura máxima
    maxHeight: '85%', // Altura máxima
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dialogTitle: {
    fontSize: 20, // Título maior
    fontWeight: 'bold',
    color: '#7A5038',
  },
  dialogContent: {
    fontSize: 16,
    lineHeight: 24, // Melhor espaçamento entre linhas
    color: '#444444', // Texto um pouco mais escuro
    paddingBottom: 10, // Espaço no final do conteúdo
  },
  historyList: {
    maxHeight: 350, // Aumentar um pouco a altura da lista de histórico
  },
  historyEntry: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5', // Linha divisória mais suave
  },
  historyEntryLast: { // Para remover a borda do último item
    borderBottomWidth: 0,
  },
  historyDate: {
    fontSize: 13,
    color: '#888888', // Data um pouco mais clara
    marginBottom: 3,
  },
  historyStatus: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 15,
    color: '#D32F2F',
    textAlign: 'center',
    paddingVertical: 25,
  },
  unsponsorButton: {
    backgroundColor: '#E57373', // Um vermelho mais suave para desapadrinhar/cancelar
  },
});

export default PetDetailScreen;