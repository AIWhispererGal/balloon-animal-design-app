import { pgTable, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const balloonDesigns = pgTable("balloon_designs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'animals' | 'objects' | 'wearables' | 'nature' | 'fantasy' | 'characters'
  sourceType: text("source_type").default("preset"), // 'preset' | 'prompt' | 'image' | 'scratch'
  sourcePrompt: text("source_prompt"),
  complexity: text("complexity").notNull(), // 'beginner' | 'intermediate' | 'advanced'
  bubbleCount: integer("bubble_count").notNull().default(0),
  balloonCount: integer("balloon_count").notNull().default(1),
  balloons: jsonb("balloons").notNull(), // BalloonSpec[]
  bubbles: jsonb("bubbles").notNull(), // BubbleSpec[]
  steps: jsonb("steps").notNull(), // StepSpec[]
  annotations: jsonb("annotations").default([]), // string[] or AnnotationSpec[]
  thumbnailData: text("thumbnail_data"),
  isPreset: boolean("is_preset").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const userProjects = pgTable("user_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  designData: jsonb("design_data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BalloonDesign = typeof balloonDesigns.$inferSelect;
export type NewBalloonDesign = typeof balloonDesigns.$inferInsert;
export type UserProject = typeof userProjects.$inferSelect;
export type NewUserProject = typeof userProjects.$inferInsert;
