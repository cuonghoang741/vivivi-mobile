/**
 * TelegramNotificationService - Service for sending notifications to Telegram
 * Events: New User, Chat Message, Purchase Item, Subscription
 */

const TELEGRAM_BOT_TOKEN = '8014102522:AAG5vWRg3UGi7phtyQmoEWygwSOcDrak9vs';
const TELEGRAM_CHAT_ID = '-5289533975';
const TELEGRAM_MESSAGE_THREAD_ID = '1';

interface UserInfo {
  userId: string;
  userName: string;
  userCountry: string;
  userAge: string; // Time since user started using the app
  isPro?: boolean;
}

type NotificationType = 'new_user' | 'chat_message' | 'purchase_item' | 'subscription' | 'ai_response';

interface NotificationPayload extends UserInfo {
  type: NotificationType;
  additionalData?: Record<string, any>;
}

class TelegramNotificationService {
  private static instance: TelegramNotificationService;

  private constructor() { }

  static getInstance(): TelegramNotificationService {
    if (!TelegramNotificationService.instance) {
      TelegramNotificationService.instance = new TelegramNotificationService();
    }
    return TelegramNotificationService.instance;
  }

  /**
   * Send a notification to Telegram
   */
  private async sendToTelegram(message: string): Promise<number | null> {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          // message_thread_id: TELEGRAM_MESSAGE_THREAD_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[TelegramNotificationService] Failed to send message:', errorData);
        return null;
      } else {
        const data = await response.json();
        console.log('[TelegramNotificationService] Message sent successfully');
        return data.result?.message_id || null;
      }
    } catch (error) {
      console.error('[TelegramNotificationService] Error sending message:', error);
      return null;
    }
  }

  /**
   * Pin a message in Telegram
   */
  private async pinMessage(messageId: number): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/pinChatMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          message_id: messageId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[TelegramNotificationService] Failed to pin message:', errorData);
      } else {
        console.log('[TelegramNotificationService] Message pinned successfully');
      }
    } catch (error) {
      console.error('[TelegramNotificationService] Error pinning message:', error);
    }
  }

  /**
   * Format user info for message
   */
  private formatUserInfo(userInfo: UserInfo): string {
    return `User ID: ${userInfo.userId}
User Name: ${userInfo.userName}${userInfo.isPro ? ' <b>[ PRO 🌟 ]</b>' : ''}
User Country: ${userInfo.userCountry}
User Age: ${userInfo.userAge}`;
  }

  /**
   * Get notification title based on type
   */
  private getNotificationTitle(type: NotificationType): string {
    switch (type) {
      case 'new_user':
        return '🆕 NEW USER REGISTERED';
      case 'chat_message':
        return '👤 USER';
      case 'ai_response':
        return '🤖 AI';
      case 'purchase_item':
        return '🛍️ USER PURCHASED ITEM';
      case 'subscription':
        return '💎 USER SUBSCRIBED';
      default:
        return '🔔 NOTIFICATION';
    }
  }

  /**
   * Send notification for various events
   */
  async sendNotification(payload: NotificationPayload): Promise<number | null> {
    // Skip notification for users from Vietnam
    if (payload.userCountry?.toUpperCase() === 'VN' && (payload.type === 'chat_message' || payload.type === 'ai_response')) {
      console.log('[TelegramNotificationService] Skipping chat notification for VN user');
      return null;
    }

    const title = this.getNotificationTitle(payload.type);
    const userInfo = this.formatUserInfo({
      userId: payload.userId,
      userName: payload.userName,
      userCountry: payload.userCountry,
      userAge: payload.userAge,
      isPro: payload.isPro,
    });

    let message = `<b>${title}</b>\n\n${userInfo}`;

    // Add additional data if available
    if (payload.additionalData) {
      const additionalInfo = Object.entries(payload.additionalData)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      message += `\n\n${additionalInfo}`;
    }

    return await this.sendToTelegram(message);
  }

  /**
   * Notify when a new user registers
   */
  async notifyNewUser(userInfo: UserInfo): Promise<void> {
    const messageId = await this.sendNotification({
      ...userInfo,
      type: 'new_user',
    });

    if (messageId) {
      await this.pinMessage(messageId);
    }
  }

  /**
   * Notify when a user sends a chat message
   */
  async notifyChatMessage(userInfo: UserInfo, characterName: string, messagePreview: string): Promise<void> {
    await this.sendNotification({
      ...userInfo,
      type: 'chat_message',
      additionalData: {
        'Character': characterName,
        '👤 Message': messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
      },
    });
  }

  /**
   * Notify when AI responses
   */
  async notifyAIResponse(userInfo: UserInfo, characterName: string, responseMessage: string): Promise<void> {
    await this.sendNotification({
      ...userInfo,
      type: 'ai_response',
      additionalData: {
        'Character': characterName,
        '🤖 Response': responseMessage.substring(0, 100) + (responseMessage.length > 100 ? '...' : ''),
      },
    });
  }

  /**
   * Notify when a user purchases an item
   */
  async notifyPurchaseItem(
    userInfo: UserInfo,
    itemId: string,
    itemType: string,
    vcoinSpent: number,
    rubySpent: number
  ): Promise<void> {
    await this.sendNotification({
      ...userInfo,
      type: 'purchase_item',
      additionalData: {
        'Item ID': itemId,
        'Item Type': itemType,
        'VCoin Spent': vcoinSpent,
        'Ruby Spent': rubySpent,
      },
    });
  }

  /**
   * Notify when a user subscribes
   */
  async notifySubscription(
    userInfo: UserInfo,
    planName: string,
    productId: string
  ): Promise<void> {
    const messageId = await this.sendNotification({
      ...userInfo,
      type: 'subscription',
      additionalData: {
        'Plan': planName,
        'Product ID': productId,
      },
    });

    if (messageId) {
      await this.pinMessage(messageId);
    }
  }
}

export const telegramNotificationService = TelegramNotificationService.getInstance();
