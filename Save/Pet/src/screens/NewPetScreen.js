import React, { useState } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { FIREBASE_DB } from '../firebaseConnection';
import { ref, push, set } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Toast from 'react-native-toast-message';

export const NewPetScreen = ({ navigation }) => {
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
  const [uploading, setUploading] = useState(false);

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
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };

  // Upload the image to Firebase Storage
  const uploadImage = async (uri) => {
    if (!uri) return null;
    
    setUploading(true);
    
    try {
      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create unique filename
      const filename = `pet_${Date.now()}.jpg`;
      const storage = getStorage();
      const imageRef = storageRef(storage, `images/${filename}`);
      
      // Upload image
      await uploadBytes(imageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);
      setUploading(false);
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
      Alert.alert('Erro', 'Não foi possível fazer o upload da imagem');
      return null;
    }
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.age || !formData.health || !formData.behavior) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setUploading(true);
      
      // Upload image if selected
      let imageUrl = '';
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
        if (!imageUrl) {
          setUploading(false);
          return; // Stop if image upload failed
        }
      }
      
      // Criar referência para a lista de pets
      const petsRef = ref(FIREBASE_DB, 'pets');
      
      // Gerar nova chave única e salvar os dados
      const newPetRef = push(petsRef);
      await set(newPetRef, {
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        size: formData.size,
        health: formData.health,
        behavior: formData.behavior,
        image: imageUrl,
        status: 0,
        historic: '',
        calendar: ''
      });

      setUploading(false);
      
      // Show success toast and go back
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Pet cadastrado com sucesso!',
        visibilityTime: 2000,
      });
      
      navigation.goBack();

    } catch (error) {
      console.error(error);
      setUploading(false);
      Alert.alert('Erro', 'Não foi possível cadastrar o pet');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Novo Pet</Text>
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
          style={[styles.registerButton, uploading && styles.disabledButton]}
          onPress={handleRegister}
          disabled={uploading}
        >
          <Text style={styles.registerButtonText}>
            {uploading ? 'Enviando...' : 'Cadastrar Pet'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  registerButton: {
    backgroundColor: '#7A5038',
    borderRadius: 24,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#C0A080',
  },
});