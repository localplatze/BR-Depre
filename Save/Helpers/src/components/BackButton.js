import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export const BackButton = () => {
  const navigation = useNavigation();
  
  return (
    <TouchableOpacity onPress={() => navigation.goBack()}>
      <View style={styles.backButton}>
        <AntDesign name="arrowleft" size={24} color="#3A82F6" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7F0FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
});