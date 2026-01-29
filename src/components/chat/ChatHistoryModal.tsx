import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  FlatList,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Share,
  Clipboard,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { ChatMessage } from '../../types/chat';
import { Button } from '../Button';
import { ChatMessageBubble } from './ChatMessageBubble';
import { TypingIndicator } from './TypingIndicator';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  visible: boolean;
  messages: ChatMessage[];
  loading: boolean;
  reachedEnd: boolean;
  isTyping?: boolean;
  onClose: () => void;
  onLoadMore: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ChatHistoryModal: React.FC<Props> = ({
  visible,
  messages,
  loading,
  reachedEnd,
  isTyping = false,
  onClose,
  onLoadMore,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [showTimeFor, setShowTimeFor] = useState<Set<string>>(new Set());
  const [atBottom, setAtBottom] = useState(true);
  const [preserveTopId, setPreserveTopId] = useState<string | null>(null);
  const [didPerformInitialLoad, setDidPerformInitialLoad] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Swipe to dismiss gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          // Swiping right to dismiss
          const progress = Math.min(gestureState.dx / SCREEN_WIDTH, 1);
          dragYAnim.setValue(gestureState.dx);
          opacityAnim.setValue(1 - progress * 0.5);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 40) {
          // Dismiss if swiped right enough
          Animated.parallel([
            Animated.timing(dragYAnim, {
              toValue: SCREEN_WIDTH,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose();
            dragYAnim.setValue(0);
            opacityAnim.setValue(1);
          });
        } else {
          // Spring back
          Animated.parallel([
            Animated.spring(dragYAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
            Animated.spring(opacityAnim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Scroll to bottom when modal opens
  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        setDidPerformInitialLoad(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
      }, 100);
    } else if (!visible) {
      setDidPerformInitialLoad(false);
      setShowTimeFor(new Set());
      setAtBottom(true);
      dragYAnim.setValue(0);
      opacityAnim.setValue(1);
    }
  }, [visible, messages.length]);

  // Scroll to bottom when new messages arrive (only if at bottom)
  useEffect(() => {
    if (visible && atBottom && messages.length > 0 && didPerformInitialLoad) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [visible, messages.length, atBottom, didPerformInitialLoad]);

  // Restore scroll position after loading more
  useEffect(() => {
    if (!loading && preserveTopId) {
      const index = messages.findIndex(m => m.id === preserveTopId);
      if (index >= 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false });
          setPreserveTopId(null);
        }, 50);
      }
    }
  }, [loading, preserveTopId, messages]);

  const toggleTimestamp = useCallback((messageId: string) => {
    setShowTimeFor(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback((message: ChatMessage) => {
    const text = message.kind.type === 'text' ? message.kind.text : '';
    if (text) {
      Clipboard.setString(text);
    }
  }, []);

  const handleShare = useCallback(async (message: ChatMessage) => {
    const text = message.kind.type === 'text' ? message.kind.text : '';
    if (text) {
      try {
        await Share.share({ message: text });
      } catch (error) {
        console.warn('[ChatHistoryModal] Share failed', error);
      }
    }
  }, []);

  const handleReport = useCallback((message: ChatMessage) => {
    Alert.alert(
      'Báo cáo tin nhắn',
      'Bạn có chắc chắn muốn báo cáo tin nhắn này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Báo cáo',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement report functionality
            console.log('[ChatHistoryModal] Report message', message.id);
          },
        },
      ]
    );
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loading || reachedEnd || messages.length === 0) return;
    const firstMessage = messages[0];
    if (firstMessage) {
      setPreserveTopId(firstMessage.id);
    }
    onLoadMore();
  }, [loading, reachedEnd, messages, onLoadMore]);

  const formatTimestamp = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, []);

  const formatDateHeader = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return 'Hôm nay';
    } else if (isYesterday) {
      return 'Hôm qua';
    } else {
      const sameYear = date.getFullYear() === today.getFullYear();
      if (sameYear) {
        return date.toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' });
      } else {
        return date.toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', year: 'numeric' });
      }
    }
  }, []);

  const shouldShowDateHeader = useCallback((index: number) => {
    if (index === 0) return true;
    if (index >= messages.length) return false;

    const current = new Date(messages[index].createdAt);
    const previous = new Date(messages[index - 1].createdAt);

    const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    const previousDay = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate());

    return currentDay.getTime() !== previousDay.getTime();
  }, [messages]);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const showTime = showTimeFor.has(item.id);
      const isFirst = index === 0;
      const shouldLoadMore = isFirst && !reachedEnd && !loading && didPerformInitialLoad && !atBottom;
      const showDateHeader = shouldShowDateHeader(index);

      return (
        <View>
          {showDateHeader && (
            <View style={styles.dateHeaderContainer}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{formatDateHeader(item.createdAt)}</Text>
              </View>
            </View>
          )}
          {shouldLoadMore && (
            <View style={styles.loadMoreTrigger}>
              <TouchableOpacity onPress={handleLoadMore} disabled={loading}>
                <Text style={styles.loadMoreText}>{loading ? 'Đang tải...' : 'Tải thêm'}</Text>
              </TouchableOpacity>
            </View>
          )}
          {isFirst && reachedEnd && (
            <View style={styles.endMarker}>
              <Text style={styles.endText}>Hết cuộc trò chuyện</Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              if (item.kind.type === 'media') {
                // TODO: Handle media tap
              } else {
                toggleTimestamp(item.id);
              }
            }}
            onLongPress={() => {
              Alert.alert(
                'Tùy chọn',
                '',
                [
                  { text: 'Sao chép', onPress: () => handleCopy(item) },
                  { text: 'Chia sẻ', onPress: () => handleShare(item) },
                  { text: 'Báo cáo', style: 'destructive', onPress: () => handleReport(item) },
                  { text: 'Hủy', style: 'cancel' },
                ]
              );
            }}
          >
            <Animated.View
              style={[
                styles.messageContainer,
                styles.agentContainer, // Use agentContainer style (left align) for all
              ]}
            >
              <ChatMessageBubble message={item} alignLeft={true} />
              {showTime && (
                <Animated.View
                  style={[
                    styles.timestampContainer,
                    {
                      opacity: showTime ? 1 : 0,
                    },
                  ]}
                >
                  <Text style={[styles.timestamp, item.isAgent ? styles.timestampLeft : styles.timestampRight]}>
                    {formatTimestamp(item.createdAt)}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </Pressable>
        </View>
      );
    },
    [
      showTimeFor,
      reachedEnd,
      loading,
      didPerformInitialLoad,
      atBottom,
      shouldShowDateHeader,
      formatDateHeader,
      formatTimestamp,
      handleLoadMore,
      toggleTimestamp,
      handleCopy,
      handleShare,
      handleReport,
      messages,
    ]
  );

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
    setAtBottom(isAtBottom);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateX: dragYAnim }],
            opacity: opacityAnim,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Lịch sử chat</Text>
              <Button variant="ghost" startIconName="close-outline" onPress={onClose} />
            </View>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.list}
              inverted={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollToIndexFailed={info => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
              }}
              onEndReachedThreshold={0.1}
              onEndReached={() => setAtBottom(true)}
              onScrollBeginDrag={() => setAtBottom(false)}
              ListFooterComponent={
                isTyping ? (
                  <View style={styles.typingContainer}>
                    <TypingIndicator />
                  </View>
                ) : null
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateHeader: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dateHeaderText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  agentContainer: {
    alignSelf: 'flex-start',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  timestampContainer: {
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  timestampLeft: {
    textAlign: 'left',
  },
  timestampRight: {
    textAlign: 'left',
  },
  loadMoreTrigger: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 14,
  },
  endMarker: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  endText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  typingContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
});
