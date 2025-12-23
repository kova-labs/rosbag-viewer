'use server';

import { db } from '@/lib/db';
import { topics, frames, poseData } from '@/lib/db/schema';
import { eq, desc, asc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// Type definitions
export type Topic = InferSelectModel<typeof topics>;

export type Frame = InferSelectModel<typeof frames>;

export type FrameWithPagination = {
    frames: Frame[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
};

export type PoseData = InferSelectModel<typeof poseData>;

/**
 * Fetch topics for a specific bag
 */
export async function getTopicsByBagId(bagId: number): Promise<Topic[]> {
    try {
        const bagTopics = await db
            .select()
            .from(topics)
            .where(eq(topics.bagId, bagId))
            .orderBy(topics.name);

        return bagTopics;
    } catch (error) {
        console.error(`Error fetching topics for bag ${bagId}:`, error);
        throw new Error(`Failed to fetch topics for bag ${bagId}`);
    }
}

/**
 * Fetch frames for a topic with pagination
 */
export async function getFramesByTopicId(
    topicId: number,
    page: number = 1,
    pageSize: number = 50
): Promise<FrameWithPagination> {
    try {
        if (page < 1) {
            page = 1;
        }
        if (pageSize < 1 || pageSize > 100) {
            pageSize = 50;
        }

        const offset = (page - 1) * pageSize;

        // Fetch total count
        const totalFrames = await db
            .select({ count: count() })
            .from(frames)
            .where(eq(frames.topicId, topicId));

        const total = totalFrames[0]?.count ?? 0;

        // Fetch paginated frames
        const topicFrames = await db
            .select()
            .from(frames)
            .where(eq(frames.topicId, topicId))
            .orderBy(asc(frames.timestamp), asc(frames.sequenceNumber))
            .limit(pageSize)
            .offset(offset);

        const hasMore = offset + topicFrames.length < total;

        return {
            frames: topicFrames,
            total,
            page,
            pageSize,
            hasMore,
        };
    } catch (error) {
        console.error(`Error fetching frames for topic ${topicId}:`, error);
        throw new Error(`Failed to fetch frames for topic ${topicId}`);
    }
}

/**
 * Fetch all pose data for a bag's trajectory
 */
export async function getPoseDataByBagId(bagId: number): Promise<PoseData[]> {
    try {
        const bagPoseData = await db
            .select()
            .from(poseData)
            .where(eq(poseData.bagId, bagId))
            .orderBy(asc(poseData.timestamp));

        return bagPoseData;
    } catch (error) {
        console.error(`Error fetching pose data for bag ${bagId}:`, error);
        throw new Error(`Failed to fetch pose data for bag ${bagId}`);
    }
}
