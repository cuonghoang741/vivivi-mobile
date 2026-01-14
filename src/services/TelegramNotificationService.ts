/**
 * TelegramNotificationService - Service for sending notifications to Telegram
 * Events: New User, Chat Message, Purchase Item, Subscription
 */

const TELEGRAM_BOT_TOKEN = '7450216881:AAEfiWq4TGQ371gixL2oVKBepBH3BTAfDUA';
const TELEGRAM_CHAT_ID = '-1003509600397';
const TELEGRAM_MESSAGE_THREAD_ID = '686';

interface UserInfo {
  userId: string;
  userName: string;
  userCountry: string;
  userAge: string; // Time since user started using the app
}

type NotificationType = 'new_user' | 'chat_message' | 'purchase_item' | 'subscription';

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
  private async sendToTelegram(message: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          message_thread_id: TELEGRAM_MESSAGE_THREAD_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[TelegramNotificationService] Failed to send message:', errorData);
      } else {
        console.log('[TelegramNotificationService] Message sent successfully');
      }
    } catch (error) {
      console.error('[TelegramNotificationService] Error sending message:', error);
    }
  }

  /**
   * Format user info for message
   */
  private formatUserInfo(userInfo: UserInfo): string {
    return `User ID: ${userInfo.userId}
User Name: ${userInfo.userName}
User Country: ${userInfo.userCountry}
User Age: ${userInfo.userAge}`;
  }

  /**
   * Get notification title based on type
   */
  private getNotificationTitle(type: NotificationType): string {
    switch (type) {
      case 'new_user':
        return 'NEW USER REGISTERED';
      case 'chat_message':
        return 'USER CHAT MESSAGE';
      case 'purchase_item':
        return 'USER PURCHASED ITEM';
      case 'subscription':
        return 'USER SUBSCRIBED';
      default:
        return 'NOTIFICATION';
    }
  }

  /**
   * Send notification for various events
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    const title = this.getNotificationTitle(payload.type);
    const userInfo = this.formatUserInfo({
      userId: payload.userId,
      userName: payload.userName,
      userCountry: payload.userCountry,
      userAge: payload.userAge,
    });

    let message = `<b>${title}</b>\n\n${userInfo}`;

    // Add additional data if available
    if (payload.additionalData) {
      const additionalInfo = Object.entries(payload.additionalData)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      message += `\n\n${additionalInfo}`;
    }

    await this.sendToTelegram(message);
  }

  /**
   * Notify when a new user registers
   */
  async notifyNewUser(userInfo: UserInfo): Promise<void> {
    await this.sendNotification({
      ...userInfo,
      type: 'new_user',
    });
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
        'Message': messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
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
    await this.sendNotification({
      ...userInfo,
      type: 'subscription',
      additionalData: {
        'Plan': planName,
        'Product ID': productId,
      },
    });
  }
}

export const telegramNotificationService = TelegramNotificationService.getInstance();
