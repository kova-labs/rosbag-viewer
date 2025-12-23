'use server';

import { db } from '@/lib/db';
import { bags, bagTags, tags, topics, poseData } from '@/lib/db/schema';
import { eq, inArray, like, desc, asc, count, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// Type definitions
export type BagWithTags = InferSelectModel<typeof bags> & {
    tags: InferSelectModel<typeof tags>[];
};

export type BagWithRelations = InferSelectModel<typeof bags> & {
    tags: InferSelectModel<typeof tags>[];
    topics: (InferSelectModel<typeof topics>)[];
    poseData: (InferSelectModel<typeof poseData>)[];
};

/**
 * Fetch all bags with their tags
 */
export async function getBags(): Promise<BagWithTags[]> {
    try {
        const allBags = await db
            .select()
            .from(bags)
            .orderBy(desc(bags.createdAt));

        // Fetch tags for each bag
        const bagsWithTags = await Promise.all(
            allBags.map(async (bag) => {
                const bagTagRelations = await db
                    .select({
                        tag: tags,
                    })
                    .from(bagTags)
                    .innerJoin(tags, eq(bagTags.tagId, tags.id))
                    .where(eq(bagTags.bagId, bag.id));

                return {
                    ...bag,
                    tags: bagTagRelations.map((bt) => bt.tag),
                };
            })
        );

        return bagsWithTags;
    } catch (error) {
        console.error('Error fetching bags:', error);
        throw new Error('Failed to fetch bags');
    }
}

/**
 * Fetch a single bag with all relations (topics, tags, poseData)
 */
export async function getBagById(id: number): Promise<BagWithRelations | null> {
    try {
        const bag = await db
            .select()
            .from(bags)
            .where(eq(bags.id, id))
            .limit(1);

        if (!bag || bag.length === 0) {
            return null;
        }

        const bagData = bag[0];

        // Fetch tags
        const bagTagRelations = await db
            .select({
                tag: tags,
            })
            .from(bagTags)
            .innerJoin(tags, eq(bagTags.tagId, tags.id))
            .where(eq(bagTags.bagId, id));

        // Fetch topics
        const bagTopics = await db
            .select()
            .from(topics)
            .where(eq(topics.bagId, id))
            .orderBy(topics.name);

        // Fetch pose data
        const bagPoseData = await db
            .select()
            .from(poseData)
            .where(eq(poseData.bagId, id))
            .orderBy(asc(poseData.timestamp));

        return {
            ...bagData,
            tags: bagTagRelations.map((bt) => bt.tag),
            topics: bagTopics,
            poseData: bagPoseData,
        };
    } catch (error) {
        console.error(`Error fetching bag with id ${id}:`, error);
        throw new Error(`Failed to fetch bag with id ${id}`);
    }
}

/**
 * Assign tags to a bag
 */
export async function assignTagsToBag(bagId: number, tagIds: number[]): Promise<void> {
    try {
        if (tagIds.length === 0) {
            return;
        }

        // Remove existing tags for this bag
        await db.delete(bagTags).where(eq(bagTags.bagId, bagId));

        // Insert new tags
        if (tagIds.length > 0) {
            await db.insert(bagTags).values(
                tagIds.map((tagId) => ({
                    bagId,
                    tagId,
                }))
            );
        }
    } catch (error) {
        console.error(`Error assigning tags to bag ${bagId}:`, error);
        throw new Error(`Failed to assign tags to bag ${bagId}`);
    }
}

/**
 * Filter bags by multiple tags
 */
export async function getBagsByTags(tagIds: number[]): Promise<BagWithTags[]> {
    try {
        if (tagIds.length === 0) {
            return getBags();
        }

        // Find all bag IDs that have ALL the specified tags
        // Use a subquery to count distinct tags per bag and filter by count
        const bagIdsWithTags = await db
            .select({
                bagId: bagTags.bagId,
                tagCount: sql<number>`count(distinct ${bagTags.tagId})`,
            })
            .from(bagTags)
            .where(inArray(bagTags.tagId, tagIds))
            .groupBy(bagTags.bagId)
            .having(sql`count(distinct ${bagTags.tagId}) = ${tagIds.length}`);

        const bagIds = bagIdsWithTags
            .map((b) => b.bagId)
            .filter((id): id is number => id !== null);

        if (bagIds.length === 0) {
            return [];
        }

        // Fetch bags
        const filteredBags = await db
            .select()
            .from(bags)
            .where(inArray(bags.id, bagIds))
            .orderBy(desc(bags.createdAt));

        // Fetch tags for each bag
        const bagsWithTags = await Promise.all(
            filteredBags.map(async (bag) => {
                const bagTagRelations = await db
                    .select({
                        tag: tags,
                    })
                    .from(bagTags)
                    .innerJoin(tags, eq(bagTags.tagId, tags.id))
                    .where(eq(bagTags.bagId, bag.id));

                return {
                    ...bag,
                    tags: bagTagRelations.map((bt) => bt.tag),
                };
            })
        );

        return bagsWithTags;
    } catch (error) {
        console.error('Error fetching bags by tags:', error);
        throw new Error('Failed to fetch bags by tags');
    }
}

/**
 * Text search on filename
 */
export async function searchBags(query: string): Promise<BagWithTags[]> {
    try {
        if (!query || query.trim().length === 0) {
            return getBags();
        }

        const searchPattern = `%${query.trim()}%`;

        const matchingBags = await db
            .select()
            .from(bags)
            .where(like(bags.filename, searchPattern))
            .orderBy(desc(bags.createdAt));

        // Fetch tags for each bag
        const bagsWithTags = await Promise.all(
            matchingBags.map(async (bag) => {
                const bagTagRelations = await db
                    .select({
                        tag: tags,
                    })
                    .from(bagTags)
                    .innerJoin(tags, eq(bagTags.tagId, tags.id))
                    .where(eq(bagTags.bagId, bag.id));

                return {
                    ...bag,
                    tags: bagTagRelations.map((bt) => bt.tag),
                };
            })
        );

        return bagsWithTags;
    } catch (error) {
        console.error('Error searching bags:', error);
        throw new Error('Failed to search bags');
    }
}
