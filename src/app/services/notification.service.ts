import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  writeBatch,
  Timestamp,
  limit
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../models';


@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  
  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();
  
  private unsubscribe?: () => void;

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {
    // Start listening when user logs in
    this.authService.user$.subscribe(user => {
      if (user) {
        this.startListening(user.uid);
      } else {
        this.stopListening();
      }
    });
  }

  /**
   * Start real-time listening for notifications
   */
  private startListening(userId: string): void {
    const notificationsRef = collection(this.firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to latest 50 notifications
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: Notification[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          userId: data['userId'],
          type: data['type'],
          title: data['title'],
          message: data['message'],
          isRead: data['isRead'],
          createdAt: data['createdAt']?.toDate() || new Date(),
          data: data['data'] || {}
        });
      });

      this.notificationsSubject.next(notifications);
      
      // Update unread count
      const unreadCount = notifications.filter(n => !n.isRead).length;
      this.unreadCountSubject.next(unreadCount);
      
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });
  }

  /**
   * Stop listening for notifications
   */
  private stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  /**
   * Create a new notification
   */
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<void> {
    try {
      const notificationsRef = collection(this.firestore, 'notifications');
      await addDoc(notificationsRef, {
        ...notification,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Mark a specific notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(this.firestore, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(): Promise<void> {
    const user = await this.authService.user;
    if (!user) return;

    try {
      const notifications = this.notificationsSubject.value;
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(this.firestore);
      
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(this.firestore, 'notifications', notification.id);
        batch.update(notificationRef, { isRead: true });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Helper methods for creating specific types of notifications
   */
  async notifyStoryLiked(storyOwnerId: string, likerName: string, storyTitle: string, storyId: string): Promise<void> {
    if (!storyOwnerId) return;
    
    await this.createNotification({
      userId: storyOwnerId,
      type: 'like',
      title: 'New like on your story',
      message: `${likerName} liked your story "${storyTitle}"`,
      isRead: false,
      data: {
        storyId,
        fromUserName: likerName
      }
    });
  }

  async notifyStoryCommented(storyOwnerId: string, commenterName: string, storyTitle: string, storyId: string): Promise<void> {
    if (!storyOwnerId) return;
    
    await this.createNotification({
      userId: storyOwnerId,
      type: 'comment',
      title: 'New comment on your story',
      message: `${commenterName} commented on your story "${storyTitle}"`,
      isRead: false,
      data: {
        storyId,
        fromUserName: commenterName
      }
    });
  }

  async notifyNewFollower(followedUserId: string, followerName: string | any, followerId: string): Promise<void> {
    if (!followedUserId) return;
    
    await this.createNotification({
      userId: followedUserId,
      type: 'follow',
      title: 'New follower',
      message: `${followerName} started following you`,
      isRead: false,
      data: {
        fromUserId: followerId,
        fromUserName: followerName
      }
    });
  }

  async notifyStoryPublished(authorId: string, storyTitle: string | any, storyId: string): Promise<void> {
    if (!authorId) return;
    
    await this.createNotification({
      userId: authorId,
      type: 'story_published',
      title: 'Story published successfully',
      message: `Your story "${storyTitle}" has been published and is now live!`,
      isRead: false,
      data: {
        storyId
      }
    });
  }



  async notifyLevelUp(userId: string, newLevel: number, oldLevel: number): Promise<void> {
  if (!userId) return;
  
  const levelGain = newLevel - oldLevel;
  const message = levelGain === 1 
    ? `Congratulations! You've reached level ${newLevel}!`
    : `Amazing! You jumped ${levelGain} levels and reached level ${newLevel}!`;
  
  await this.createNotification({
    userId: userId,
    type: 'level_up',
    title: 'Level Up!',
    message: message,
    isRead: false,
    data: {
      newLevel,
      oldLevel,
      levelGain
    }
  });
}
  /**
   * Get current notifications (synchronous)
   */
  getCurrentNotifications(): Notification[] {
    return this.notificationsSubject.value;
  }

  /**
   * Get current unread count (synchronous)
   */
  getCurrentUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    this.stopListening();
  }
}