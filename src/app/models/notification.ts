export interface Notification {
  id: string;                // Firestore doc ID
  userId: string;            // Recipient of the notification
  type: 'like' | 'comment' | 'follow' | 'story_published' | 'level_up'; 
  title: string;             // Short title (ex: "New Like")
  message: string;           // User-facing message
  isRead: boolean;           // Mark as read/unread
  createdAt: any;            // Firestore timestamp

  data?: {
    storyId?: string;
    fromUserId?: string;
    fromUserName?: string;
    newLevel?: number;
    oldLevel?: number;
    levelGain?: number;
  };
}
