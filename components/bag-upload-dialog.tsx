'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, File, X, Loader2 } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { uploadBag } from '@/lib/python-client';
import { getAllTags, type TagsByCategory } from '@/app/actions/tags';
import { assignTagsToBag } from '@/app/actions/bags';
import { cn } from '@/lib/utils';

interface BagUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BagUploadDialog({ open, onOpenChange }: BagUploadDialogProps) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [tagsByCategory, setTagsByCategory] = useState<TagsByCategory[]>([]);
    const [selectedTags, setSelectedTags] = useState<{
        device: number | null;
        location: number | null;
        sensor: number | null;
    }>({
        device: null,
        location: null,
        sensor: null,
    });

    // Fetch tags on mount
    useEffect(() => {
        if (open) {
            getAllTags()
                .then(setTagsByCategory)
                .catch((error) => {
                    console.error('Failed to fetch tags:', error);
                    toast.error('Failed to load tags');
                });
        }
    }, [open]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const selectedFile = acceptedFiles[0];
            // Validate file extension
            if (!selectedFile.name.endsWith('.db3') && !selectedFile.name.endsWith('.bag')) {
                toast.error('Please upload a valid ROS bag file (.db3 or .bag)');
                return;
            }
            setFile(selectedFile);
            setUploadProgress(0);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/octet-stream': ['.db3', '.bag'],
        },
        maxFiles: 1,
        disabled: isUploading,
    });

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file to upload');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const response = await uploadBag(file, (progress) => {
                setUploadProgress(progress);
            });

            // Assign tags if any are selected
            const selectedTagIds = [
                selectedTags.device,
                selectedTags.location,
                selectedTags.sensor,
            ].filter((id): id is number => id !== null);

            if (selectedTagIds.length > 0) {
                try {
                    const bagId = parseInt(response.bagId, 10);
                    if (!isNaN(bagId)) {
                        await assignTagsToBag(bagId, selectedTagIds);
                    }
                } catch (tagError) {
                    console.error('Failed to assign tags:', tagError);
                    // Don't fail the upload if tag assignment fails
                    toast.error('Bag uploaded but failed to assign tags');
                }
            }

            toast.success('Bag uploaded successfully! Processing started.');

            // Close dialog and redirect to bag detail page
            onOpenChange(false);
            router.push(`/bags/${response.bagId}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to upload bag';
            toast.error(errorMessage);
            setUploadProgress(0);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setUploadProgress(0);
    };

    const handleClose = () => {
        if (!isUploading) {
            setFile(null);
            setUploadProgress(0);
            setSelectedTags({ device: null, location: null, sensor: null });
            onOpenChange(false);
        }
    };

    const getTagsByCategoryName = (category: string) => {
        return tagsByCategory.find((tc) => tc.category === category)?.tags || [];
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Upload ROS Bag File</DialogTitle>
                    <DialogDescription>
                        Upload a ROS2 bag file to start processing and viewing.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* File Drop Zone */}
                    {!file ? (
                        <div
                            {...getRootProps()}
                            className={cn(
                                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                                isDragActive
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50',
                                isUploading && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <input {...getInputProps()} />
                            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium mb-2">
                                {isDragActive
                                    ? 'Drop the file here'
                                    : 'Drag & drop a bag file here, or click to select'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Supports .db3 and .bag files
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded">
                                        <File className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                                {!isUploading && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveFile}
                                        className="h-8 w-8"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {/* Upload Progress */}
                            {isUploading && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Uploading...</span>
                                        <span className="font-medium">{uploadProgress}%</span>
                                    </div>
                                    <Progress value={uploadProgress} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tag Selection */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Tags (Optional)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Device Tag */}
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Device</label>
                                <Select
                                    value={selectedTags.device?.toString() || ''}
                                    onValueChange={(value) =>
                                        setSelectedTags((prev) => ({
                                            ...prev,
                                            device: value ? parseInt(value) : null,
                                        }))
                                    }
                                    disabled={isUploading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select device" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getTagsByCategoryName('device').map((tag) => (
                                            <SelectItem key={tag.id} value={tag.id.toString()}>
                                                {tag.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Location Tag */}
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Location</label>
                                <Select
                                    value={selectedTags.location?.toString() || ''}
                                    onValueChange={(value) =>
                                        setSelectedTags((prev) => ({
                                            ...prev,
                                            location: value ? parseInt(value) : null,
                                        }))
                                    }
                                    disabled={isUploading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getTagsByCategoryName('location').map((tag) => (
                                            <SelectItem key={tag.id} value={tag.id.toString()}>
                                                {tag.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sensor Tag */}
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Sensor</label>
                                <Select
                                    value={selectedTags.sensor?.toString() || ''}
                                    onValueChange={(value) =>
                                        setSelectedTags((prev) => ({
                                            ...prev,
                                            sensor: value ? parseInt(value) : null,
                                        }))
                                    }
                                    disabled={isUploading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select sensor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getTagsByCategoryName('sensor').map((tag) => (
                                            <SelectItem key={tag.id} value={tag.id.toString()}>
                                                {tag.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={isUploading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpload}
                            disabled={!file || isUploading}
                            className="min-w-[120px]"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                'Upload'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

