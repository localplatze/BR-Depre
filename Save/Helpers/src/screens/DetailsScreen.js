import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, query, orderByChild, equalTo, get, update } from 'firebase/database';
import { FIREBASE_DB, FIREBASE_AUTH } from '../firebaseConnection';

const getFormattedTimeAgo = (dateString) => {
  const now = new Date();
  const postDate = new Date(dateString.split(' ')[0].split('/').reverse().join('-') + ' ' + dateString.split(' ')[1]);
  const diffMinutes = Math.floor((now - postDate) / 1000 / 60);
  
  if (diffMinutes < 60) {
    return 'Postado a menos de uma hora';
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Postado ${diffHours} horas atrás`;
  }
  
  if (diffHours < 48) {
    return 'Postado ontem';
  }
  
  return `Postado ${dateString.split(' ')[0]}`;
};

const monthNames = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};

const ContactDialog = ({ visible, onClose, contact, email }) => {
  const contactInfo = contact ? contact.split(';') : [];
  const [number, types, name] = contactInfo;
  const contactTypes = types ? types.split(',') : [];

  const handleContact = (type) => {
    switch (type) {
      case 'whatsapp':
        Linking.openURL(`whatsapp://send?phone=${number}`);
        break;
      case 'call':
        Linking.openURL(`tel:${number}`);
        break;
      case 'sms':
        Linking.openURL(`sms:${number}`);
        break;
      case 'email':
        Linking.openURL(`mailto:${email}`);
        break;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Contatar {name}</Text>
          <Text style={styles.modalSubtitle}>Escolha como deseja entrar em contato:</Text>
          
          {contactTypes.includes('whatsapp') && (
            <TouchableOpacity 
              style={styles.contactOption}
              onPress={() => handleContact('whatsapp')}
            >
              <Feather name="message-circle" size={24} color="#25D366" />
              <Text style={styles.contactOptionText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          
          {contactTypes.includes('call') && (
            <TouchableOpacity 
              style={styles.contactOption}
              onPress={() => handleContact('call')}
            >
              <Feather name="phone" size={24} color="#007AFF" />
              <Text style={styles.contactOptionText}>Ligar</Text>
            </TouchableOpacity>
          )}
          
          {contactTypes.includes('sms') && (
            <TouchableOpacity 
              style={styles.contactOption}
              onPress={() => handleContact('sms')}
            >
              <Feather name="message-square" size={24} color="#34C759" />
              <Text style={styles.contactOptionText}>SMS</Text>
            </TouchableOpacity>
          )}

          {email && (
            <TouchableOpacity 
              style={styles.contactOption}
              onPress={() => handleContact('email')}
            >
              <Feather name="mail" size={24} color="#FF2D55" />
              <Text style={styles.contactOptionText}>Email</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const CommentItem = ({ comment, users }) => {
  const author = users[comment.authorId]?.name || 'Usuário';
  const [day, month] = comment.date.split(' ')[0].split('/');
  const time = comment.date.split(' ')[1].split(':').slice(0, 2).join(':');

  return (
    <View style={styles.commentContainer}>
      <View style={styles.dateCard}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{monthNames[month]}</Text>
      </View>
      <View style={styles.commentCard}>
        <Text style={styles.commentAuthor}>{author}</Text>
        <Text numberOfLines={2} style={styles.commentText}>
          {comment.text}
        </Text>
        <View style={styles.divider} />
        <View style={styles.commentFooter}>
          <Text style={styles.commentTime}>{time}</Text>
          <View style={styles.likeContainer}>
            <Feather name="heart" size={16} color="black" />
            <Text style={styles.likeCount}>{comment.likes?.length || 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const DetailsScreen = ({ route }) => {
  const [comment, setComment] = useState('');
  const [users, setUsers] = useState({});
  const [publisher, setPublisher] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const { job } = route.params;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = ref(FIREBASE_DB, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          setUsers(snapshot.val());
          setPublisher(snapshot.val()[job.publisherId]?.name || 'Usuário');
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [job.publisherId]);

  useEffect(() => {
    const fetchCurrentUserId = async () => {
      try {
        const userEmail = FIREBASE_AUTH.currentUser?.email;
        if (!userEmail) return;

        const usersRef = ref(FIREBASE_DB, 'users');
        const emailQuery = query(
          usersRef, 
          orderByChild('mail'), 
          equalTo(userEmail)
        );

        const snapshot = await get(emailQuery);
        if (snapshot.exists()) {
          const [id] = Object.keys(snapshot.val());
          setCurrentUserId(id);
        }
      } catch (error) {
        console.error('Error fetching current user ID:', error);
      }
    };

    fetchCurrentUserId();
  }, []);

  const handleSendComment = async () => {
    if (!comment.trim() || !currentUserId) return;

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const newComment = {
      date: formattedDate,
      authorId: currentUserId,
      text: comment.trim(),
      likes: []
    };

    try {
      const jobRef = ref(FIREBASE_DB, `jobs/${job.id}`);
      const updatedComments = [...(job.comments || []), newComment];
      await update(jobRef, { comments: updatedComments });
      setComment('');
    } catch (error) {
      console.error('Error sending comment:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.subtitle}>{publisher}</Text>
          <Text style={styles.subtitle}>{`${job.city}, ${job.country}`}</Text>
          
          {job.value && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="cash" size={24} color="gray" />
              <Text style={[styles.subtitle, styles.marginLeft]}>
                {job.value}
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Feather name="clock" size={24} color="gray" />
            <Text style={[styles.subtitle, styles.marginLeft]}>
              {getFormattedTimeAgo(job.date)}
            </Text>
          </View>

          <Text style={[styles.title, styles.marginTop]}>
            Descrição da Vaga
          </Text>
          <Text style={styles.description}>{job.description}</Text>

          <TouchableOpacity style={styles.actionButton}>
            <Feather name="flag" size={24} color="black" />
            <Text style={styles.actionButtonText}>Denunciar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Feather name="share-2" size={24} color="black" />
            <Text style={styles.actionButtonText}>Compartilhar</Text>
          </TouchableOpacity>

          <Text style={[styles.title, styles.marginTop]}>
            Localização
          </Text>
          <Text style={styles.description}>{`${job.city}, ${job.country}`}</Text>
        </View>

        <View style={styles.commentsSection}>
          <View style={styles.adBanner} />
          <Text style={styles.commentsTitle}>
            {(job.comments?.length || 0)} {job.comments?.length === 1 ? 'Comentário' : 'Comentários'}
          </Text>
          
          {job.comments?.map((comment, index) => (
            <CommentItem key={index} comment={comment} users={users} />
          ))}
          
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Comentar"
              value={comment}
              onChangeText={setComment}
              placeholderTextColor="gray"
            />
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={handleSendComment}
            >
              <Feather name="send" size={24} color="#3A82F6" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.applyButton}
          onPress={() => setShowContactDialog(true)}
        >
          <Text style={styles.applyButtonText}>
            Aplicar para Vaga
          </Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <View style={styles.savedContainer}>
            <Feather name="bookmark" size={32} color="#3A82F6" />
          </View>
        </TouchableOpacity>
      </View>

      <ContactDialog
        visible={showContactDialog}
        onClose={() => setShowContactDialog(false)}
        contact={job.contact}
        email={job.mail}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileInfo: {
    marginStart: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    color: 'black',
  },
  profileDescription: {
    fontSize: 14,
    color: 'gray',
  },
  adContainer: {
    marginHorizontal: 32,
    marginVertical: 16,
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    color: 'black',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'gray',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  marginLeft: {
    marginLeft: 8,
  },
  marginTop: {
    marginTop: 16,
  },
  description: {
    fontSize: 16,
    color: 'gray',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginTop: 12,
    elevation: 2,
    alignSelf: 'flex-start'
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: 'black',
  },
  commentsSection: {
    backgroundColor: '#0D47A1',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 24,
  },
  adBanner: {
    height: 48,
    marginHorizontal: 40,
    backgroundColor: 'white',
  },
  commentsTitle: {
    fontSize: 20,
    color: 'white',
    textAlign: 'center',
    marginVertical: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dateCard: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  dateMonth: {
    fontSize: 16,
    color: 'white',
  },
  commentCard: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 16,
  },
  commentAuthor: {
    fontSize: 14,
    color: 'gray',
  },
  commentText: {
    fontSize: 16,
    color: 'black',
  },
  divider: {
    height: 1,
    backgroundColor: '#0D47A1',
    marginVertical: 8,
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentTime: {
    fontSize: 14,
    color: 'gray',
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    marginLeft: 4,
    fontSize: 14,
    color: 'black',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 16,
  },
  commentInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 32,
    paddingHorizontal: 16,
    color: 'white',
  },
  sendButton: {
    width: 48,
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  applyButton: {
    flexDirection: 'row',
    backgroundColor: '#3A82F6',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    flex: 1, 
    marginRight: 16,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    flex: 1,
  },
  savedContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'white',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3A82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    color: 'black',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 16,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  contactOptionText: {
    fontSize: 16,
    color: 'black',
    marginLeft: 16,
  },
  closeButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: 'gray',
  },
});