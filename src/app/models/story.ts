// models/story.model.ts
export interface Story {
  id: string;
  title: string;
  emoji?: string;
  content: string;
  category: string;
  tags: string[];
  coverImg?: string;
  status: 'draft' | 'published';
  language: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  createdAt: Date | any;
  updatedAt: Date;
  stats: {
    readTime: number; // estimated minutes
    wordCount: number;
    readCount: number;
    voteCount: number;
    commentCount: number;
  };
}
