'use server';

import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// Type definitions
export type Tag = InferSelectModel<typeof tags>;

export type TagsByCategory = {
    category: string;
    tags: Tag[];
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
