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
import { ref, get, update } from 'firebase/database';

export const WalkListScreen = ({ navigation }) => {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalk, setSelectedWalk] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  useEffect(() => {
    fetchUserWalks();
  }, []);
  
  const fetchUserWalks = async () => {
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
        setWalks([]);
        setLoading(false);
        return;
      }
      
      // Filter walks by userId and sort by timestamp (most recent first)
      const userWalks = Object.entries(walksData)
        .map(([id, walk]) => ({ id, ...walk }))
        .filter(walk => walk.userId === currentUser.uid)
        .sort((a, b) => {
          // Convert DD/MM/YYYY HH:MM to date objects for comparison
          const [dateA, timeA] = a.timestamp.split(' ');
          const [dayA, monthA, yearA] = dateA.split('/');
          const [hoursA, minutesA] = timeA.split(':');
          
          const [dateB, timeB] = b.timestamp.split(' ');
          const [dayB, monthB, yearB] = dateB.split('/');
          const [hoursB, minutesB] = timeB.split(':');
          
          const dateObjA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);
          const dateObjB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);
          
          return dateObjB - dateObjA; // Descending order (most recent first)
        });
      
      setWalks(userWalks);
    } catch (error) {
      console.error('Error fetching user walks:', error);
      Alert.alert('Erro', 'Não foi possível buscar os passeios.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelWalk = async () => {
    if (!selectedWalk) return;
    
    try {
      const walkRef = ref(FIREBASE_DB, `walks/${selectedWalk.id}`);
      
      await update(walkRef, {
        status: 3 // Canceled
      });
      
      // Update local state
      setWalks(prevWalks => 
        prevWalks.map(walk => 
          walk.id === selectedWalk.id ? { ...walk, status: 3 } : walk
        )
      );
      
      Alert.alert('Sucesso', 'Solicitação de cancelamento enviada com sucesso!');
    } catch (error) {
      console.error('Error canceling walk:', error);
      Alert.alert('Erro', 'Não foi possível solicitar o cancelamento do passeio.');
    } finally {
      setShowCancelDialog(false);
      setSelectedWalk(null);
    }
  };
  
  const openCancelDialog = (walk) => {
    if (walk.status !== 0 && walk.status !== 1) {
      Alert.alert('Aviso', 'Apenas passeios com status "Aguardando" ou "Confirmado" podem ser cancelados.');
      return;
    }
    
    setSelectedWalk(walk);
    setShowCancelDialog(true);
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
  
  const formatDateStr = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    
    const [date, time] = dateTimeStr.split(' ');
    return `${date} às ${time}`;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Meus Passeios</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7A5038" />
          <Text style={styles.loadingText}>Carregando passeios...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {walks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="pets" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>Você ainda não agendou nenhum passeio.</Text>
            </View>
          ) : (
            walks.map((walk) => {
              const statusInfo = getStatusInfo(walk.status);
              
              return (
                <TouchableOpacity
                  key={walk.id}
                  style={styles.walkCard}
                  onPress={() => openCancelDialog(walk)}
                >
                  <View style={styles.walkCardHeader}>
                    <MaterialIcons name={statusInfo.icon} size={24} color={statusInfo.color} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.text}
                    </Text>
                  </View>
                  <View style={styles.walkCardContent}>
                    <Text style={styles.walkDate}>{formatDateStr(walk.timestamp)}</Text>
                    <Text style={styles.walkLength}>{walk.walkLenght} minutos</Text>
                  </View>
                  
                  {(walk.status === 0 || walk.status === 1) && (
                    <Text style={styles.cancelText}>
                      Toque para solicitar cancelamento
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
      
      {/* Cancel Confirmation Dialog */}
      <Modal
        transparent
        visible={showCancelDialog}
        animationType="fade"
        onRequestClose={() => setShowCancelDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Cancelar Passeio</Text>
              <TouchableOpacity onPress={() => setShowCancelDialog(false)}>
                <MaterialIcons name="close" size={24} color="#7A5038" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.dialogText}>
              Você tem certeza que deseja solicitar o cancelamento deste passeio?
            </Text>
            
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.cancelButton]}
                onPress={() => setShowCancelDialog(false)}
              >
                <Text style={styles.cancelButtonText}>Não</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dialogButton, styles.confirmButton]}
                onPress={handleCancelWalk}
              >
                <Text style={styles.confirmButtonText}>Sim, Cancelar</Text>
              </TouchableOpacity>
            </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  walkCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#7A5038',
  },
  walkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  walkCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  walkDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  walkLength: {
    fontSize: 16,
    color: '#666666',
  },
  cancelText: {
    fontSize: 14,
    color: '#FF5722',
    alignSelf: 'flex-end',
    marginTop: 8,
    fontStyle: 'italic',
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
    maxWidth: 400,
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
  dialogText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    marginBottom: 24,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dialogButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#FF5722',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});