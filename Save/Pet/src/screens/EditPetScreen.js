import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { FIREBASE_DB } from '../firebaseConnection';
import { ref, update, remove, get } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import Toast from 'react-native-toast-message';

export const EditPetScreen = ({ route, navigation }) => {
  const { petId } = route.params;
  const [originalData, setOriginalData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ageValue: '', // Alterado de 'age' para 'ageValue'
    ageUnit: 'meses', // Nova propriedade para a unidade da idade
    gender: 'M',
    size: 'M',
    health: '',
    behavior: '',
    image: '',
    status: 0,
    historic: '',
    calendar: ''
  });
  
  const [imageUri, setImageUri] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);

  useEffect(() => {
    const loadPetData = async () => {
      try {
        const petRef = ref(FIREBASE_DB, `pets/${petId}`);
        const snapshot = await get(petRef);
        
        if (snapshot.exists()) {
          const petData = snapshot.val();
          setOriginalData(petData);

          let loadedAgeValue = '';
          let loadedAgeUnit = 'meses'; // Default unit

          // Separar a string 'age' do Firebase em 'ageValue' e 'ageUnit'
          if (petData.age && typeof petData.age === 'string') {
            const ageParts = petData.age.split(' ');
            if (ageParts.length === 2 && !isNaN(parseInt(ageParts[0]))) {
              loadedAgeValue = ageParts[0];
              loadedAgeUnit = ageParts[1].toLowerCase() === 'anos' ? 'anos' : 'meses';
            } else if (!isNaN(parseInt(petData.age))) { // Caso antigo, só número
              loadedAgeValue = petData.age.toString();
              loadedAgeUnit = 'meses'; // Assume meses se for só número
            }
          } else if (petData.age && !isNaN(parseInt(petData.age))) { // Caso antigo, só número
            loadedAgeValue = petData.age.toString();
            loadedAgeUnit = 'meses'; // Assume meses se for só número
          }
          
          setFormData({
            name: petData.name || '',
            ageValue: loadedAgeValue,
            ageUnit: loadedAgeUnit,
            gender: petData.gender || 'M',
            size: petData.size || 'M',
            health: petData.health || '',
            behavior: petData.behavior || '',
            image: petData.image || '',
            status: petData.status || 0,
            historic: petData.historic || '',
            calendar: petData.calendar || ''
          });
          
          if (petData.image) {
            setOriginalImageUrl(petData.image);
            setImageUri(petData.image);
          }
        } else {
          Toast.show({
            type: 'error',
            text1: 'Erro',
            text2: 'Pet não encontrado',
          });
          navigation.goBack();
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: 'Não foi possível carregar os dados do pet',
        });
      }
    };

    loadPetData();
  }, [petId]);

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da permissão para acessar suas fotos');
        return false;
      }
      return true;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setImageChanged(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return null;
    const segments = url.split('/');
    const fileNameWithParams = segments[segments.length - 1];
    return fileNameWithParams.split('?')[0];
  };

  const deleteOldImage = async (imageUrl) => {
    if (!imageUrl) return;
    try {
      const fileName = getFileNameFromUrl(imageUrl);
      if (!fileName) return;
      const storage = getStorage();
      const oldImageRef = storageRef(storage, `images/${fileName}`);
      await deleteObject(oldImageRef);
    } catch (error) {
      console.error('Erro ao excluir imagem antiga:', error);
    }
  };

  const uploadImage = async (uri) => {
    if (!uri || !imageChanged) return originalImageUrl; // Se não mudou, retorna a original
    setUploading(true); // Mover para cá para indicar upload apenas se necessário
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `pet_${petId}_${Date.now()}.jpg`;
      const storage = getStorage();
      const imageRef = storageRef(storage, `images/${filename}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      // setUploading(false); // Será feito no handleUpdate
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      // setUploading(false); // Será feito no handleUpdate
      Alert.alert('Erro', 'Não foi possível fazer o upload da imagem');
      return null;
    }
  };

  const handleUpdate = async () => {
    // Validar se ageValue foi preenchido
    if (!formData.name || !formData.ageValue || !formData.health || !formData.behavior) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios, incluindo a idade.');
      return;
    }
    // Validar se ageValue é um número
     if (isNaN(parseInt(formData.ageValue))) {
        Alert.alert('Erro', 'A idade deve ser um número.');
        return;
    }

    setUploading(true); // Inicia o estado de uploading aqui

    try {
      let imageUrl = formData.image; // Usa a imagem atual como padrão
      if (imageChanged && imageUri) { // Se a imagem mudou E existe uma nova URI
        imageUrl = await uploadImage(imageUri);
        if (!imageUrl) { // Se o upload falhar
          setUploading(false);
          return; 
        }
      }
      
      const petRef = ref(FIREBASE_DB, `pets/${petId}`);
      
      // Combinar ageValue e ageUnit em uma string para 'age'
      const ageString = `${formData.ageValue} ${formData.ageUnit}`;

      await update(petRef, {
        name: formData.name,
        age: ageString, // Salvar a string combinada
        gender: formData.gender,
        size: formData.size,
        health: formData.health,
        behavior: formData.behavior,
        image: imageUrl,
        status: formData.status,
        historic: formData.historic,
        calendar: formData.calendar
      });

      if (imageChanged && originalImageUrl && originalImageUrl !== imageUrl) {
        await deleteOldImage(originalImageUrl);
      }

      setUploading(false);
      
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Pet atualizado com sucesso!',
        visibilityTime: 2000,
      });
      
      navigation.goBack();

    } catch (error) {
      console.error(error);
      setUploading(false);
      Alert.alert('Erro', 'Não foi possível atualizar o pet');
    }
  };

  const confirmDelete = () => setShowDeleteConfirm(true);
  const cancelDelete = () => setShowDeleteConfirm(false);

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setUploading(true);
    try {
      if (originalImageUrl) {
        await deleteOldImage(originalImageUrl);
      }
      const petRef = ref(FIREBASE_DB, `pets/${petId}`);
      await remove(petRef);
      setUploading(false);
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Pet excluído com sucesso!',
        visibilityTime: 2000,
      });
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao excluir pet:', error);
      setUploading(false);
      Alert.alert('Erro', 'Não foi possível excluir o pet');
    }
  };

  if (!originalData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.toolbar}><Text style={styles.toolbarTitle}>Editar Pet</Text></View>
        <View style={styles.loadingContainer}><Text>Carregando dados...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}><Text style={styles.toolbarTitle}>Editar Pet</Text></View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inputContainer}>
          <View style={styles.imageSection}>
            <TouchableOpacity style={styles.imageUploadButton} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Selecionar Foto do Pet</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Nome do Pet"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />

          {/* Campo de Idade Ajustado */}
          <View style={styles.ageInputRow}>
            <TextInput
              style={[styles.input, styles.ageNumericInput]}
              placeholder="Idade"
              value={formData.ageValue}
              // Permitir apenas números
              onChangeText={(text) => setFormData({ ...formData, ageValue: text.replace(/[^0-9]/g, '') })}
              keyboardType="numeric"
            />
            <View style={styles.ageUnitPickerContainer}>
              <Picker
                selectedValue={formData.ageUnit}
                onValueChange={(value) => setFormData({ ...formData, ageUnit: value })}
                style={styles.ageUnitPicker}
              >
                <Picker.Item label="Meses" value="meses" />
                <Picker.Item label="Anos" value="anos" />
              </Picker>
            </View>
          </View>


          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Gênero:</Text>
            <Picker
              selectedValue={formData.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              style={styles.picker}
            >
              <Picker.Item label="Macho" value="M" />
              <Picker.Item label="Fêmea" value="F" />
            </Picker>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Porte:</Text>
            <Picker
              selectedValue={formData.size}
              onValueChange={(value) => setFormData({ ...formData, size: value })}
              style={styles.picker}
            >
              <Picker.Item label="Pequeno" value="P" />
              <Picker.Item label="Médio" value="M" />
              <Picker.Item label="Grande" value="G" />
            </Picker>
          </View>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Informações de Saúde"
            value={formData.health}
            onChangeText={(text) => setFormData({ ...formData, health: text })}
            multiline
            numberOfLines={4}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Informações de Comportamento"
            value={formData.behavior}
            onChangeText={(text) => setFormData({ ...formData, behavior: text })}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.updateButton, uploading && styles.disabledButton]}
          onPress={handleUpdate}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {uploading ? 'Salvando...' : 'Salvar Alterações'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, uploading && styles.disabledButton]}
          onPress={confirmDelete}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>Excluir Pet</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showDeleteConfirm} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Exclusão</Text>
            <Text style={styles.modalText}>Tem certeza que deseja excluir este pet? Esta ação não pode ser desfeita.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={cancelDelete}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleDelete}>
                <Text style={styles.confirmButtonText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Toast />
    </SafeAreaView>
  );
};

// Reutilize os estilos de NewPetScreen, adicionando os específicos de EditPetScreen se necessário
// E os novos estilos para o campo de idade
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toolbar: {
      backgroundColor: '#FFE6D8',
      justifyContent: 'center',
      paddingTop: 48,
      paddingBottom: 16,
      paddingHorizontal: 16,
      elevation: 4,
    },
    toolbarTitle: {
      fontSize: 20,
      color: '#7A5038',
      fontWeight: 'bold',
    },
    scrollContent: {
      padding: 24,
    },
    inputContainer: {
      width: '100%',
      marginBottom: 16,
    },
    imageSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    imageUploadButton: {
      width: 150,
      height: 150,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 75,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#FFE6D8',
      backgroundColor: '#F9F9F9',
    },
    imagePlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F9F9F9',
    },
    imagePlaceholderText: {
      color: '#7A5038',
      textAlign: 'center',
      padding: 8,
      fontSize: 14,
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    input: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: 16,
      marginBottom: 16,
      borderColor: '#FFE6D8',
      borderWidth: 2,
      width: '100%',
    },
    // Estilos para o campo de idade (reutilizados de NewPetScreen)
    ageInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    ageNumericInput: {
      flex: 1,
      marginRight: 8,
      marginBottom: 0, 
    },
    ageUnitPickerContainer: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      borderColor: '#FFE6D8',
      borderWidth: 2,
      height: 58, // Ajustar conforme necessário para alinhar com TextInput
      justifyContent: 'center', // Para alinhar o Picker verticalmente
    },
    ageUnitPicker: {
      // Estilos do Picker podem ser complicados e variar entre iOS/Android
      // Teste e ajuste conforme necessário
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    pickerContainer: {
      marginBottom: 16,
    },
    pickerLabel: {
      color: '#7A5038',
      marginBottom: 8,
      marginLeft: 8,
    },
    picker: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      borderColor: '#FFE6D8',
      borderWidth: 2,
    },
    updateButton: {
      backgroundColor: '#7A5038',
      borderRadius: 24,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginTop: 24, // Ajustado para espaçamento antes do botão de excluir
      marginBottom: 16,
    },
    deleteButton: {
      backgroundColor: '#E74C3C', // Vermelho para exclusão
      borderRadius: 24,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginBottom: 24, // Margem inferior geral
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    disabledButton: {
      opacity: 0.6, // Usar opacity para feedback visual de desabilitado
    },
    modalBackground: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 24,
      width: '85%',
      alignItems: 'center',
      elevation: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#7A5038',
      marginBottom: 16,
    },
    modalText: {
      fontSize: 16,
      color: '#333333',
      textAlign: 'center',
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    modalButton: {
      borderRadius: 16,
      padding: 12,
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 8,
    },
    cancelButton: {
      backgroundColor: '#F0F0F0',
    },
    confirmButton: {
      backgroundColor: '#E74C3C',
    },
    cancelButtonText: {
      color: '#333333',
      fontWeight: 'bold',
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
});