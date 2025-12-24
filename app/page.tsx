'use client';

import { useState, useEffect } from 'react';
import { Upload, Package, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BagUploadDialog } from '@/components/bag-upload-dialog';
import { FilterSidebar, type FilterState } from '@/components/filter-sidebar';
import { BagCard } from '@/components/bag-card';
import { getBags, getBagsByTags, searchBags, type BagWithTags } from '@/app/actions/bags';
import { cn } from '@/lib/utils';

export default function Home() {
  const [bags, setBags] = useState<BagWithTags[]>([]);
  const [filteredBags, setFilteredBags] = useState<BagWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedTagIds: [],
  });

  // Fetch all bags on mount
  useEffect(() => {
    const fetchBags = async () => {
      try {
        setIsLoading(true);
        const allBags = await getBags();
        setBags(allBags);
      } catch (error) {
        console.error('Failed to fetch bags:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBags();
  }, []);

  // Apply filters whenever filters or bags change
  useEffect(() => {
    const applyFilters = async () => {
      if (isLoading) return;

      try {
        let result: BagWithTags[];

        // If both search and tags are active, we need to combine them
        if (filters.searchQuery.trim() && filters.selectedTagIds.length > 0) {
          // First filter by tags
          const tagFiltered = await getBagsByTags(filters.selectedTagIds);
          // Then filter by search query
          result = tagFiltered.filter((bag) =>
            bag.filename.toLowerCase().includes(filters.searchQuery.toLowerCase())
          );
        } else if (filters.selectedTagIds.length > 0) {
          // Filter by tags only
          result = await getBagsByTags(filters.selectedTagIds);
        } else if (filters.searchQuery.trim()) {
          // Filter by search only
          result = await searchBags(filters.searchQuery);
        } else {
          // No filters, show all bags
          result = bags;
        }

        setFilteredBags(result);
      } catch (error) {
        console.error('Failed to apply filters:', error);
        setFilteredBags([]);
      }
    };

    applyFilters();
  }, [filters, bags, isLoading]);

  const hasActiveFilters = filters.searchQuery.length > 0 || filters.selectedTagIds.length > 0;
  const showEmptyState = !isLoading && filteredBags.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative flex h-16 items-center justify-between px-4">
          {/* Mobile filter button - left edge */}
          <div className="lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterSidebarOpen(!filterSidebarOpen)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {(filters.searchQuery.length > 0 || filters.selectedTagIds.length > 0) && (
                <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
          {/* Title - centered */}
          <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold tracking-tight">
            ROS2 Bag Viewer
          </h1>
          {/* Import button - top right corner */}
          <Button 
            onClick={() => setUploadDialogOpen(true)}
            className="absolute top-4 right-4"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Bag
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Filter Sidebar - Desktop */}
        <FilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          isMobile={false}
          className="hidden lg:block lg:border-l-0"
        />

        {/* Filter Sidebar - Mobile Drawer */}
        <div className="lg:hidden">
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            isMobile={true}
            isOpen={filterSidebarOpen}
            onOpenChange={setFilterSidebarOpen}
            hideMobileButton={true}
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                <p className="text-muted-foreground">Loading bags...</p>
              </div>
            </div>
          ) : showEmptyState ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4 max-w-md">
                <Package className="h-16 w-16 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {hasActiveFilters
                      ? 'No bags match your filters'
                      : 'No bags yet'}
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    {hasActiveFilters
                      ? 'Try adjusting your filters or clear them to see all bags.'
                      : 'Upload your first ROS2 bag file to get started.'}
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({ searchQuery: '', selectedTagIds: [] })
                    }
                  >
                    Clear filters
                  </Button>
                )}
                {!hasActiveFilters && (
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Bag
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Results count */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredBags.length === 1
                    ? '1 bag found'
                    : `${filteredBags.length} bags found`}
                  {hasActiveFilters && (
                    <span className="ml-2">
                      (filtered from {bags.length} total)
                    </span>
                  )}
                </p>
              </div>

              {/* Bag Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBags.map((bag) => (
                  <BagCard key={bag.id} bag={bag} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Upload Dialog */}
      <BagUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </div>
  );
}
