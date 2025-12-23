'use client';

import { useState } from 'react';
import { Folder, Image as ImageIcon, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { type Topic } from '@/app/actions/topics';

interface TopicFolderProps {
    topic: Topic;
    onClick?: () => void;
    className?: string;
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

// Format frequency
function formatFrequency(frequency: number | null | undefined): string {
    if (!frequency) return 'N/A';
    if (frequency < 1) {
        return `${(frequency * 1000).toFixed(1)} mHz`;
    }
    return `${frequency.toFixed(1)} Hz`;
}

// Format message count
function formatMessageCount(count: number): string {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
}

export function TopicFolder({ topic, onClick, className }: TopicFolderProps) {
    const [imageError, setImageError] = useState(false);
    const isCamera = isCameraTopic(topic);
    const hasCoverImage = isCamera && topic.coverImagePath && !imageError;

    return (
        <Card
            className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 group',
                'flex flex-col',
                className
            )}
            onClick={onClick}
        >
            <CardContent className="p-0">
                {/* Folder Icon/Thumbnail Section */}
                <div className="relative h-32 bg-muted/50 flex items-center justify-center overflow-hidden rounded-t-lg border-b">
                    {hasCoverImage ? (
                        <>
                            <img
                                src={topic.coverImagePath!}
                                alt={topic.name}
                                className="w-full h-full object-cover"
                                onError={() => setImageError(true)}
                            />
                            {/* Overlay gradient for folder effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/20" />
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            {isCamera ? (
                                <ImageIcon className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
                            ) : (
                                <Folder className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                        </div>
                    )}
                </div>

                {/* Folder Info Section */}
                <div className="p-4 space-y-2">
                    {/* Topic Name */}
                    <div className="flex items-start justify-between gap-2">
                        <h3
                            className="font-medium text-sm line-clamp-2 flex-1 group-hover:text-primary transition-colors"
                            title={topic.name}
                        >
                            {topic.name}
                        </h3>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                    </div>

                    {/* Message Type */}
                    <p className="text-xs text-muted-foreground truncate" title={topic.messageType}>
                        {topic.messageType.split('/').pop() || topic.messageType}
                    </p>

                    {/* Metadata Row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>{formatMessageCount(topic.messageCount)}</span>
                        </div>
                        {topic.frequency !== null && (
                            <span className="font-mono">
                                {formatFrequency(topic.frequency)}
                            </span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

