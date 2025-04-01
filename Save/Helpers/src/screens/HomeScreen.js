import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { AntDesign, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { FIREBASE_DB, FIREBASE_AUTH } from '../firebaseConnection';
import { ref, onValue, update, get, query, orderByChild, equalTo } from 'firebase/database';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const { width } = Dimensions.get('window');

const BannerItem = ({ image }) => (
  <Image
    source={{ uri: image }}
    style={styles.bannerImage}
    resizeMode="cover"
  />
);

const BannerDot = ({ active }) => (
  <View style={[styles.dot, active && styles.activeDot]} />
);

const JobCard = ({ job, publisherData, onToggleLike }) => {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const userEmail = FIREBASE_AUTH.currentUser?.email;
  
  useEffect(() => {
    const fetchUserId = async () => {
      if (!userEmail) return;
      const usersRef = ref(FIREBASE_DB, 'users');
      const emailQuery = query(usersRef, orderByChild('mail'), equalTo(userEmail));
      const snapshot = await get(emailQuery);
      if (snapshot.exists()) {
        const [id] = Object.keys(snapshot.val());
        setUserId(id);
      }
    };
    fetchUserId();
  }, [userEmail]);

  const isLiked = job.likes?.includes(userId);
  
  // Parse date string "DD/MM/YYYY HH:mm:ss"
  const parseDateString = (dateStr) => {
    const [datePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(year, month - 1, day);
  };

  const jobDate = parseDateString(job.date);
  const currentDate = new Date();
  const diffYears = currentDate.getFullYear() - jobDate.getFullYear();
  
  const dateDisplay = {
    topText: diffYears > 0 ? 
      jobDate.toLocaleString('default', { month: 'short' }) :
      jobDate.getDate(),
    bottomText: diffYears > 0 ?
      jobDate.getFullYear() :
      jobDate.toLocaleString('default', { month: 'short' })
  };
  
  return (
    <TouchableOpacity 
      onPress={() => navigation.navigate('Details', { job })} 
      style={styles.jobCard}
    >
      <View style={styles.jobCardHeader}>
        <View style={styles.dateCard}>
          <Text style={styles.dateDay}>{dateDisplay.topText}</Text>
          <Text style={styles.dateMonth}>{dateDisplay.bottomText}</Text>
        </View>
        <View style={styles.jobTitleContainer}>
          <Text style={styles.publisherName}>{publisherData?.name || 'Unknown Publisher'}</Text>
          <Text style={styles.jobTitle}>{job.title}</Text>
        </View>
      </View>
      <Text style={styles.jobDescription}>
        👉 {job.description}
      </Text>
      <View style={styles.divider} />
      <View style={styles.jobCardFooter}>
        <View style={styles.locationContainer}>
          <Feather name="map-pin" size={16} color="black" />
          <Text style={styles.locationText}>{`${job.city}, ${job.country}`}</Text>
        </View>
        <View style={styles.interactionContainer}>
          <TouchableOpacity onPress={() => onToggleLike(job.id, isLiked)}>
            <AntDesign 
              name={isLiked ? "heart" : "hearto"} 
              size={16} 
              color={isLiked ? "#F44336" : "black"} 
            />
          </TouchableOpacity>
          <Text style={styles.interactionText}>{job.likes?.length || 0}</Text>
          <Feather name="message-square" size={16} color="black" style={styles.commentIcon} />
          <Text style={styles.interactionText}>{job.comments?.length || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const HomeScreen = ({ navigation }) => {
  const [currentBanner, setCurrentBanner] = useState(0);
  const [bannerImages, setBannerImages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [publishers, setPublishers] = useState({});
  const [searchText, setSearchText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [userLocation, setUserLocation] = useState({ city: '', country: '' });
  const scrollX = useRef(new Animated.Value(0)).current;
  const bannerRef = useRef(null);

  // Fetch banner images
  useEffect(() => {
    const bannerRef = ref(FIREBASE_DB, 'banner');
    return onValue(bannerRef, (snapshot) => {
      if (snapshot.exists()) {
        setBannerImages(snapshot.val());
      }
    });
  }, []);

  useEffect(() => {
    const userEmail = FIREBASE_AUTH.currentUser?.email;
    
    if (userEmail) {
      const usersRef = ref(FIREBASE_DB, 'users');
      const emailQuery = query(usersRef, orderByChild('mail'), equalTo(userEmail));
      
      return onValue(emailQuery, (snapshot) => {
        if (snapshot.exists()) {
          const users = snapshot.val();
          const userData = Object.values(users)[0]; // Get first matching user
          
          if (userData.city && userData.country) {
            setUserLocation({
              city: userData.city,
              country: userData.country
            });
            setLocationText(`${userData.city}, ${userData.country}`);
          }
        }
      });
    }
  }, []);

  // Fetch and sort jobs
  useEffect(() => {
    const jobsRef = ref(FIREBASE_DB, 'jobs');
    return onValue(jobsRef, (snapshot) => {
      if (snapshot.exists()) {
        const jobsData = snapshot.val();
        const jobsArray = Object.entries(jobsData)
          .map(([id, job]) => ({
            id,
            ...job
          }))
          .sort((a, b) => {
            // Parse dates (DD/MM/YYYY HH:mm:ss format)
            const dateA = new Date(a.date.split(' ')[0].split('/').reverse().join('-'));
            const dateB = new Date(b.date.split(' ')[0].split('/').reverse().join('-'));
            return dateB - dateA;
          })
          .slice(0, 60); // Limit to latest 60 jobs

        setJobs(jobsArray);
        
        // Fetch publishers data
        const publisherIds = [...new Set(jobsArray.map(job => job.publisherId))];
        publisherIds.forEach(publisherId => {
          const publisherRef = ref(FIREBASE_DB, `users/${publisherId}`);
          onValue(publisherRef, (snapshot) => {
            if (snapshot.exists()) {
              setPublishers(prev => ({
                ...prev,
                [publisherId]: snapshot.val()
              }));
            }
          });
        });
      }
    });
  }, []);

  // Filter jobs based on search text and location
  useEffect(() => {
    let filtered = jobs;

    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(searchText.toLowerCase()) ||
        job.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Filter by location
    if (userLocation.city && userLocation.country) {
      filtered = filtered.filter(job => 
        job.city === userLocation.city && 
        job.country === userLocation.country
      );
    }

    setFilteredJobs(filtered);
  }, [jobs, searchText, userLocation]);

  // Update location suggestions
  useEffect(() => {
    if (locationText.length > 2) {
      const suggestions = jobs
        .map(job => ({ city: job.city, country: job.country }))
        .filter((location, index, self) => 
          index === self.findIndex(l => 
            l.city === location.city && l.country === location.country
          )
        )
        .filter(location => 
          `${location.city}, ${location.country}`
            .toLowerCase()
            .includes(locationText.toLowerCase())
        );
      setLocationSuggestions(suggestions);
    } else {
      setLocationSuggestions([]);
    }
  }, [locationText, jobs]);

  const handleToggleLike = async (jobId, isCurrentlyLiked) => {
    const userEmail = FIREBASE_AUTH.currentUser?.email;
    if (!userEmail) return;
  
    try {
      const usersRef = ref(FIREBASE_DB, 'users');
      const emailQuery = query(usersRef, orderByChild('mail'), equalTo(userEmail));
      const userSnapshot = await get(emailQuery);
      
      if (!userSnapshot.exists()) return;
      
      const [userId] = Object.keys(userSnapshot.val());
      const jobRef = ref(FIREBASE_DB, `jobs/${jobId}`);
      const jobSnapshot = await get(jobRef);
      const jobData = jobSnapshot.val();
      
      let likes = jobData.likes || [];
      
      if (isCurrentlyLiked) {
        likes = likes.filter(id => id !== userId);
      } else if (!likes.includes(userId)) {
        likes = [...likes, userId];
      }
  
      await update(jobRef, { likes });
    } catch (error) {
      console.error('Error updating job likes:', error);
    }
  };

  // Update user location
  const updateUserLocation = async (city, country) => {
    const userEmail = FIREBASE_AUTH.currentUser?.email;
    if (!userEmail) return;
  
    try {
      const usersRef = ref(FIREBASE_DB, 'users');
      const emailQuery = query(usersRef, orderByChild('mail'), equalTo(userEmail));
      const snapshot = await get(emailQuery);
      
      if (snapshot.exists()) {
        const users = snapshot.val();
        const [userId, userData] = Object.entries(users)[0];
        const userRef = ref(FIREBASE_DB, `users/${userId}`);
        
        await update(userRef, {
          ...userData,
          city,
          country
        });
        
        setUserLocation({ city, country });
        setLocationText(`${city}, ${country}`);
        setLocationSuggestions([]);
      }
    } catch (error) {
      console.error('Error updating user location:', error);
    }
  };

  // Banner auto-scroll
  useEffect(() => {
    const timer = setInterval(() => {
      if (bannerImages.length > 0) {
        const nextBanner = (currentBanner + 1) % bannerImages.length;
        bannerRef.current?.scrollTo({
          x: nextBanner * width,
          animated: true,
        });
        setCurrentBanner(nextBanner);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [currentBanner, bannerImages.length]);

  const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY';

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Image
          source={require('../assets/ic_toolbar_black.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.notificationButton}>
          <Feather name="bell" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Search Card */}
      <View style={styles.searchContainer}>
        <View style={styles.searchCard}>
          <View style={styles.searchSection}>
            <Feather name="search" size={24} color="gray" />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquise Aqui"
              placeholderTextColor="gray"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <View style={styles.searchDivider} />
          <View style={styles.locationSection}>
            <Feather name="map-pin" size={24} color="gray" />
            <TextInput
              style={styles.locationInput}
              placeholder="Localização"
              placeholderTextColor="black"
              value={locationText}
              onChangeText={setLocationText}
              onFocus={() => setIsLocationInputFocused(true)}
              onBlur={() => setIsLocationInputFocused(false)}
            />
          </View>
        </View>
        {isLocationInputFocused && locationSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {locationSuggestions.map((location, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => {
                  updateUserLocation(location.city, location.country);
                  setIsLocationInputFocused(false);
                }}
              >
                <Text>{`${location.city}, ${location.country}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerContent}>
            <ScrollView
              ref={bannerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={16}
            >
              {bannerImages.map((image, index) => (
                <BannerItem key={index} image={image} />
              ))}
            </ScrollView>
          </View>
          <View style={styles.dotsContainer}>
            {bannerImages.map((_, index) => (
              <BannerDot key={index} active={index === currentBanner} />
            ))}
          </View>
        </View>

        {/* Card do Google Ads no lugar do espaçador */}
        <View style={styles.adContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.MEDIUM_RECTANGLE}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
          />
        </View>

        {/* Jobs List section update */}
        {!userLocation.city && !userLocation.country ? (
          <View style={styles.noLocationMessage}>
            <Text style={styles.messageText}>
              Por favor, escolha uma localização para ver as vagas disponíveis
            </Text>
          </View>
        ) : (
          filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              publisherData={publishers[job.publisherId]}
              onToggleLike={handleToggleLike}
            />
          ))
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <AntDesign name="home" size={32} color="#000" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <MaterialCommunityIcons name="newspaper" size={32} color="#000" />
          <Text style={styles.navText}>Notícias</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('NewJob')} 
          style={styles.navItemCenter}
        >
          <View style={styles.addButton}>
            <AntDesign name="plus" size={40} color="#000" />
          </View>
          <Text style={styles.navText}>Nova Vaga</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="bookmark" size={32} color="#000" />
          <Text style={styles.navText}>Vagas Salvas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')} 
          style={styles.navItem}
        >
          <Feather name="user" size={32} color="#000" />
          <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  toolbar: {
    paddingTop: 40,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  logo: {
    width: 162,
    height: 24,
    marginStart: 24
  },
  searchContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  searchCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    padding: 8,
  },
  searchSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchDivider: {
    width: 1,
    backgroundColor: '#FDBB1F',
    marginHorizontal: 8,
  },
  locationSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: 'gray',
  },
  locationInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: 'black',
  },
  bannerContainer: {
    height: 190,
    backgroundColor: '#FDBB1F',
  },
  bannerContent: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bannerImage: {
    width: width - 32,
    height: 140,
    borderRadius: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3A82F6',
    backgroundColor: '#FFF',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#3A82F6',
  },
  spacer: {
    padding: 32,
    backgroundColor: '#0D47A1',
  },
  jobCard: {
    marginHorizontal: 16,
    marginVertical: 4,
    backgroundColor: '#FFF',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  jobCardHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  dateCard: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dateDay: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  dateMonth: {
    color: '#FFF',
    fontSize: 16,
  },
  jobTitleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  publisherName: {
    color: '#FDBB1F',
    fontSize: 14,
  },
  jobTitle: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  jobDescription: {
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    maxHeight: 40,
  },
  divider: {
    height: 1,
    backgroundColor: '#FDBB1F',
  },
  jobCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#000',
  },
  interactionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  interactionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#000',
  },
  commentIcon: {
    marginLeft: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    justifyContent: 'space-between',
  },
  navItem: {
    alignItems: 'center',
  },
  navItemCenter: {
    alignItems: 'center',
    marginTop: -20,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FDBB1F',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontSize: 12,
    color: '#000',
    marginTop: 4,
  },
  notificationButton: {
    position: 'absolute',
    right: 16,
    top: 44,
    marginEnd: 8
  },
  suggestionsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  noLocationMessage: {
    padding: 20,
    alignItems: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  adContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
});