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
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, update, remove } from 'firebase/database';

export const ManageWalkScreen = ({ navigation }) => {
  const [todayWalks, setTodayWalks] = useState([]);
  const [pendingWalks, setPendingWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalk, setSelectedWalk] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [dialogType, setDialogType] = useState('');
  
  useEffect(() => {
    fetchWalks();
  }, []);
  
  const fetchWalks = async () => {
    setLoading(true);
    try {
      const currentUser = FIREBASE_AUTH.currentUser;
      if (!currentUser) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        navigation.goBack();
        return;
      }
      
      const walksRef = ref(FIREBASE_DB, 'walks');
      const walksSnapshot = await get(walksRef);
      const walksData = walksSnapshot.val();
      
      if (!walksData) {
        setTodayWalks([]);
        setPendingWalks([]);
        setLoading(false);
        return;
      }
      
      const allWalks = Object.entries(walksData).map(([id, walk]) => ({ id, ...walk }));
      
      // Get today's date in DD/MM/YYYY format
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const todayFormatted = `${day}/${month}/${year}`;
      
      // Filter today's walks
      const todayWalksArray = allWalks
        .filter(walk => {
          const walkDate = walk.timestamp.split(' ')[0];
          return walkDate === todayFormatted;
        })
        .sort((a, b) => {
          const timeA = a.timestamp.split(' ')[1];
          const timeB = b.timestamp.split(' ')[1];
          return timeA.localeCompare(timeB);
        });
      
      // Filter pending walks (status 0 or 3)
      const pendingWalksArray = allWalks
        .filter(walk => walk.status === 0 || walk.status === 3)
        .sort((a, b) => {
          // First sort by status (3 has priority over 0)
          if (a.status !== b.status) {
            return b.status - a.status;
          }
          
          // Then sort by date/time
          const [dateA, timeA] = a.timestamp.split(' ');
          const [dayA, monthA, yearA] = dateA.split('/');
          const [hoursA, minutesA] = timeA.split(':');
          
          const [dateB, timeB] = b.timestamp.split(' ');
          const [dayB, monthB, yearB] = dateB.split('/');
          const [hoursB, minutesB] = timeB.split(':');
          
          const dateObjA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);
          const dateObjB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);
          
          return dateObjA - dateObjB; // Ascending order (oldest first)
        });
      
      setTodayWalks(todayWalksArray);
      setPendingWalks(pendingWalksArray);
    } catch (error) {
      console.error('Error fetching walks:', error);
      Alert.alert('Erro', 'Não foi possível buscar os passeios.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCompleteWalk = async () => {
    if (!selectedWalk) return;
    
    try {
      const walkRef = ref(FIREBASE_DB, `walks/${selectedWalk.id}`);
      
      await update(walkRef, {
        status: 4 // Completed
      });
      
      // Update local state
      setTodayWalks(prevWalks => 
        prevWalks.map(walk => 
          walk.id === selectedWalk.id ? { ...walk, status: 4 } : walk
        )
      );
      
      Alert.alert('Sucesso', 'Passeio marcado como concluído!');
    } catch (error) {
      console.error('Error completing walk:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o passeio.');
    } finally {
      closeDialog();
    }
  };
  
  const handleActionWalk = async (action) => {
    if (!selectedWalk) return;
    
    try {
      const walkRef = ref(FIREBASE_DB, `walks/${selectedWalk.id}`);
      
      if (action === 'confirm') {
        await update(walkRef, { status: 1 }); // Confirmed
        Alert.alert('Sucesso', 'Passeio confirmado!');
      } else if (action === 'deny') {
        await update(walkRef, { status: 2 }); // Denied
        Alert.alert('Sucesso', 'Passeio negado!');
      } else if (action === 'delete') {
        await remove(walkRef);
        Alert.alert('Sucesso', 'Passeio removido!');
      }
      
      // Update local state
      const newStatus = action === 'confirm' ? 1 : action === 'deny' ? 2 : -1;
      
      if (action === 'delete') {
        // Remove from both arrays
        setTodayWalks(prevWalks => prevWalks.filter(walk => walk.id !== selectedWalk.id));
        setPendingWalks(prevWalks => prevWalks.filter(walk => walk.id !== selectedWalk.id));
      } else {
        // Update the status
        setTodayWalks(prevWalks => 
          prevWalks.map(walk => 
            walk.id === selectedWalk.id ? { ...walk, status: newStatus } : walk
          )
        );
        
        // Remove from pending walks
        setPendingWalks(prevWalks => prevWalks.filter(walk => walk.id !== selectedWalk.id));
      }
    } catch (error) {
      console.error('Error updating walk:', error);
      Alert.alert('Erro', 'Não foi possível processar a ação.');
    } finally {
      closeDialog();
    }
  };
  
  const openDialog = (walk, type) => {
    setSelectedWalk(walk);
    setDialogType(type);
    setShowActionDialog(true);
  };
  
  const closeDialog = () => {
    setShowActionDialog(false);
    setSelectedWalk(null);
    setDialogType('');
  };
  
  const getStatusInfo = (status) => {
    switch (status) {
      case 0:
        return { text: 'Aguardando', color: '#666666', icon: 'schedule' };
      case 1:
        return { text: 'Confirmado', color: '#00FF00', icon: 'check-circle' };
      case 2:
        return { text: 'Negado', color: '#FF0000', icon: 'cancel' };
      case 3:
        return { text: 'Cancelado', color: '#FF5722', icon: 'block' };
      case 4:
        return { text: 'Concluído', color: '#4169E1', icon: 'done-all' };
      default:
        return { text: 'Desconhecido', color: '#666666', icon: 'help' };
    }
  };
  
  const renderDialogContent = () => {
    if (!selectedWalk) return null;
    
    if (dialogType === 'complete') {
      return (
        <>
          <Text style={styles.dialogText}>
            Deseja marcar este passeio como concluído?
          </Text>
          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={[styles.dialogButton, styles.cancelButton]}
              onPress={closeDialog}
            >
              <Text style={styles.cancelButtonText}>Não</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dialogButton, styles.confirmButton]}
              onPress={handleCompleteWalk}
            >
              <Text style={styles.confirmButtonText}>Sim, Concluir</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    } else if (dialogType === 'request') {
      return (
        <>
          <Text style={styles.dialogText}>
            Como deseja processar esta solicitação de passeio?
          </Text>
          <View style={styles.dialogButtonsColumn}>
            <TouchableOpacity
              style={[styles.dialogButtonFull, styles.confirmButton]}
              onPress={() => handleActionWalk('confirm')}
            >
              <Text style={styles.confirmButtonText}>Confirmar Passeio</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dialogButtonFull, styles.denyButton]}
              onPress={() => handleActionWalk('deny')}
            >
              <Text style={styles.confirmButtonText}>Negar Passeio</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dialogButtonFull, styles.cancelButton]}
              onPress={closeDialog}
            >
              <Text style={styles.cancelButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    } else if (dialogType === 'cancel') {
      return (
        <>
          <Text style={styles.dialogText}>
            Este passeio foi cancelado pelo cliente. Deseja remover da lista?
          </Text>
          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={[styles.dialogButton, styles.cancelButton]}
              onPress={closeDialog}
            >
              <Text style={styles.cancelButtonText}>Não</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dialogButton, styles.confirmButton]}
              onPress={() => handleActionWalk('delete')}
            >
              <Text style={styles.confirmButtonText}>Sim, Remover</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }
    
    return null;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Gestor de Passeios</Text>
        <TouchableOpacity onPress={fetchWalks}>
          <MaterialIcons name="refresh" size={24} color="#7A5038" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7A5038" />
          <Text style={styles.loadingText}>Carregando passeios...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Passeios de Hoje</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.todayScrollView}>
            {todayWalks.length === 0 ? (
              <View style={styles.emptyTodayContainer}>
                <MaterialIcons name="event-busy" size={36} color="#CCCCCC" />
                <Text style={styles.emptyText}>Não existem passeios agendados para hoje.</Text>
              </View>
            ) : (
              todayWalks.map((walk) => {
                const statusInfo = getStatusInfo(walk.status);
                const time = walk.timestamp.split(' ')[1];
                
                return (
                  <TouchableOpacity
                    key={walk.id}
                    style={styles.todayWalkCard}
                    onPress={() => openDialog(walk, 'complete')}
                    disabled={walk.status === 4} // Disable for completed walks
                  >
                    <View style={styles.walkCardHeader}>
                      <MaterialIcons name={statusInfo.icon} size={24} color={statusInfo.color} />
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.text}
                      </Text>
                    </View>
                    <Text style={styles.walkTime}>{time}</Text>
                    <Text style={styles.walkLength}>{walk.walkLenght} min</Text>
                    
                    {walk.status !== 4 && (
                      <Text style={styles.tapToComplete}>Toque para concluir</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          
          <Text style={styles.sectionTitle}>Solicitações</Text>
          
          {pendingWalks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="done-all" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>Não há solicitações pendentes.</Text>
            </View>
          ) : (
            pendingWalks.map((walk) => {
              const statusInfo = getStatusInfo(walk.status);
              const [date, time] = walk.timestamp.split(' ');
              
              return (
                <TouchableOpacity
                  key={walk.id}
                  style={styles.pendingWalkCard}
                  onPress={() => openDialog(walk, walk.status === 0 ? 'request' : 'cancel')}
                >
                  <View style={styles.walkCardHeader}>
                    <MaterialIcons name={statusInfo.icon} size={24} color={statusInfo.color} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.text}
                    </Text>
                  </View>
                  <View style={styles.walkCardContent}>
                    <Text style={styles.walkDate}>{date} às {time}</Text>
                    <Text style={styles.walkLength}>{walk.walkLenght} minutos</Text>
                  </View>
                  
                  <Text style={styles.tapToAction}>
                    {walk.status === 0 
                      ? 'Toque para aprovar/negar' 
                      : 'Toque para remover cancelamento'}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
      
      {/* Action Dialog */}
      <Modal
        transparent
        visible={showActionDialog}
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>
                {dialogType === 'complete' ? 'Concluir Passeio' : 
                 dialogType === 'request' ? 'Processar Solicitação' :
                 'Passeio Cancelado'}
              </Text>
              <TouchableOpacity onPress={closeDialog}>
                <MaterialIcons name="close" size={24} color="#7A5038" />
              </TouchableOpacity>
            </View>
            
            {renderDialogContent()}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    elevation: 2,
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#7A5038',
  },
  todayScrollView: {
    marginBottom: 24,
    minHeight: 180,
  },
  emptyTodayContainer: {
    width: 200,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  emptyContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    height: 150,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  todayWalkCard: {
    width: 160,
    height: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginRight: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    justifyContent: 'space-between',
  },
  walkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  walkTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
    marginVertical: 8,
  },
  walkLength: {
    fontSize: 14,
    color: '#666666',
  },
  tapToComplete: {
    fontSize: 12,
    color: '#4169E1',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pendingWalkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  walkCardContent: {
    marginVertical: 8,
  },
  walkDate: {
    fontSize: 16,
    color: '#7A5038',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tapToAction: {
    fontSize: 12,
    color: '#4169E1',
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 8,
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
    borderRadius: 8,
    width: '90%',
    maxWidth: 400,
    padding: 0,
    elevation: 5,
    overflow: 'hidden',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  dialogText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    padding: 24,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  dialogButtonsColumn: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonFull: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  denyButton: {
    backgroundColor: '#F44336',
  },
  cancelButton: {
    backgroundColor: '#EEEEEE',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#666666',
    fontWeight: 'bold',
  },
});