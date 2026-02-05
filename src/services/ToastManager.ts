// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// MARK: - Toast Types
export enum ToastType {
  XP = 'xp',
  BP = 'bp',
  RELATIONSHIP = 'relationship',
  VCOIN = 'vcoin',
  RUBY = 'ruby',
  ENERGY = 'energy',
  QUEST = 'quest',
  LEVEL_UP = 'levelUp',
  ITEM = 'item',
  CUSTOM = 'custom',
}

export enum CurrencyKind {
  VCOIN = 'vcoin',
  RUBY = 'ruby',
}

// MARK: - Toast Message
export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  subtitle?: string;
  amount?: number;
  icon?: string;
  iconURL?: string;
  duration?: number;
  createdAt: Date;
  progress?: number; // Progress percentage (0.0 to 1.0)
  target?: number; // Target value for progress bar
}

type ToastListener = (toasts: ToastMessage[]) => void;

// MARK: - Toast Manager
class ToastManager {
  private static instance: ToastManager;
  private toasts: ToastMessage[] = [];
  private listeners: Set<ToastListener> = new Set();
  private dismissalTimers: Map<string, NodeJS.Timeout> = new Map();
  private toastQueue: ToastMessage[] = [];
  private displayStartTimes: Map<string, Date> = new Map();
  private isShowingToast: boolean = false;
  private readonly defaultDuration: number = 1800; // 1.8 seconds in ms
  private readonly minDuration: number = 200; // 0.2 seconds in ms

  private constructor() {}

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  // Subscribe to toast changes
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  show(toast: ToastMessage) {
    // If no toast is currently showing, show immediately
    if (!this.isShowingToast && this.toasts.length === 0) {
      this.isShowingToast = true;
      this.toasts.push(toast);
      this.displayStartTimes.set(toast.id, new Date());
      this.scheduleRemoval(toast, this.toastQueue.length);
      this.notifyListeners();
    } else {
      // Queue the toast
      this.toastQueue.push(toast);
      this.accelerateCurrentToastIfNeeded();
    }
  }

  showToast(
    type: ToastType,
    title: string,
    subtitle?: string,
    amount?: number,
    icon?: string,
    iconURL?: string,
    duration?: number
  ) {
    const toast: ToastMessage = {
      id: generateId(),
      type,
      title,
      subtitle,
      amount,
      icon,
      iconURL,
      duration,
      createdAt: new Date(),
    };
    this.show(toast);
  }

  showCurrencyToast(currency: CurrencyKind, amount: number) {
    const icon = currency === CurrencyKind.VCOIN ? 'cash' : 'diamond';
    const title = `+${amount} ${currency === CurrencyKind.VCOIN ? 'VCoin' : 'Ruby'}`;
    this.showToast(
      currency === CurrencyKind.VCOIN ? ToastType.VCOIN : ToastType.RUBY,
      title,
      undefined,
      amount,
      icon
    );
  }

  showXPToast(amount: number) {
    this.showToast(ToastType.XP, `+${amount} XP`, undefined, amount, 'sparkles');
  }

  showBPToast(amount: number) {
    this.showToast(ToastType.BP, `+${amount} BP`, undefined, amount, 'star');
  }

  showRelationshipToast(amount: number) {
    this.showToast(
      ToastType.RELATIONSHIP,
      `+${amount} Relationship`,
      undefined,
      amount,
      'heart'
    );
  }

  // MARK: - Quest Progress Toast
  showQuestProgress(
    title: string,
    progress: number,
    target: number,
    isCompleted: boolean = false,
    duration?: number
  ) {
    const progressPercent = Math.min(progress / target, 1.0);
    const toast: ToastMessage = {
      id: generateId(),
      type: isCompleted ? ToastType.QUEST : ToastType.CUSTOM,
      title,
      subtitle: undefined,
      amount: progress,
      icon: isCompleted ? 'checkmark-circle' : 'disc',
      duration: duration ?? (isCompleted ? 3000 : 2500),
      createdAt: new Date(),
      progress: progressPercent,
      target,
    };
    this.show(toast);
  }

  showDailyQuestProgress(
    title: string,
    progress: number,
    target: number,
    isCompleted: boolean = false
  ) {
    this.showQuestProgress(title, progress, target, isCompleted);
  }

  showLevelQuestProgress(
    title: string,
    progress: number,
    target: number,
    isCompleted: boolean = false
  ) {
    this.showQuestProgress(title, progress, target, isCompleted);
  }

  dismiss(id: string) {
    const timer = this.dismissalTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissalTimers.delete(id);
    }
    this.displayStartTimes.delete(id);
    this.toasts = this.toasts.filter(t => t.id !== id);

    // Mark as not showing when toast is fully dismissed
    if (this.toasts.length === 0) {
      this.isShowingToast = false;
      // Process queue after a small delay to allow dismissal animation
      const backlog = this.toastQueue.length;
      const delay = backlog >= 6 ? 20 : backlog >= 3 ? 50 : 100;
      setTimeout(() => {
        this.processQueue();
      }, delay);
    }
    this.notifyListeners();
  }

  clear() {
    this.dismissalTimers.forEach(timer => clearTimeout(timer));
    this.dismissalTimers.clear();
    this.toasts = [];
    this.toastQueue = [];
    this.displayStartTimes.clear();
    this.isShowingToast = false;
    this.notifyListeners();
  }

  private scheduleRemoval(toast: ToastMessage, backlog: number) {
    const adjustedDuration = this.adjustedDuration(
      toast.duration ?? this.defaultDuration,
      backlog
    );
    this.scheduleRemovalWithDuration(toast, adjustedDuration);
  }

  private scheduleRemovalWithDuration(toast: ToastMessage, duration: number) {
    const cappedDuration = Math.max(this.minDuration, duration);
    const timer = setTimeout(() => {
      this.dismiss(toast.id);
    }, cappedDuration);
    this.dismissalTimers.set(toast.id, timer);
  }

  private processQueue() {
    // Only process if we're not currently showing a toast and queue has items
    if (this.isShowingToast || this.toasts.length > 0 || this.toastQueue.length === 0) {
      return;
    }

    // Get the next toast from queue
    const nextToast = this.toastQueue.shift();
    if (!nextToast) return;

    this.isShowingToast = true;
    this.toasts.push(nextToast);
    this.displayStartTimes.set(nextToast.id, new Date());
    this.scheduleRemoval(nextToast, this.toastQueue.length);
    this.notifyListeners();
  }

  private adjustedDuration(base: number, backlog: number): number {
    let multiplier: number;
    if (backlog >= 8) {
      multiplier = 0.35;
    } else if (backlog >= 5) {
      multiplier = 0.5;
    } else if (backlog >= 3) {
      multiplier = 0.7;
    } else {
      multiplier = 1.0;
    }
    return base * multiplier;
  }

  private accelerateCurrentToastIfNeeded() {
    if (this.toasts.length === 0) return;
    const current = this.toasts[0];
    const backlog = this.toastQueue.length;
    if (backlog < 3) return;

    const startTime = this.displayStartTimes.get(current.id);
    if (!startTime) return;

    const baseDuration = current.duration ?? this.defaultDuration;
    const targetDuration = Math.max(
      this.minDuration,
      this.adjustedDuration(baseDuration, backlog)
    );
    const elapsed = Date.now() - startTime.getTime();
    const remaining = Math.max(120, targetDuration - elapsed);

    // Cancel current scheduled dismissal and reschedule with shorter remaining time
    const timer = this.dismissalTimers.get(current.id);
    if (timer) {
      clearTimeout(timer);
    }
    this.scheduleRemovalWithDuration(current, remaining);
  }

  getToasts(): ToastMessage[] {
    return [...this.toasts];
  }
}

export const toastManager = ToastManager.getInstance();

