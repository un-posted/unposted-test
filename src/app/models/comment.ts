// models/comment.model.ts
export interface Comment {
  id: string;
  storyId: string;
  userId: string;
  username: string;
  userPhotoURL: string;
  status: 'active' | 'deleted';
  content: string;
  createdAt: Date;
}
