// models/vote.model.ts
export interface Vote {
  id: string;
  storyId: string;
  userId: string;
  createdAt: Date;
}
