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
    age: '',
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

  // Carregar dados do pet
  useEffect(() => {
    const loadPetData = async () => {
      try {
        const petRef = ref(FIREBASE_DB, `pets/${petId}`);
        const snapshot = await get(petRef);
        
        if (snapshot.exists()) {
          const petData = snapshot.val();
          setOriginalData(petData);
          setFormData({
            name: petData.name || '',
            age: petData.age ? petData.age.toString() : '',
            gender: petData.gender || 'M',
            size: petData.size || 'M',
            health: petData.health || '',
            behavior: petData.behavior || '',
            image: petData.image || '',
            status: petData.status || 0,
            historic: petData.historic || '',
            calendar: petData.calendar || ''
          });
          
          // Guardar a URL da imagem original para possível exclusão posterior
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

  // Request permission to access the device's image library
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

  // Pick an image from the device's gallery
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

  // Extract file name from URL
  const getFileNameFromUrl = (url) => {
    if (!url) return null;
    const segments = url.split('/');
    const fileNameWithParams = segments[segments.length - 1];
    return fileNameWithParams.split('?')[0];
  };

  // Delete old image from storage
  const deleteOldImage = async (imageUrl) => {
    if (!imageUrl) return;
    
    try {
      const fileName = getFileNameFromUrl(imageUrl);
      if (!fileName) return;
      
      const storage = getStorage();
      const oldImageRef = storageRef(storage, `images/${fileName}`);
      await deleteObject(oldImageRef);
      console.log('Imagem antiga excluída com sucesso');
    } catch (error) {
      console.error('Erro ao excluir imagem antiga:', error);
      // Continue with the flow even if image deletion fails
    }
  };

  // Upload the image to Firebase Storage
  const uploadImage = async (uri) => {
    if (!uri || !imageChanged) return originalImageUrl;
    
    try {
      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create unique filename
      const filename = `pet_${petId}_${Date.now()}.jpg`;
      const storage = getStorage();
      const imageRef = storageRef(storage, `images/${filename}`);
      
      // Upload image
      await uploadBytes(imageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Erro', 'Não foi possível fazer o upload da imagem');
      return null;
    }
  };

  const handleUpdate = async () => {
    if (!formData.name || !formData.age || !formData.health || !formData.behavior) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setUploading(true);
      
      // Upload new image if selected
      let imageUrl = formData.image;
      if (imageChanged) {
        imageUrl = await uploadImage(imageUri);
        if (!imageUrl) {
          setUploading(false);
          return; // Stop if image upload failed
        }
      }
      
      // Reference to the specific pet
      const petRef = ref(FIREBASE_DB, `pets/${petId}`);
      
      // Update pet data
      await update(petRef, {
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        size: formData.size,
        health: formData.health,
        behavior: formData.behavior,
        image: imageUrl,
        status: formData.status,
        historic: formData.historic,
        calendar: formData.calendar
      });

      // Delete old image if it was replaced
      if (imageChanged && originalImageUrl) {
        await deleteOldImage(originalImageUrl);
      }

      setUploading(false);
      
      // Show success toast and go back
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

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setUploading(true);
    
    try {
      // Delete image from storage if exists
      if (originalImageUrl) {
        await deleteOldImage(originalImageUrl);
      }
      
      // Delete pet from database
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

  // Mostrar indicador de carregamento enquanto os dados não estão prontos
  if (!originalData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>Editar Pet</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text>Carregando dados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Editar Pet</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inputContainer}>
          {/* Image Upload Section */}
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

          <TextInput
            style={styles.input}
            placeholder="Idade"
            value={formData.age}
            onChangeText={(text) => setFormData({ ...formData, age: text })}
            keyboardType="numeric"
          />

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
            {uploading ? 'Salvando...' : 'Editar Pet'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, uploading && styles.disabledButton]}
          onPress={confirmDelete}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            Excluir Pet
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de confirmação de exclusão */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Exclusão</Text>
            <Text style={styles.modalText}>
              Tem certeza que deseja excluir este pet? Esta ação não pode ser desfeita.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleDelete}
              >
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
      marginTop: 24,
      marginBottom: 16,
    },
    deleteButton: {
      backgroundColor: '#E74C3C',
      borderRadius: 24,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginBottom: 24,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    disabledButton: {
      opacity: 0.6,
    },
    
    // Modal styles
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