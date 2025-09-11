import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, deleteDoc, updateDoc, increment, setDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class VoteService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  async toggleVote(storyId: string): Promise<void> {
    
    const user = this.auth.currentUser;
    if (!user) {
      console.error('❌ User not authenticated');
      throw new Error('Not authenticated');
    }
    

    const voteRef = doc(this.firestore, `stories/${storyId}/votes/${user.uid}`);
    
    try {
      const voteSnap = await getDoc(voteRef);
      const storyRef = doc(this.firestore, `stories/${storyId}`);

      if (voteSnap.exists()) {
        await deleteDoc(voteRef);
        await updateDoc(storyRef, { 
          'stats.voteCount': increment(-1) 
        });
      } else {
        const voteData = {
          storyId,
          userId: user.uid,
          createdAt: new Date()
        };
        
        await setDoc(voteRef, voteData);
        await updateDoc(storyRef, { 
          'stats.voteCount': increment(1) 
        });
      }
    } catch (error) {
      console.error('❌ Error in toggleVote:', error);
      
      // Additional debugging info
 
      
      throw error;
    }
  }

  async hasVoted(storyId: string): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user) {
      return false;
    }

    try {
      const voteRef = doc(this.firestore, `stories/${storyId}/votes/${user.uid}`);
      const voteSnap = await getDoc(voteRef);
      const hasVoted = voteSnap.exists();
      return hasVoted;
    } catch (error) {
      console.error('❌ Error checking vote status:', error);
      return false;
    }
  }

  async countVotes(storyId: string): Promise<number> {
    try {
      const storyRef = doc(this.firestore, `stories/${storyId}`);
      const storySnap = await getDoc(storyRef);

      if (storySnap.exists()) {
        const data = storySnap.data();
        const count = data?.['stats']?.voteCount ?? 0;
        return count;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Error counting votes:', error);
      return 0;
    }
  }

  // Method to test authentication and permissions
  async testPermissions(storyId: string): Promise<void> {
    
    const user = this.auth.currentUser;
    if (!user) {
      return;
    }

    // Test read access to votes collection
    try {
      const voteRef = doc(this.firestore, `stories/${storyId}/votes/${user.uid}`);
      const voteSnap = await getDoc(voteRef);
    } catch (error) {
      console.error('❌ Cannot read vote document:', error);
    }

    // Test read access to story
    try {
      const storyRef = doc(this.firestore, `stories/${storyId}`);
      const storySnap = await getDoc(storyRef);
    } catch (error) {
      console.error('❌ Cannot read story document:', error);
    }
  }
}