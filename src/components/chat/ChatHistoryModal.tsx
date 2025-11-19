import React from 'react';
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  FlatList,
  View,
  TouchableOpacity,
} from 'react-native';
import { ChatMessage } from '../../types/chat';
import { Button } from '../Button';

type Props = {
  visible: boolean;
  messages: ChatMessage[];
  loading: boolean;
  reachedEnd: boolean;
  onClose: () => void;
  onLoadMore: () => void;
};

export const ChatHistoryModal: React.FC<Props> = ({
  visible,
  messages,
  loading,
  reachedEnd,
  onClose,
  onLoadMore,
}) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Chat History</Text>
          <Button variant="ghost" startIconName="close-outline" onPress={onClose} />
        </View>
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            reachedEnd ? (
              <Text style={styles.endText}>Đã đến đầu lịch sử</Text>
            ) : (
              <TouchableOpacity style={styles.loadMore} onPress={onLoadMore} disabled={loading}>
                <Text style={styles.loadMoreText}>{loading ? 'Đang tải...' : 'Tải thêm'}</Text>
              </TouchableOpacity>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.message, item.isAgent ? styles.agent : styles.user]}>
              <Text style={styles.messageText}>
                {item.kind.type === 'text' ? item.kind.text : '[Unsupported]'}
              </Text>
              <Text style={styles.timestamp}>
                {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  message: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  user: {
    backgroundColor: '#FF6EA1',
    alignSelf: 'flex-end',
  },
  agent: {
    backgroundColor: '#1F1F2C',
    alignSelf: 'flex-start',
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  loadMore: {
    alignSelf: 'center',
    padding: 10,
  },
  loadMoreText: {
    color: '#fff',
  },
  endText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 8,
  },
});

