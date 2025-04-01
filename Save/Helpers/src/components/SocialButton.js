import React from 'react';
import { TouchableOpacity, Text, Image, StyleSheet } from 'react-native';

export const SocialButton = ({ title, icon, marginTop, onPress }) => (
  <TouchableOpacity 
    style={[styles.socialButton, marginTop && { marginTop }]}
    onPress={onPress}
  >
    <Image source={icon} style={styles.socialIcon} />
    <Text style={styles.socialText}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: 'white',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  socialIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  socialText: {
    fontSize: 18,
    color: 'black',
  },
});