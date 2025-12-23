'use client';

import { useState, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronRight, Filter } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAllTagsWithCounts, type TagsByCategoryWithCounts, type TagWithCount } from '@/app/actions/tags';
import { cn } from '@/lib/utils';

export interface FilterState {
    searchQuery: string;
    selectedTagIds: number[];
}

interface FilterSidebarProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    className?: string;
    isMobile?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    hideMobileButton?: boolean;
}

export function FilterSidebar({
    filters,
    onFiltersChange,
    className,
    isMobile = false,
    isOpen = false,
    onOpenChange,
    hideMobileButton = false,
}: FilterSidebarProps) {
    const [tagsByCategory, setTagsByCategory] = useState<TagsByCategoryWithCounts[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(['device', 'location', 'sensor'])
    );
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getAllTagsWithCounts()
            .then((data) => {
                setTagsByCategory(data);
                setIsLoading(false);
            })
            .catch((error) => {
                console.error('Failed to load tags:', error);
                setIsLoading(false);
            });
    }, []);

    const handleSearchChange = (value: string) => {
        onFiltersChange({
            ...filters,
            searchQuery: value,
        });
    };

    const handleTagToggle = (tagId: number) => {
        const newSelectedTagIds = filters.selectedTagIds.includes(tagId)
            ? filters.selectedTagIds.filter((id) => id !== tagId)
            : [...filters.selectedTagIds, tagId];

        onFiltersChange({
            ...filters,
            selectedTagIds: newSelectedTagIds,
        });
    };

    const handleClearFilters = () => {
        onFiltersChange({
            searchQuery: '',
            selectedTagIds: [],
        });
    };

    const toggleCategory = (category: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
        }
        setExpandedCategories(newExpanded);
    };

    const hasActiveFilters = filters.searchQuery.length > 0 || filters.selectedTagIds.length > 0;

    const content = (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search bags..."
                        value={filters.searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="w-full"
                >
                    <X className="mr-2 h-4 w-4" />
                    Clear all filters
                </Button>
            )}

            <Separator />

            {/* Tags by Category */}
            {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                    Loading tags...
                </div>
            ) : tagsByCategory.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                    No tags available
                </div>
            ) : (
                <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-4 pr-4">
                        {tagsByCategory.map((categoryData) => {
                            const isExpanded = expandedCategories.has(categoryData.category);
                            const categoryTags = categoryData.tags.filter((tag) => tag.bagCount > 0);

                            if (categoryTags.length === 0) return null;

                            return (
                                <div key={categoryData.category} className="space-y-2">
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(categoryData.category)}
                                        className="flex w-full items-center justify-between text-sm font-semibold text-foreground hover:text-primary transition-colors"
                                    >
                                        <span className="capitalize">
                                            {categoryData.category}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </button>

                                    {/* Category Tags */}
                                    {isExpanded && (
                                        <div className="space-y-2 pl-2">
                                            {categoryTags.map((tag) => (
                                                <label
                                                    key={tag.id}
                                                    className="flex items-center space-x-2 cursor-pointer group hover:text-primary transition-colors"
                                                >
                                                    <Checkbox
                                                        checked={filters.selectedTagIds.includes(
                                                            tag.id
                                                        )}
                                                        onCheckedChange={() =>
                                                            handleTagToggle(tag.id)
                                                        }
                                                    />
                                                    <span className="text-sm flex-1">
                                                        {tag.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground group-hover:text-primary">
                                                        ({tag.bagCount})
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    );

    // Mobile: Drawer style
    if (isMobile) {
        return (
            <>
                {/* Mobile Toggle Button */}
                {!hideMobileButton && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange?.(!isOpen)}
                        className="lg:hidden"
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                        {hasActiveFilters && (
                            <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
                        )}
                    </Button>
                )}

                {/* Mobile Drawer */}
                {isOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div
                            className="fixed inset-0 bg-black/50"
                            onClick={() => onOpenChange?.(false)}
                        />
                        <div className="fixed left-0 top-0 h-full w-[280px] bg-background border-r shadow-lg">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-lg font-semibold">Filters</h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onOpenChange?.(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-4">{content}</div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Desktop: Sticky sidebar
    return (
        <aside
            className={cn(
                'w-[280px] border-r bg-background p-4',
                'lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto',
                className
            )}
        >
            <div className="mb-4">
                <h2 className="text-lg font-semibold">Filters</h2>
            </div>
            {content}
        </aside>
    );
}

