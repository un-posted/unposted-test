// models/bookmark.model.ts
export interface Bookmark {
  id: string;
  userId: string;
  storyId: string;
  title: string;
  authorName: string;
  emoji?: string;
  category: string;
  createdAt: Date;
}
