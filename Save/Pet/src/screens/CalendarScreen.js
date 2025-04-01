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
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, set, push } from 'firebase/database';

export const CalendarScreen = ({ navigation, route }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [walks, setWalks] = useState([]);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [walkLength, setWalkLength] = useState('30');
  const [loading, setLoading] = useState(false);
  const [petId, setPetId] = useState(null);

  useEffect(() => {
    // Get petId from route params if available
    if (route.params?.petId) {
      setPetId(route.params.petId);
    }
    
    fetchWalks(formatDate(selectedDate));
  }, [route.params]);

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const fetchWalks = async (dateString) => {
    setLoading(true);
    try {
      const walksRef = ref(FIREBASE_DB, 'walks');
      const walksSnapshot = await get(walksRef);
      const walksData = walksSnapshot.val();
      
      if (!walksData) {
        setWalks([]);
        setLoading(false);
        return;
      }
      
      // Filter walks by date and pet if petId is provided
      const filteredWalks = Object.entries(walksData)
        .map(([id, walk]) => ({ id, ...walk }))
        .filter(walk => {
          const walkDate = walk.timestamp.split(' ')[0];
          const matchesPet = petId ? walk.petId === petId : true;
          return walkDate === dateString && matchesPet;
        });
      
      setWalks(filteredWalks);
    } catch (error) {
      console.error('Error fetching walks:', error);
      Alert.alert('Erro', 'Não foi possível buscar os passeios agendados.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      fetchWalks(formatDate(date));
    }
  };

  const handleTimeChange = (event, time) => {
    setShowTimePicker(false);
    if (time) {
      setSelectedTime(time);
    }
  };

  const checkTimeConflict = (newWalkTime, newWalkLength) => {
    const newStartTime = new Date(selectedDate);
    const [hours, minutes] = newWalkTime.split(':').map(Number);
    newStartTime.setHours(hours, minutes, 0, 0);
    
    const newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + parseInt(newWalkLength));
    
    for (const walk of walks) {
      const walkTimestamp = walk.timestamp;
      const [walkDate, walkTime] = walkTimestamp.split(' ');
      
      const walkStartTime = new Date(selectedDate);
      const [walkHours, walkMinutes] = walkTime.split(':').map(Number);
      walkStartTime.setHours(walkHours, walkMinutes, 0, 0);
      
      const walkEndTime = new Date(walkStartTime);
      walkEndTime.setMinutes(walkEndTime.getMinutes() + parseInt(walk.walkLenght));
      
      // Check if there's an overlap
      if (
        (newStartTime >= walkStartTime && newStartTime < walkEndTime) ||
        (newEndTime > walkStartTime && newEndTime <= walkEndTime) ||
        (newStartTime <= walkStartTime && newEndTime >= walkEndTime)
      ) {
        return true; // Conflict found
      }
    }
    
    return false; // No conflict
  };

  const scheduleWalk = async () => {
    if (!petId) {
      Alert.alert('Erro', 'ID do pet não encontrado.');
      return;
    }
    
    const walkTime = formatTime(selectedTime);
    const dateString = formatDate(selectedDate);
    const timeString = `${dateString} ${walkTime}`;
    
    // Check for time conflicts
    if (checkTimeConflict(walkTime, walkLength)) {
      Alert.alert('Conflito', 'Já existe um passeio agendado neste horário.');
      return;
    }
    
    try {
      const currentUser = FIREBASE_AUTH.currentUser;
      if (!currentUser) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }
      
      const walksRef = ref(FIREBASE_DB, 'walks');
      const newWalkRef = push(walksRef);
      
      const newWalk = {
        userId: currentUser.uid,
        petId: petId,
        timestamp: timeString,
        walkLenght: parseInt(walkLength),
        status: 0 // solicitado
      };
      
      await set(newWalkRef, newWalk);
      
      setShowScheduleDialog(false);
      Alert.alert('Sucesso', 'Passeio agendado com sucesso!');
      fetchWalks(dateString);
    } catch (error) {
      console.error('Error scheduling walk:', error);
      Alert.alert('Erro', 'Não foi possível agendar o passeio.');
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 0:
        return { text: 'Solicitado', color: '#666666', icon: 'schedule' };
      case 1:
        return { text: 'Confirmado', color: '#00FF00', icon: 'check-circle' };
      case 4:
        return { text: 'Concluído', color: '#4169E1', icon: 'done-all' };
      default:
        return { text: 'Desconhecido', color: '#666666', icon: 'help' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Agendar Visita</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.datePickerContainer}>
        <Text style={styles.datePickerLabel}>Selecione uma data:</Text>
        <TouchableOpacity 
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.datePickerButtonText}>{formatDate(selectedDate)}</Text>
          <MaterialIcons name="calendar-today" size={24} color="#7A5038" />
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Passeios Agendados</Text>
        
        {loading ? (
          <Text style={styles.messageText}>Carregando passeios...</Text>
        ) : walks.length === 0 ? (
          <Text style={styles.messageText}>Nenhum passeio agendado para esta data.</Text>
        ) : (
          walks.map(walk => {
            const statusInfo = getStatusInfo(walk.status);
            const walkTime = walk.timestamp.split(' ')[1];
            
            return (
              <View key={walk.id} style={styles.walkCard}>
                <View style={styles.walkCardHeader}>
                  <MaterialIcons name={statusInfo.icon} size={24} color={statusInfo.color} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                  </Text>
                </View>
                <View style={styles.walkCardContent}>
                  <Text style={styles.walkTime}>{walkTime}</Text>
                  <Text style={styles.walkLength}>{walk.walkLenght} minutos</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.scheduleButton}
        onPress={() => setShowScheduleDialog(true)}
      >
        <Text style={styles.scheduleButtonText}>Agendar Novo Passeio</Text>
      </TouchableOpacity>

      {/* Schedule Dialog */}
      <Modal
        transparent
        visible={showScheduleDialog}
        animationType="fade"
        onRequestClose={() => setShowScheduleDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Agendar Passeio</Text>
              <TouchableOpacity onPress={() => setShowScheduleDialog(false)}>
                <MaterialIcons name="close" size={24} color="#7A5038" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.dialogLabel}>Data:</Text>
            <Text style={styles.dialogText}>{formatDate(selectedDate)}</Text>
            
            <Text style={styles.dialogLabel}>Horário:</Text>
            <TouchableOpacity 
              style={styles.timePickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.timePickerText}>{formatTime(selectedTime)}</Text>
              <MaterialIcons name="access-time" size={24} color="#7A5038" />
            </TouchableOpacity>
            
            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}
            
            <Text style={styles.dialogLabel}>Duração (minutos):</Text>
            <TextInput
              style={styles.durationInput}
              value={walkLength}
              onChangeText={setWalkLength}
              keyboardType="numeric"
              maxLength={3}
            />
            
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={scheduleWalk}
            >
              <Text style={styles.confirmButtonText}>Confirmar Agendamento</Text>
            </TouchableOpacity>
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
  datePickerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  datePickerLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333333',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#7A5038',
  },
  messageText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 24,
  },
  walkCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7A5038',
  },
  walkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  walkCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walkTime: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  walkLength: {
    fontSize: 16,
  },
  scheduleButton: {
    backgroundColor: '#7A5038',
    padding: 16,
    alignItems: 'center',
    margin: 16,
    borderRadius: 8,
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
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
  dialogLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 6,
    color: '#333333',
  },
  dialogText: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  timePickerText: {
    fontSize: 16,
    color: '#333333',
  },
  durationInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  confirmButton: {
    backgroundColor: '#7A5038',
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});