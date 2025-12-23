'use client';

import { useState } from 'react';
import { Calendar, Clock, HardDrive, Home, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import { type BagWithRelations } from '@/app/actions/bags';
import { TopicFolder } from '@/components/topic-folder';
import { Badge } from '@/components/ui/badge';
import { type Topic } from '@/app/actions/topics';

// Helper to format file size
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper to format duration
function formatDuration(seconds: number | null | undefined): string {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

interface BagDetailViewProps {
    bag: BagWithRelations;
}

export function BagDetailView({ bag }: BagDetailViewProps) {
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const startDate = bag.startTime ? new Date(bag.startTime) : null;

    return (
        <div className="min-h-screen bg-background">
            {/* Breadcrumb */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 py-3">
                    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link
                            href="/"
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                            <Home className="h-4 w-4" />
                            <span>Home</span>
                        </Link>
                        <ChevronRight className="h-4 w-4" />
                        <span className="text-foreground font-medium line-clamp-1">
                            {bag.filename}
                        </span>
                    </nav>
                </div>
            </div>

            {/* Header with Bag Info */}
            <div className="border-b bg-background">
                <div className="container mx-auto px-4 py-6">
                    <h1 className="text-3xl font-bold mb-4">{bag.filename}</h1>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                        {bag.duration !== null && (
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{formatDuration(bag.duration)}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4" />
                            <span>{formatFileSize(bag.size)}</span>
                        </div>

                        {startDate && (
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    {format(startDate, 'MMM d, yyyy')} •{' '}
                                    {formatDistanceToNow(startDate, { addSuffix: true })}
                                </span>
                            </div>
                        )}

                        {bag.topics.length > 0 && (
                            <div className="text-sm">
                                <span className="font-medium">{bag.topics.length}</span>{' '}
                                {bag.topics.length === 1 ? 'topic' : 'topics'}
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    {bag.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {bag.tags.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="outline"
                                    style={
                                        tag.color
                                            ? {
                                                  borderColor: tag.color,
                                                  color: tag.color,
                                                  backgroundColor: `${tag.color}15`,
                                              }
                                            : undefined
                                    }
                                >
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Topics List */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-4">
                            <h2 className="text-lg font-semibold mb-4">Topics</h2>
                            {bag.topics.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No topics found</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                                    {bag.topics.map((topic) => (
                                        <TopicFolder
                                            key={topic.id}
                                            topic={topic}
                                            onClick={() => setSelectedTopic(topic)}
                                            className={
                                                selectedTopic?.id === topic.id
                                                    ? 'border-primary ring-2 ring-primary/20'
                                                    : ''
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Visualization Area */}
                    <div className="lg:col-span-2">
                        <div className="sticky top-4 space-y-6">
                            {/* 3D Trajectory View */}
                            <div className="border rounded-lg p-6 bg-card">
                                <h2 className="text-lg font-semibold mb-4">3D Trajectory</h2>
                                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                                    <p className="text-muted-foreground">
                                        {bag.poseData.length > 0
                                            ? '3D trajectory visualization will appear here'
                                            : 'No pose data available'}
                                    </p>
                                </div>
                                {bag.poseData.length > 0 && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        {bag.poseData.length} pose points
                                    </p>
                                )}
                            </div>

                            {/* Selected Topic Viewer */}
                            <div className="border rounded-lg p-6 bg-card">
                                <h2 className="text-lg font-semibold mb-4">
                                    {selectedTopic ? selectedTopic.name : 'Topic Viewer'}
                                </h2>
                                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                                    {selectedTopic ? (
                                        <div className="text-center space-y-2">
                                            <p className="text-muted-foreground">
                                                Viewing: {selectedTopic.name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {selectedTopic.messageType}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">
                                            Select a topic to view its content
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

