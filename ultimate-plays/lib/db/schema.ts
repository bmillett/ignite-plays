import {
  pgTable,
  serial,
  text,
  integer,
  json,
  timestamp,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

// Key-value settings table (e.g. hashed passwords)
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const roleEnum = pgEnum("role", ["member", "editor", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const plays = pgTable("plays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdByEmail: text("created_by_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// positions shape: { offense: [{x,y,label}×7], defense: [{x,y,label}×7], disc: {x,y} }
export const playSteps = pgTable("play_steps", {
  id: serial("id").primaryKey(),
  playId: integer("play_id")
    .notNull()
    .references(() => plays.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  positions: json("positions").notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const playTags = pgTable(
  "play_tags",
  {
    playId: integer("play_id")
      .notNull()
      .references(() => plays.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.playId, t.tagId] })]
);
