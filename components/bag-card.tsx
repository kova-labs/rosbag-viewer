'use client';

import { useRouter } from 'next/navigation';
import { Calendar, Clock, FileText, Image as ImageIcon, HardDrive } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type BagWithTags } from '@/app/actions/bags';
import { getTopicsByBagId, type Topic } from '@/app/actions/topics';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface BagCardProps {
    bag: BagWithTags;
    className?: string;
}

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

// Check if topic is a camera/image topic
function isCameraTopic(topic: Topic): boolean {
    const imageTypes = [
        'sensor_msgs/Image',
        'sensor_msgs/CompressedImage',
        'sensor_msgs/msg/Image',
        'sensor_msgs/msg/CompressedImage',
    ];
    return imageTypes.some((type) => topic.messageType.includes(type));
}

export function BagCard({ bag, className }: BagCardProps) {
    const router = useRouter();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isLoadingTopics, setIsLoadingTopics] = useState(true);

    useEffect(() => {
        getTopicsByBagId(bag.id)
            .then((bagTopics) => {
                setTopics(bagTopics);
                setIsLoadingTopics(false);

                // Find first camera topic with cover image
                const cameraTopic = bagTopics.find(
                    (topic) => isCameraTopic(topic) && topic.coverImagePath
                );

                if (cameraTopic?.coverImagePath) {
                    // Assuming coverImagePath is relative to public or absolute URL
                    // Adjust this based on your actual file structure
                    setThumbnailUrl(cameraTopic.coverImagePath);
                }
            })
            .catch((error) => {
                console.error('Failed to load topics:', error);
                setIsLoadingTopics(false);
            });
    }, [bag.id]);

    const handleClick = () => {
        router.push(`/bags/${bag.id}`);
    };

    const topicCount = topics.length;
    const startDate = bag.startTime ? new Date(bag.startTime) : null;

    return (
        <Card
            className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
                className
            )}
            onClick={handleClick}
        >
            {/* Thumbnail */}
            <div className="relative w-full h-48 bg-muted overflow-hidden rounded-t-lg">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={bag.filename}
                        className="w-full h-full object-cover"
                        onError={() => setThumbnailUrl(null)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                )}
            </div>

            <CardHeader className="pb-3">
                <h3 className="font-semibold text-lg line-clamp-2" title={bag.filename}>
                    {bag.filename}
                </h3>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Metadata */}
                <div className="space-y-2 text-sm text-muted-foreground">
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
                                {format(startDate, 'MMM d, yyyy')} -{' '}
                                {formatDistanceToNow(startDate, { addSuffix: true })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Tags */}
                {bag.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {bag.tags.map((tag) => (
                            <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-xs"
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
            </CardContent>

            <CardFooter className="pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground w-full">
                    <FileText className="h-4 w-4" />
                    <span>
                        {isLoadingTopics ? (
                            'Loading...'
                        ) : topicCount === 0 ? (
                            'No topics'
                        ) : topicCount === 1 ? (
                            '1 topic'
                        ) : (
                            `${topicCount} topics`
                        )}
                    </span>
                </div>
            </CardFooter>
        </Card>
    );
}

