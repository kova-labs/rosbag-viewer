'use server';

import { db } from '@/lib/db';
import { tags, bagTags } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// Type definitions
export type Tag = InferSelectModel<typeof tags>;

export type TagWithCount = Tag & {
    bagCount: number;
};

export type TagsByCategory = {
    category: string;
    tags: Tag[];
};

export type TagsByCategoryWithCounts = {
    category: string;
    tags: TagWithCount[];
};

/**
 * Fetch all tags grouped by category
 */
export async function getAllTags(): Promise<TagsByCategory[]> {
    try {
        const allTags = await db
            .select()
            .from(tags)
            .orderBy(tags.category, tags.name);

        // Group tags by category
        const tagsByCategory = allTags.reduce((acc, tag) => {
            const existingCategory = acc.find((item) => item.category === tag.category);
            if (existingCategory) {
                existingCategory.tags.push(tag);
            } else {
                acc.push({
                    category: tag.category,
                    tags: [tag],
                });
            }
            return acc;
        }, [] as TagsByCategory[]);

        return tagsByCategory;
    } catch (error) {
        console.error('Error fetching all tags:', error);
        throw new Error('Failed to fetch tags');
    }
}

/**
 * Get tags for a specific category
 */
export async function getTagsByCategory(category: string): Promise<Tag[]> {
    try {
        const categoryTags = await db
            .select()
            .from(tags)
            .where(eq(tags.category, category))
            .orderBy(tags.name);

        return categoryTags;
    } catch (error) {
        console.error(`Error fetching tags for category ${category}:`, error);
        throw new Error(`Failed to fetch tags for category ${category}`);
    }
}

/**
 * Fetch all tags grouped by category with bag counts
 */
export async function getAllTagsWithCounts(): Promise<TagsByCategoryWithCounts[]> {
    try {
        // Get all tags with their bag counts
        const tagsWithCounts = await db
            .select({
                id: tags.id,
                name: tags.name,
                category: tags.category,
                color: tags.color,
                bagCount: sql<number>`count(${bagTags.bagId})::int`,
            })
            .from(tags)
            .leftJoin(bagTags, eq(tags.id, bagTags.tagId))
            .groupBy(tags.id, tags.name, tags.category, tags.color)
            .orderBy(tags.category, tags.name);

        // Group by category
        const tagsByCategory = tagsWithCounts.reduce((acc, tag) => {
            const existingCategory = acc.find((item) => item.category === tag.category);
            if (existingCategory) {
                existingCategory.tags.push({
                    id: tag.id,
                    name: tag.name,
                    category: tag.category,
                    color: tag.color,
                    bagCount: tag.bagCount,
                });
            } else {
                acc.push({
                    category: tag.category,
                    tags: [
                        {
                            id: tag.id,
                            name: tag.name,
                            category: tag.category,
                            color: tag.color,
                            bagCount: tag.bagCount,
                        },
                    ],
                });
            }
            return acc;
        }, [] as TagsByCategoryWithCounts[]);

        return tagsByCategory;
    } catch (error) {
        console.error('Error fetching tags with counts:', error);
        throw new Error('Failed to fetch tags with counts');
    }
}
