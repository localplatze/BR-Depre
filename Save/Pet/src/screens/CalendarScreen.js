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
  TextInput,
  Platform,
  ActivityIndicator, // Adicionar ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker'; // <<< ADICIONAR IMPORT
import { FIREBASE_AUTH, FIREBASE_DB } from '../firebaseConnection';
import { ref, get, set, push } from 'firebase/database';

export const CalendarScreen = ({ navigation, route }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePickerIOS, setShowDatePickerIOS] = useState(false);
  const [walks, setWalks] = useState([]);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePickerIOS, setShowTimePickerIOS] = useState(false);
  const [walkLength, setWalkLength] = useState('30');
  const [loading, setLoading] = useState(false); // Para carregamento geral da tela e firebase
  const [scheduling, setScheduling] = useState(false); // Para loading específico do agendamento
  const [petId, setPetId] = useState(null);
  const [petName, setPetName] = useState(''); // Para exibir o nome do pet

  const [visitType, setVisitType] = useState('passeio'); // <<< NOVO ESTADO: 'passeio' ou 'adocao'

  useEffect(() => {
    if (route.params?.petId) {
      setPetId(route.params.petId);
      setPetName(route.params?.petName || 'Pet'); // Pegar nome do pet
    } else {
      // Se não houver petId, talvez redirecionar ou mostrar um aviso
      Alert.alert("Atenção", "Nenhum pet selecionado. Retornando à tela anterior.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    }
  }, [route.params]);

  useEffect(() => {
    if (petId) { // Só busca passeios se petId estiver definido
      fetchWalks(formatDate(selectedDate));
    }
  }, [petId, selectedDate]); // Adicione selectedDate e petId aqui

  const formatDate = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date) => {
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const fetchWalks = async (dateString) => {
    if (!petId) return; // Não buscar se não houver petId
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

      const filteredWalks = Object.entries(walksData)
        .map(([id, walk]) => ({ id, ...walk }))
        .filter(walk => {
          const walkDate = walk.timestamp.split(' ')[0];
          // Filtra pela data E pelo petId
          return walkDate === dateString && walk.petId === petId;
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
    if (Platform.OS === 'android') {
      if (event.type === 'set' && date) {
        setSelectedDate(date);
      }
    } else {
      setShowDatePickerIOS(false);
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const handleTimeChange = (event, time) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && time) {
        setSelectedTime(time);
      }
    } else {
      setShowTimePickerIOS(false);
      if (time) {
        setSelectedTime(time);
      }
    }
  };

  const openDatePickerAndroid = () => {
    DateTimePickerAndroid.open({
      value: selectedDate,
      onChange: handleDateChange,
      mode: 'date',
      minimumDate: new Date(),
      display: 'default',
    });
  };

  const openTimePickerAndroid = () => {
    DateTimePickerAndroid.open({
      value: selectedTime,
      onChange: handleTimeChange,
      mode: 'time',
      is24Hour: true,
      display: 'default',
    });
  };

  const checkTimeConflict = (newWalkTime, newWalkLength) => {
    const newStartTime = new Date(selectedDate);
    const [hours, minutes] = newWalkTime.split(':').map(Number);
    newStartTime.setHours(hours, minutes, 0, 0);

    const newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + parseInt(newWalkLength, 10));

    for (const walk of walks) {
      const walkTimestamp = walk.timestamp;
      const [walkDateStr, walkTimeStr] = walkTimestamp.split(' ');

      if (walkDateStr !== formatDate(selectedDate)) {
        continue;
      }

      const walkStartTime = new Date(selectedDate);
      const [walkHours, walkMinutes] = walkTimeStr.split(':').map(Number);
      walkStartTime.setHours(walkHours, walkMinutes, 0, 0);

      const walkEndTime = new Date(walkStartTime);
      walkEndTime.setMinutes(walkEndTime.getMinutes() + parseInt(walk.walkLenght, 10));

      if (
        (newStartTime >= walkStartTime && newStartTime < walkEndTime) ||
        (newEndTime > walkStartTime && newEndTime <= walkEndTime) ||
        (newStartTime <= walkStartTime && newEndTime >= walkEndTime)
      ) {
        return true;
      }
    }
    return false;
  };

  const scheduleWalk = async () => {
    if (!petId) {
      Alert.alert('Erro', 'ID do pet não encontrado.');
      return;
    }

    const walkTime = formatTime(selectedTime);
    const dateString = formatDate(selectedDate);
    const timeString = `${dateString} ${walkTime}`;

    if (checkTimeConflict(walkTime, walkLength)) {
      Alert.alert('Conflito de Horário', 'Já existe um agendamento que entra em conflito com este horário.');
      return;
    }

    if (!walkLength || parseInt(walkLength, 10) <= 0) {
      Alert.alert('Duração Inválida', 'Por favor, insira uma duração válida para a visita.');
      return;
    }


    setScheduling(true); // Inicia o loading do agendamento
    try {
      const currentUser = FIREBASE_AUTH.currentUser;
      if (!currentUser) {
        Alert.alert('Erro de Autenticação', 'Usuário não autenticado.');
        setScheduling(false);
        return;
      }

      const walksRef = ref(FIREBASE_DB, 'walks');
      const newWalkRef = push(walksRef);

      const newVisit = {
        userId: currentUser.uid,
        petId: petId,
        petName: petName, // Salvar o nome do pet para facilitar a exibição em outras telas
        timestamp: timeString,
        walkLenght: parseInt(walkLength, 10),
        type: visitType, // <<< ADICIONAR TIPO DE VISITA
        status: 0, // 0: solicitado
        createdAt: new Date().toISOString(),
      };

      await set(newWalkRef, newVisit);

      setShowScheduleDialog(false);
      setVisitType('passeio'); // Resetar o tipo de visita para o padrão
      setSelectedTime(new Date());
      setWalkLength('30');
      Alert.alert('Sucesso!', 'Visita agendada com sucesso!');
      fetchWalks(dateString);
    } catch (error) {
      console.error('Error scheduling walk:', error);
      Alert.alert('Erro ao Agendar', 'Não foi possível agendar a visita.');
    } finally {
      setScheduling(false); // Finaliza o loading do agendamento
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 0:
        return { text: 'Solicitado', color: '#FFA500', icon: 'schedule' };
      case 1:
        return { text: 'Confirmado', color: '#4CAF50', icon: 'check-circle' };
      case 4:
        return { text: 'Concluído', color: '#2196F3', icon: 'done-all' };
      default:
        return { text: 'Desconhecido', color: '#666666', icon: 'help-outline' };
    }
  };

  // Função para capitalizar a primeira letra
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  if (!petId && !loading) { // Se petId não estiver definido e não estiver carregando params
    // O Alert no useEffect já cuida do redirecionamento.
    // Podemos mostrar um placeholder ou ActivityIndicator aqui.
    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.content, styles.centered]}>
                <ActivityIndicator size="large" color="#7A5038" />
                <Text style={styles.messageText}>Carregando dados do pet...</Text>
            </View>
        </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#7A5038" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Agendar para {petName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.datePickerContainer}>
        <Text style={styles.datePickerLabel}>Selecione uma data:</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={Platform.OS === 'android' ? openDatePickerAndroid : () => setShowDatePickerIOS(true)}
        >
          <Text style={styles.datePickerButtonText}>{formatDate(selectedDate)}</Text>
          <MaterialIcons name="calendar-today" size={24} color="#7A5038" />
        </TouchableOpacity>

        {Platform.OS === 'ios' && showDatePickerIOS && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Agendamentos para {formatDate(selectedDate)}</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#7A5038" />
            <Text style={styles.messageText}>Carregando agendamentos...</Text>
          </View>
        ) : walks.length === 0 ? (
          <Text style={styles.messageText}>Nenhuma visita agendada para esta data.</Text>
        ) : (
          walks.sort((a, b) => {
            const timeA = a.timestamp.split(' ')[1];
            const timeB = b.timestamp.split(' ')[1];
            return timeA.localeCompare(timeB);
          }).map(visit => { // Renomeado para 'visit' para clareza
            const statusInfo = getStatusInfo(visit.status);
            const visitTime = visit.timestamp.split(' ')[1];
            const visitTypeText = visit.type === 'adocao' ? 'Adoção' : 'Passeio'; // <<< TEXTO DO TIPO

            return (
              <View key={visit.id} style={[styles.walkCard, { borderLeftColor: statusInfo.color }]}>
                <View style={styles.walkCardHeader}>
                  <MaterialIcons name={statusInfo.icon} size={24} color={statusInfo.color} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                  </Text>
                </View>
                <View style={styles.walkCardContent}>
                  <View style={styles.walkDetail}>
                    <MaterialIcons name="sell" size={18} color="#555" style={{marginRight: 4}}/>
                    <Text style={styles.walkType}>{visitTypeText}</Text> {/* <<< EXIBIR TIPO */}
                  </View>
                  <View style={styles.walkDetail}>
                    <MaterialIcons name="access-time" size={18} color="#555" />
                    <Text style={styles.walkTime}>{visitTime}</Text>
                  </View>
                </View>
                <View style={styles.walkCardContent}>
                    <View style={styles.walkDetail}>
                        <MaterialIcons name="timer" size={18} color="#555" />
                        <Text style={styles.walkLength}>{visit.walkLenght} minutos</Text>
                    </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.scheduleButton}
        onPress={() => {
            if (!petId) {
                Alert.alert("Atenção", "Nenhum pet foi selecionado para agendamento.");
                return;
            }
            setShowScheduleDialog(true);
        }}
        disabled={!petId}
      >
        <Text style={styles.scheduleButtonText}>Agendar Nova Visita</Text>
      </TouchableOpacity>

      {/* Schedule Dialog */}
      <Modal
        transparent
        visible={showScheduleDialog}
        animationType="fade"
        onRequestClose={() => {
            if (scheduling) return; // Não fechar se estiver agendando
            setShowScheduleDialog(false);
            setVisitType('passeio'); // Resetar ao fechar
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Agendar Visita</Text>
              <TouchableOpacity onPress={() => {
                if (scheduling) return;
                setShowScheduleDialog(false);
                setVisitType('passeio'); // Resetar ao fechar
              }}
              disabled={scheduling}
              >
                <MaterialIcons name="close" size={24} color="#7A5038" />
              </TouchableOpacity>
            </View>

            {/* SELETOR DE TIPO DE VISITA */}
            <Text style={styles.dialogLabel}>Tipo de Visita:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={visitType}
                style={styles.picker}
                onValueChange={(itemValue, itemIndex) => setVisitType(itemValue)}
                enabled={!scheduling}
              >
                <Picker.Item label="Passeio com o Pet" value="passeio" />
                <Picker.Item label="Visita para Adoção" value="adocao" />
              </Picker>
            </View>

            <Text style={styles.dialogLabel}>Data:</Text>
            <Text style={styles.dialogText}>{formatDate(selectedDate)}</Text>

            <Text style={styles.dialogLabel}>Horário:</Text>
            <TouchableOpacity
              style={styles.timePickerButton}
              onPress={Platform.OS === 'android' ? openTimePickerAndroid : () => setShowTimePickerIOS(true)}
              disabled={scheduling}
            >
              <Text style={styles.timePickerText}>{formatTime(selectedTime)}</Text>
              <MaterialIcons name="access-time" size={24} color="#7A5038" />
            </TouchableOpacity>

            {Platform.OS === 'ios' && showTimePickerIOS && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
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
              editable={!scheduling}
            />

            <TouchableOpacity
              style={[styles.confirmButton, scheduling ? styles.confirmButtonDisabled : {}]}
              onPress={scheduleWalk}
              disabled={scheduling}
            >
              {scheduling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmar Agendamento</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Seus estilos (styles)
const styles = StyleSheet.create({
  // ... (seus estilos existentes)
  container: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 24 : 48,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  toolbarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7A5038',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  datePickerContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  datePickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#424242',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16, // Apenas horizontal aqui, vertical será do scroll
  },
  centered: { // Novo estilo para centralizar conteúdo
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16, // Adicionado marginTop
    marginBottom: 16,
    color: '#7A5038',
  },
  messageText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginTop: 10, // Reduzido marginTop
    paddingHorizontal: 16,
  },
  walkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  walkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  walkCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Ajustado para space-between se necessário
    alignItems: 'center',
    marginTop: 8, // Adicionado marginTop para espaçamento entre linhas de detalhes
  },
  walkDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10, // Espaço entre detalhes na mesma linha
  },
  walkTime: {
    fontSize: 15, // Ajustado
    fontWeight: '500', // Ajustado
    color: '#333',
    marginLeft: 6,
  },
  walkLength: {
    fontSize: 15, // Ajustado
    color: '#555',
    marginLeft: 6,
  },
  walkType: { // <<< NOVO ESTILO PARA O TIPO DE VISITA NO CARD
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
    marginLeft: 2, // Pequeno ajuste
  },
  scheduleButton: {
    backgroundColor: '#7A5038',
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16, // Horizontal para não colar nas bordas
    marginBottom: Platform.OS === 'ios' ? 30 : 16, // Mais margem inferior no iOS por causa da home bar
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 12,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A5038',
  },
  dialogLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    color: '#424242',
  },
  dialogText: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    color: '#333',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
  },
  timePickerText: {
    fontSize: 16,
    color: '#333333',
  },
  durationInput: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#7A5038',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    borderRadius: 10,
    elevation: 2,
  },
  confirmButtonDisabled: { // Estilo para botão desabilitado
    backgroundColor: '#A0A0A0',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerContainer: { // <<< NOVO ESTILO PARA O CONTAINER DO PICKER
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    marginBottom: 8, // Espaçamento
  },
  picker: { // <<< NOVO ESTILO PARA O PICKER EM SI
    height: 50,
    width: '100%',
    color: '#333333', // Cor do texto do picker
  },
});