import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Platform, // Adicionado
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, update, remove, onValue, off } from 'firebase/database'; // Adicionado onValue e off

export const ManageWalkScreen = ({ navigation }) => {
  const [todayWalks, setTodayWalks] = useState([]);
  const [pendingWalks, setPendingWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalk, setSelectedWalk] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [dialogType, setDialogType] = useState('');
  
  useEffect(() => {
    setLoading(true);
    const currentUser = FIREBASE_AUTH.currentUser;
    if (!currentUser) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      setLoading(false);
      navigation.goBack();
      return;
    }

    const walksRef = ref(FIREBASE_DB, 'walks');
    // Usar onValue para escutar mudanças em tempo real
    const listener = onValue(walksRef, (snapshot) => {
      processWalksData(snapshot.val());
    }, (error) => {
      console.error('Error fetching walks with listener:', error);
      Alert.alert('Erro', 'Não foi possível buscar os passeios em tempo real.');
      setLoading(false);
    });

    // Limpar o listener ao desmontar
    return () => off(walksRef, 'value', listener);
  }, [navigation]); // Adicionado navigation como dependência
  
  const processWalksData = (walksData) => {
    setLoading(true); // Indica que estamos reprocessando
    if (!walksData) {
      setTodayWalks([]);
      setPendingWalks([]);
      setLoading(false);
      return;
    }
    
    const allWalks = Object.entries(walksData).map(([id, walk]) => ({ id, ...walk }));
    
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const todayFormatted = `${day}/${month}/${year}`;
    
    const todayWalksArray = allWalks
      .filter(walk => walk.timestamp.split(' ')[0] === todayFormatted)
      .sort((a, b) => a.timestamp.split(' ')[1].localeCompare(b.timestamp.split(' ')[1]));
    
    const pendingWalksArray = allWalks
      .filter(walk => walk.status === 0 || walk.status === 3) // 0: Solicitado, 3: Cancelado pelo usuário
      .sort((a, b) => {
        if (a.status !== b.status) return b.status - a.status; // Cancelados (3) primeiro
        const dateObjA = new Date(a.timestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'));
        const dateObjB = new Date(b.timestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'));
        return dateObjA - dateObjB;
      });
    
    setTodayWalks(todayWalksArray);
    setPendingWalks(pendingWalksArray);
    setLoading(false);
  };
  
  const handleCompleteWalk = async () => { /* ... (sua função existente) ... */ 
    if (!selectedWalk) return;
    try {
      await update(ref(FIREBASE_DB, `walks/${selectedWalk.id}`), { status: 4 });
      Alert.alert('Sucesso', 'Passeio marcado como concluído!');
      // A atualização via listener já deve recarregar os dados, mas pode forçar se necessário
      // processWalksData(await get(ref(FIREBASE_DB, 'walks')).then(s => s.val())); 
    } catch (error) { console.error('Error completing walk:', error); Alert.alert('Erro', 'Não foi possível atualizar.'); }
    finally { closeDialog(); }
  };
  
  const handleActionWalk = async (action) => { /* ... (sua função existente) ... */ 
    if (!selectedWalk) return;
    try {
      const walkRefDb = ref(FIREBASE_DB, `walks/${selectedWalk.id}`); // Renomeado para evitar conflito com 'ref' do React
      let successMessage = '';
      if (action === 'confirm') { await update(walkRefDb, { status: 1 }); successMessage = 'Agendamento confirmado!';}
      else if (action === 'deny') { await update(walkRefDb, { status: 2 }); successMessage = 'Agendamento negado!'; }
      else if (action === 'delete') { await remove(walkRefDb); successMessage = 'Agendamento removido!'; }
      if (successMessage) Alert.alert('Sucesso', successMessage);
       // A atualização via listener já deve recarregar os dados
    } catch (error) { console.error('Error updating walk:', error); Alert.alert('Erro', 'Não foi possível processar.');}
    finally { closeDialog(); }
  };
  
  const openDialog = (walk, type) => { setSelectedWalk(walk); setDialogType(type); setShowActionDialog(true); };
  const closeDialog = () => { setShowActionDialog(false); setSelectedWalk(null); setDialogType(''); };
  
  const getStatusInfo = (status) => {
    switch (status) {
      case 0: return { text: 'Aguardando Aprovação', color: '#FFA500', icon: 'hourglass-empty' }; // Laranja
      case 1: return { text: 'Confirmado', color: '#4CAF50', icon: 'check-circle' }; // Verde
      case 2: return { text: 'Negado', color: '#F44336', icon: 'cancel' }; // Vermelho
      case 3: return { text: 'Cancelado pelo Usuário', color: '#9E9E9E', icon: 'remove-circle-outline' }; // Cinza
      case 4: return { text: 'Concluído', color: '#2196F3', icon: 'done-all' }; // Azul
      default: return { text: 'Desconhecido', color: '#607D8B', icon: 'help-outline' };
    }
  };

  // Função para obter o texto do tipo de visita
  const getVisitTypeText = (type) => {
    if (type === 'adocao') return 'Visita para Adoção';
    if (type === 'passeio') return 'Passeio (Padrinho)';
    return 'Passeio'; // Padrão caso o tipo não esteja definido
  };
  
  const renderDialogContent = () => { /* ... (sua função existente) ... */ 
    if (!selectedWalk) return null;
    const visitTypeText = getVisitTypeText(selectedWalk.type);

    if (dialogType === 'complete') {
      return (
        <>
          <Text style={styles.dialogText}>Marcar "{visitTypeText}" como concluído?</Text>
          <View style={styles.dialogButtons}><TouchableOpacity style={[styles.dialogButton, styles.cancelButton]} onPress={closeDialog}><Text style={styles.cancelButtonText}>Não</Text></TouchableOpacity><TouchableOpacity style={[styles.dialogButton, styles.confirmButton]} onPress={handleCompleteWalk}><Text style={styles.confirmButtonText}>Sim, Concluir</Text></TouchableOpacity></View>
        </>
      );
    } else if (dialogType === 'request') { // Status 0
      return (
        <>
          <Text style={styles.dialogText}>Analisar solicitação de "{visitTypeText}":</Text>
          <View style={styles.dialogButtonsColumn}><TouchableOpacity style={[styles.dialogButtonFull, styles.confirmButton]} onPress={() => handleActionWalk('confirm')}><Text style={styles.confirmButtonText}>Confirmar Agendamento</Text></TouchableOpacity><TouchableOpacity style={[styles.dialogButtonFull, styles.denyButton]} onPress={() => handleActionWalk('deny')}><Text style={styles.confirmButtonText}>Negar Agendamento</Text></TouchableOpacity><TouchableOpacity style={[styles.dialogButtonFull, styles.cancelButton]} onPress={closeDialog}><Text style={styles.cancelButtonText}>Voltar</Text></TouchableOpacity></View>
        </>
      );
    } else if (dialogType === 'cancel') { // Status 3
      return (
        <>
          <Text style={styles.dialogText}>Este agendamento ("{visitTypeText}") foi cancelado pelo usuário. Deseja remover da lista?</Text>
          <View style={styles.dialogButtons}><TouchableOpacity style={[styles.dialogButton, styles.cancelButton]} onPress={closeDialog}><Text style={styles.cancelButtonText}>Manter</Text></TouchableOpacity><TouchableOpacity style={[styles.dialogButton, styles.deleteButton]} onPress={() => handleActionWalk('delete')}><Text style={styles.confirmButtonText}>Sim, Remover</Text></TouchableOpacity></View>
        </>
      );
    }
    return null;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={24} color="#7A5038" /></TouchableOpacity>
        <Text style={styles.toolbarTitle}>Gestão de Agendamentos</Text>
        <TouchableOpacity onPress={() => processWalksData(null)}> 
          {/* Força re-busca manual */}
          <MaterialIcons name="refresh" size={28} color="#7A5038" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#7A5038" /><Text style={styles.loadingText}>Carregando agendamentos...</Text></View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Agendamentos de Hoje</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.todayScrollView}>
            {todayWalks.length === 0 ? (
              <View style={styles.emptyTodayContainer}><MaterialIcons name="event-busy" size={36} color="#CCCCCC" /><Text style={styles.emptyText}>Nenhum agendamento para hoje.</Text></View>
            ) : (
              todayWalks.map((walk) => {
                const statusInfo = getStatusInfo(walk.status);
                const time = walk.timestamp.split(' ')[1];
                const visitTypeText = getVisitTypeText(walk.type); // <<< OBTER TEXTO DO TIPO
                
                return (
                  <TouchableOpacity key={walk.id} style={styles.todayWalkCard} onPress={() => openDialog(walk, 'complete')} disabled={walk.status === 4 || walk.status === 2 || walk.status === 3}>
                    <View style={styles.walkCardHeader}><MaterialIcons name={statusInfo.icon} size={22} color={statusInfo.color} /><Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text></View>
                    <Text style={styles.walkPetName}>{walk.petName || 'Pet'}</Text>
                    <Text style={styles.walkTime}>{time}</Text>
                    {/* EXIBIR TIPO DE VISITA/PASSEIO */}
                    <Text style={styles.visitTypeTextCard}>{visitTypeText}</Text>
                    <Text style={styles.walkLength}>{walk.walkLenght} min</Text>
                    {(walk.status !== 4 && walk.status !== 2 && walk.status !== 3) && (<Text style={styles.tapToComplete}>Toque para concluir</Text>)}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          
          <Text style={styles.sectionTitle}>Solicitações Pendentes</Text>
          {pendingWalks.length === 0 ? (
            <View style={styles.emptyContainer}><MaterialIcons name="playlist-add-check" size={48} color="#CCCCCC" /><Text style={styles.emptyText}>Não há solicitações pendentes.</Text></View>
          ) : (
            pendingWalks.map((walk) => {
              const statusInfo = getStatusInfo(walk.status);
              const [date, time] = walk.timestamp.split(' ');
              const visitTypeText = getVisitTypeText(walk.type); // <<< OBTER TEXTO DO TIPO
              
              return (
                <TouchableOpacity key={walk.id} style={[styles.pendingWalkCard, {borderLeftColor: statusInfo.color}]} onPress={() => openDialog(walk, walk.status === 0 ? 'request' : 'cancel')}>
                  <View style={styles.walkCardHeader}><MaterialIcons name={statusInfo.icon} size={22} color={statusInfo.color} /><Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text></View>
                  <Text style={styles.walkPetNameLarge}>{walk.petName || 'Pet Desconhecido'}</Text>
                  <View style={styles.walkCardContent}>
                    <Text style={styles.walkDate}>{date} às {time}</Text>
                    <Text style={styles.walkLength}>{walk.walkLenght} minutos</Text>
                  </View>
                  {/* EXIBIR TIPO DE VISITA/PASSEIO */}
                  <Text style={styles.visitTypeTextCardLarge}>{visitTypeText}</Text>
                  <Text style={styles.tapToAction}>{walk.status === 0 ? 'Toque para analisar' : 'Toque para remover da lista'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
      
      <Modal transparent visible={showActionDialog} animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}><Text style={styles.dialogTitle}>{dialogType === 'complete' ? 'Concluir Agendamento' : dialogType === 'request' ? 'Analisar Solicitação' : 'Agendamento Cancelado'}</Text><TouchableOpacity onPress={closeDialog}><MaterialIcons name="close" size={26} color="#555" /></TouchableOpacity></View>
            {renderDialogContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9', }, // Fundo mais suave
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'android' ? 25 : 48, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#FFFFFF', elevation: 2, },
  toolbarTitle: { fontSize: 20, fontWeight: 'bold', color: '#7A5038', },
  content: { flex: 1, padding: 16, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666666', },
  sectionTitle: { fontSize: 19, fontWeight: 'bold', marginBottom: 16, color: '#7A5038', marginTop: 10 }, // Título da seção um pouco maior
  todayScrollView: { marginBottom: 24, minHeight: 190, }, // Aumentado minHeight
  emptyTodayContainer: { width: 220, height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 10, padding: 16, marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0', },
  emptyContainer: { padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#E0E0E0', minHeight: 160, }, // Aumentado minHeight
  emptyText: { marginTop: 10, fontSize: 15, color: '#757575', textAlign: 'center', },
  todayWalkCard: { width: 170, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 15, marginRight: 12, elevation: 3, borderWidth: 1, borderColor: '#EAEAEA', justifyContent: 'space-between', minHeight: 170 }, // Ajustado minHeight
  walkCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, },
  statusText: { fontSize: 14, fontWeight: '600', marginLeft: 6, }, // Aumentado fontWeight
  walkPetName: { fontSize: 15, fontWeight: 'bold', color: '#333', marginVertical: 4, },
  walkPetNameLarge: { fontSize: 17, fontWeight: 'bold', color: '#333', marginVertical: 6, },
  walkTime: { fontSize: 18, fontWeight: 'bold', color: '#7A5038', marginVertical: 6, },
  walkLength: { fontSize: 14, color: '#555', },
  visitTypeTextCard: { fontSize: 12, fontWeight: '500', color: '#0D47A1', backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginVertical: 4,}, // Novo estilo para tipo no card horizontal
  visitTypeTextCardLarge: { fontSize: 13, fontWeight: '500', color: '#0D47A1', backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, alignSelf: 'flex-start', marginVertical: 6,}, // Novo estilo para tipo no card vertical
  tapToComplete: { fontSize: 12, color: '#1E88E5', marginTop: 10, textAlign: 'center', fontStyle: 'italic', },
  pendingWalkCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 16, marginBottom: 16, elevation: 3, borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2, },
  walkCardContent: { marginVertical: 6, },
  walkDate: { fontSize: 16, color: '#333', fontWeight: '500', marginBottom: 4, },
  tapToAction: { fontSize: 13, color: '#1E88E5', textAlign: 'right', fontStyle: 'italic', marginTop: 10, },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16, }, // Fundo mais escuro
  dialogContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '90%', maxWidth: 400, padding: 0, elevation: 10, overflow: 'hidden', },
  dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F5F5F5', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', },
  dialogTitle: { fontSize: 19, fontWeight: 'bold', color: '#7A5038', flexShrink: 1 }, // flexShrink para evitar que empurre o botão de fechar
  dialogText: { fontSize: 16, color: '#333333', textAlign: 'center', paddingHorizontal: 24, paddingVertical: 30, lineHeight: 22 }, // Mais padding e lineheight
  dialogButtons: { flexDirection: 'row', justifyContent: 'space-evenly', padding: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: '#FAFAFA' }, // Fundo sutil
  dialogButtonsColumn: { padding: 20, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: '#FAFAFA' },
  dialogButton: { flex: 0.48, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 1},
  dialogButtonFull: { paddingVertical: 14, borderRadius: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'center', elevation: 1},
  confirmButton: { backgroundColor: '#4CAF50', },
  denyButton: { backgroundColor: '#F44336', },
  deleteButton: { backgroundColor: '#E57373'}, // Cor para o botão de remover
  cancelButton: { backgroundColor: '#E0E0E0', },
  confirmButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  cancelButtonText: { color: '#424242', fontWeight: 'bold', fontSize: 15 },
});

export default ManageWalkScreen;