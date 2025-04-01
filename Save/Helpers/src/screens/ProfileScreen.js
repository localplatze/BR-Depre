import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BackButton } from '../components/BackButton';

export const ProfileScreen = () => {
  const renderDivider = () => (
    <View style={{
      height: 1,
      backgroundColor: '#808080',
      marginTop: 12
    }} />
  );

  const renderMenuItem = ({ icon, color, bgColor, title, textColor = '#000000' }) => (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 4,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Icon name={icon} size={24} color={color} />
        </View>
        <Text style={{
          marginStart: 16,
          fontSize: 16,
          color: textColor
        }}>{title}</Text>
      </View>
      {renderDivider()}
    </>
  );

  return (
    <ScrollView 
      style={{ 
        backgroundColor: 'white',
        flex: 1
      }}
      contentContainerStyle={{
        paddingHorizontal: 32,
        paddingVertical: 40
      }}
    >

      <BackButton />

      {/* Profile Header */}
      <View style={{ flexDirection: 'row', marginTop: 24, alignItems: 'center' }}>
        <View style={{ position: 'relative' }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#F1F1F1'
          }} />
          <View style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#3A82F6',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Icon name="edit" size={8} color="white" />
          </View>
        </View>
        <View style={{ marginStart: 16 }}>
          <Text style={{ fontSize: 20, color: 'black' }}>Nome do Usuário</Text>
          <Text style={{ fontSize: 14, color: '#808080' }}>Pequena Bio</Text>
        </View>
      </View>

      {/* Premium Card */}
      <Text style={{ fontSize: 20, color: 'black', marginTop: 24 }}>
        Ver vagas sem anúncios?
      </Text>
      <View style={{
        backgroundColor: '#F1F1F1',
        borderRadius: 4,
        padding: 16,
        marginTop: 8
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="stars" size={48} color="#FDBB1F" />
          <View style={{ marginStart: 16 }}>
            <Text style={{ fontSize: 16, color: 'black' }}>
              Assine o plano premium
            </Text>
            <Text style={{ fontSize: 12, color: '#808080' }}>
              Teste 3 dias grátis, após pague apenas $1,99 por mês
            </Text>
          </View>
        </View>
      </View>

      {renderDivider()}

      {/* Location */}
      <View style={{ flexDirection: 'row', marginTop: 24, alignItems: 'center' }}>
        <Icon name="location-on" size={32} color="#3A82F6" />
        <View style={{ marginStart: 8 }}>
          <Text style={{ fontSize: 12, color: '#808080' }}>Endereço</Text>
          <Text style={{ fontSize: 16, color: 'black' }}>Noira, India</Text>
        </View>
      </View>

      {/* Account Section */}
      <Text style={{ fontSize: 20, color: 'black', marginTop: 24 }}>Conta</Text>

      {/* Menu Items */}
      {renderMenuItem({
        icon: 'work',
        color: 'white',
        bgColor: '#3A82F6',
        title: 'Vagas Salvas'
      })}

      {renderMenuItem({
        icon: 'notifications',
        color: 'white',
        bgColor: '#3A82F6',
        title: 'Notificações'
      })}

      {renderMenuItem({
        icon: 'description',
        color: 'white',
        bgColor: '#3A82F6',
        title: 'Termos e Política de Privacidade'
      })}

      {renderMenuItem({
        icon: 'lock',
        color: 'white',
        bgColor: '#3A82F6',
        title: 'Alterar Senha'
      })}

      {renderMenuItem({
        icon: 'logout',
        color: 'white',
        bgColor: '#3A82F6',
        title: 'Sair da Conta'
      })}

      {/* Delete Account */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 4,
          backgroundColor: 'white',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Icon name="delete" size={24} color="red" />
        </View>
        <Text style={{
          marginStart: 16,
          fontSize: 14,
          color: 'red'
        }}>Apagar Conta</Text>
      </View>
    </ScrollView>
  );
};