import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FIREBASE_DB, FIREBASE_AUTH } from '../firebaseConnection';
import { ref, set, query, orderByChild, get, startAt, endAt, equalTo } from 'firebase/database';

export const NewJobScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [selectedContactTypes, setSelectedContactTypes] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [publisherId, setPublisherId] = useState('');

  const countries = [
    { code: 'US', name: 'United States', callingCode: '1', icon: 'https://example.com/us.png' },
    { code: 'BR', name: 'Brazil', callingCode: '55', icon: 'https://example.com/br.png' },
    { code: 'PT', name: 'Portugal', callingCode: '351', icon: 'https://example.com/pt.png' },
  ];

  const contactTypes = [
    { id: 'whatsapp', name: 'WhatsApp' },
    { id: 'sms', name: 'SMS' },
    { id: 'call', name: 'Ligação' }
  ];

  useEffect(() => {
    const fetchPublisherId = async () => {
      try {
        const userEmail = FIREBASE_AUTH.currentUser?.email;
        if (!userEmail) {
          console.log('No user email found');
          return;
        }

        const usersRef = ref(FIREBASE_DB, 'users');
        const emailQuery = query(
          usersRef, 
          orderByChild('mail'), 
          equalTo(userEmail)
        );

        const snapshot = await get(emailQuery);
        
        if (snapshot.exists()) {
          const [id] = Object.keys(snapshot.val());
          setPublisherId(id);
          console.log('Publisher ID found:', id);
        } else {
          console.log('No user found with email:', userEmail);
        }
      } catch (error) {
        console.error('Error fetching publisher ID:', error);
      }
    };

    fetchPublisherId();
  }, []);

  const searchCities = async (text) => {
    setSelectedCity(text);
    if (text.length > 2) {
      const jobsRef = ref(FIREBASE_DB, 'jobs');
      const cityQuery = query(
        jobsRef,
        orderByChild('city'),
        startAt(text.toLowerCase()),
        endAt(text.toLowerCase() + '\uf8ff')
      );
      const snapshot = await get(cityQuery);
      if (snapshot.exists()) {
        const cities = Object.values(snapshot.val())
          .map(job => `${job.city}, ${job.country}`)
          .filter((value, index, self) => self.indexOf(value) === index);
        setCitySuggestions(cities);
      }
    } else {
      setCitySuggestions([]);
    }
  };

  const toggleContactType = (type) => {
    if (selectedContactTypes.includes(type)) {
      setSelectedContactTypes(selectedContactTypes.filter(t => t !== type));
    } else {
      setSelectedContactTypes([...selectedContactTypes, type]);
    }
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const handleSubmit = async () => {
    console.log(publisherId)
    if (!publisherId) return;

    const selectedCountryData = countries.find(c => c.code === selectedCountry);
    const contact = `+${selectedCountryData.callingCode}${phone};${selectedContactTypes.join(',')};${contactName}`;
    const [city, country] = selectedCity.split(', ');

    const jobData = {
      date: getCurrentDateTime(),
      publisherId,
      title,
      description,
      value: price || null,
      contact,
      mail: email || null,
      city,
      country: selectedCountry,
    };

    console.log(JSON.stringify(jobData))

    try {
      const newJobRef = ref(FIREBASE_DB, 'jobs/' + Date.now());
      await set(newJobRef, jobData);
      navigation.goBack()
    } catch (error) {
      // Handle error
      console.error('Error creating job:', error);
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#0D47A1' }}>
      {/* Toolbar */}
      <View style={{
        backgroundColor: '#FDBB1F',
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center'
      }}>
        <Icon name="arrow-back" size={24} color="#3A82F6" onPress={() => navigation.goBack()} />
        <Text style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 24,
          color: 'black',
          marginRight: 24
        }}>Anunciar uma Vaga</Text>
      </View>

      {/* Content */}
      <ScrollView style={{ padding: 32 }}>
        <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
          Para anunciar basta registrar os dados necessários e enviar para nosso time de revisão
        </Text>
        
        <Text style={{ color: '#FDBB1F', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          * para campos obrigatórios
        </Text>

        {/* Title Input */}
        <View style={{ marginTop: 16 }}>
          <View style={{
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 56,
          }}>
            <TextInput
              placeholder="* Título"
              placeholderTextColor="#BEBEBE"
              style={{
                fontSize: 16,
                color: 'white',
                padding: 16
              }}
              value={title}
              onChangeText={setTitle}
              maxLength={40}
            />
          </View>
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'right', marginTop: 8 }}>
            {title.length}/40
          </Text>
        </View>

        {/* Price Input */}
        <View style={{ marginTop: 8 }}>
          <View style={{
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 56,
          }}>
            <TextInput
              placeholder="Valor (opcional)"
              placeholderTextColor="#BEBEBE"
              style={{
                fontSize: 16,
                color: 'white',
                padding: 16
              }}
              value={price}
              onChangeText={setPrice}
              maxLength={12}
              keyboardType="numeric"
            />
          </View>
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'right', marginTop: 8 }}>
            {price.length}/12
          </Text>
        </View>

        {/* Description Input */}
        <View style={{ marginTop: 8 }}>
          <View style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 160,
          }}>
            <TextInput
              placeholder="* Descrição"
              placeholderTextColor="#BEBEBE"
              style={{
                fontSize: 16,
                color: 'white',
                padding: 16
              }}
              value={description}
              onChangeText={setDescription}
              maxLength={400}
              multiline
            />
          </View>
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'right', marginTop: 8 }}>
            {description.length}/400
          </Text>
        </View>

        {/* Contact Name Input */}
        <View style={{ marginTop: 8 }}>
          <View style={{
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 56,
          }}>
            <TextInput
              placeholder="* Nome do Contato"
              placeholderTextColor="#BEBEBE"
              style={{
                fontSize: 16,
                color: 'white',
                padding: 16
              }}
              value={contactName}
              onChangeText={setContactName}
              maxLength={20}
            />
          </View>
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'right', marginTop: 8 }}>
            {contactName.length}/20
          </Text>
        </View>

        {/* Phone Input Row */}
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {/* Country Picker */}
          <View style={{
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            flex: 1
          }}>
            <Picker
              selectedValue={selectedCountry}
              onValueChange={setSelectedCountry}
              style={{
                flex: 1,
                color: 'white',
                height: 56
              }}
              dropdownIconColor="white"
            >
              {countries.map((country) => (
                <Picker.Item 
                  key={country.code}
                  label={`+${country.callingCode}`}
                  value={country.code}
                />
              ))}
            </Picker>
          </View>

          {/* Phone Number Input */}
          <View style={{
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 56,
            marginLeft: 16,
            flex: 2
          }}>
            <TextInput
              placeholder="* Telefone"
              placeholderTextColor="#BEBEBE"
              style={{
                fontSize: 16,
                color: 'white',
                padding: 16
              }}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Contact Type */}
        <Text style={{ color: 'white', fontSize: 16, marginTop: 8 }}>
          * Tipo de Contato
        </Text>
        <View style={{
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'white',
          marginTop: 8,
          padding: 8
        }}>
          {contactTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 8
              }}
              onPress={() => toggleContactType(type.id)}
            >
              <Icon
                name={selectedContactTypes.includes(type.id) ? 'check-box' : 'check-box-outline-blank'}
                size={24}
                color="white"
              />
              <Text style={{ marginLeft: 8, color: 'white', fontSize: 16 }}>{type.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email Input */}
        <View style={{ marginTop: 8 }}>
          <View style={{
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'white',
            height: 56,
          }}>
            <TextInput
              placeholder="E-mail (opcional)"
              placeholderTextColor="#BEBEBE"
              style={{
                fontSize: 16,
                color: 'white',
                padding: 16
              }}
              value={email}
              onChangeText={setEmail}
              maxLength={30}
              keyboardType="email-address"
            />
          </View>
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'right', marginTop: 8 }}>
            {email.length}/30
          </Text>
        </View>

        {/* City Input */}
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
          <View style={{ flex: 2 }}>
            <View style={{
              backgroundColor: '#0D47A1',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'white',
              height: 56,
            }}>
              <TextInput
                placeholder="* Cidade"
                placeholderTextColor="#BEBEBE"
                style={{
                  fontSize: 16,
                  color: 'white',
                  padding: 16
                }}
                value={selectedCity}
                onChangeText={searchCities}
              />
            </View>
            {citySuggestions.length > 0 && (
              <View style={{
                position: 'absolute',
                top: 56,
                left: 0,
                right: 0,
                backgroundColor: 'white',
                borderRadius: 8,
                zIndex: 1,
                maxHeight: 200,
              }}>
                <ScrollView>
                  {citySuggestions.map((city, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: '#eee'
                      }}
                      onPress={() => {
                        setSelectedCity(city);
                        setCitySuggestions([]);
                      }}
                    >
                      <Text>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{
              backgroundColor: '#0D47A1',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'white',
              height: 56,
            }}>
              <Picker
                selectedValue={selectedCountry}
                onValueChange={setSelectedCountry}
                style={{ color: 'white' }}
                dropdownIconColor="white"
              >
                {countries.map((country) => (
                  <Picker.Item
                    key={country.code}
                    label={country.code}
                    value={country.code}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#FDBB1F',
            borderRadius: 8,
            height: 56,
            marginTop: 16,
            justifyContent: 'center',
            alignItems: 'center'
          }}
          onPress={handleSubmit}
        >
          <Text style={{ color: '#0D47A1', fontSize: 16 }}>Continuar</Text>
        </TouchableOpacity>

        <View style={{height: 64}}/>
      </ScrollView>
    </View>
  );
};