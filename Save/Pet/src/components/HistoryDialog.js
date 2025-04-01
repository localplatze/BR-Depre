import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  dialogContainer: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden'
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7A5038'
  },
  historyList: {
    padding: 16
  },
  historyEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
  },
  historyDate: {
    fontSize: 16,
    color: '#333333'
  },
  historyStatus: {
    fontSize: 16,
    fontWeight: '500',
    color: '#7A5038'
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    padding: 20
  }
});

export default HistoryDialog;