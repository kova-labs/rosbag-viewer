import { pgTable, serial, text, integer, timestamp, boolean, real, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const bags = pgTable('bags', {
    id: serial('id').primaryKey(),
    filename: text('filename').notNull(),
    filepath: text('filepath').notNull(), // Path to .db3 file
    size: integer('size').notNull(), // File size in bytes
    duration: real('duration'), // Duration in seconds
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),
    messageCount: integer('message_count'),
    metadata: jsonb('metadata'), // Raw bag metadata
    createdAt: timestamp('created_at').defaultNow(),
    processed: boolean('processed').default(false),
});

export const tags = pgTable('tags', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(), // 'device', 'location', 'sensor'
    color: text('color'), // For UI
});

export const bagTags = pgTable('bag_tags', {
    bagId: integer('bag_id').references(() => bags.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
    pk: primaryKey({ columns: [table.bagId, table.tagId] }),
}));

export const topics = pgTable('topics', {
    id: serial('id').primaryKey(),
    bagId: integer('bag_id').references(() => bags.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    messageType: text('message_type').notNull(),
    messageCount: integer('message_count').notNull(),
    frequency: real('frequency'), // Hz
    coverImagePath: text('cover_image_path'), // Path to first frame
});

export const frames = pgTable('frames', {
    id: serial('id').primaryKey(),
    topicId: integer('topic_id').references(() => topics.id, { onDelete: 'cascade' }),
    timestamp: real('timestamp').notNull(), // ROS timestamp
    sequenceNumber: integer('sequence_number').notNull(),
    filePath: text('file_path').notNull(), // Path to JPEG
    width: integer('width'),
    height: integer('height'),
});

export const poseData = pgTable('pose_data', {
    id: serial('id').primaryKey(),
    bagId: integer('bag_id').references(() => bags.id, { onDelete: 'cascade' }),
    timestamp: real('timestamp').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull(),
    z: real('z').notNull(),
    qx: real('qx').notNull(), // Quaternion
    qy: real('qy').notNull(),
    qz: real('qz').notNull(),
    qw: real('qw').notNull(),
});

export const imuData = pgTable('imu_data', {
    id: serial('id').primaryKey(),
    bagId: integer('bag_id').references(() => bags.id, { onDelete: 'cascade' }),
    timestamp: real('timestamp').notNull(),
    angularVelocity: jsonb('angular_velocity'), // {x, y, z}
    linearAcceleration: jsonb('linear_acceleration'), // {x, y, z}
});

// Relations
export const bagsRelations = relations(bags, ({ many }) => ({
    bagTags: many(bagTags),
    topics: many(topics),
    poseData: many(poseData),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
    bagTags: many(bagTags),
}));

export const bagTagsRelations = relations(bagTags, ({ one }) => ({
    bag: one(bags, { fields: [bagTags.bagId], references: [bags.id] }),
    tag: one(tags, { fields: [bagTags.tagId], references: [tags.id] }),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
    bag: one(bags, { fields: [topics.bagId], references: [bags.id] }),
    frames: many(frames),
}));

export const framesRelations = relations(frames, ({ one }) => ({
    topic: one(topics, { fields: [frames.topicId], references: [topics.id] }),
}));

export const poseDataRelations = relations(poseData, ({ one }) => ({
    bag: one(bags, { fields: [poseData.bagId], references: [bags.id] }),
}));