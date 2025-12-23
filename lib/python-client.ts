import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

// Type definitions
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface UploadBagResponse {
    bagId: string;
    message: string;
    status: ProcessingStatus;
}

export interface ProcessingStatusResponse {
    bagId: string;
    status: ProcessingStatus;
    progress?: number; // 0-100
    message?: string;
    error?: string;
}

export interface CancelProcessingResponse {
    bagId: string;
    message: string;
    cancelled: boolean;
}

export interface PythonClientError {
    message: string;
    statusCode?: number;
    error?: string;
}

// Create axios instance with default configuration
const createClient = (): AxiosInstance => {
    // Support both client-side (NEXT_PUBLIC_) and server-side env vars
    const baseURL =
        process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL ||
        process.env.PYTHON_SERVICE_URL ||
        'http://localhost:8000';

    const client = axios.create({
        baseURL,
        timeout: 300000, // 5 minutes for file uploads
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request interceptor for logging (optional)
    client.interceptors.request.use(
        (config) => {
            // Add any auth headers or logging here if needed
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            const pythonError: PythonClientError = {
                message: error.message || 'An unknown error occurred',
                statusCode: error.response?.status,
                error: error.response?.data
                    ? typeof error.response.data === 'string'
                        ? error.response.data
                        : (error.response.data as { detail?: string })?.detail || JSON.stringify(error.response.data)
                    : undefined,
            };

            // Enhance error message with response details
            if (error.response?.status) {
                pythonError.message = `Request failed with status ${error.response.status}: ${pythonError.error || pythonError.message}`;
            } else if (error.code === 'ECONNABORTED') {
                pythonError.message = 'Request timeout - the server took too long to respond';
            } else if (error.code === 'ECONNREFUSED') {
                pythonError.message = `Connection refused - unable to reach Python service at ${baseURL}`;
            }

            return Promise.reject(pythonError);
        }
    );

    return client;
};

const client = createClient();

/**
 * Upload a bag file and trigger processing
 * @param file - The bag file to upload
 * @param onUploadProgress - Optional callback for upload progress
 * @returns Promise with bag ID and initial status
 */
export async function uploadBag(
    file: File,
    onUploadProgress?: (progress: number) => void
): Promise<UploadBagResponse> {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const config: AxiosRequestConfig = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 300000, // 5 minutes for large file uploads
            onUploadProgress: (progressEvent) => {
                if (onUploadProgress && progressEvent.total) {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    onUploadProgress(percentCompleted);
                }
            },
        };

        const response = await client.post<UploadBagResponse>('/api/bags/upload', formData, config);
        return response.data;
    } catch (error) {
        const pythonError = error as PythonClientError;
        throw new Error(`Failed to upload bag: ${pythonError.message}`);
    }
}

/**
 * Check if bag processing is complete
 * @param bagId - The bag ID to check
 * @returns Promise with current processing status
 */
export async function getBagProcessingStatus(bagId: string): Promise<ProcessingStatusResponse> {
    try {
        const response = await client.get<ProcessingStatusResponse>(
            `/api/bags/${bagId}/status`,
            {
                timeout: 10000, // 10 seconds for status checks
            }
        );
        return response.data;
    } catch (error) {
        const pythonError = error as PythonClientError;
        throw new Error(`Failed to get processing status: ${pythonError.message}`);
    }
}

/**
 * Cancel ongoing bag processing
 * @param bagId - The bag ID to cancel processing for
 * @returns Promise with cancellation confirmation
 */
export async function cancelProcessing(bagId: string): Promise<CancelProcessingResponse> {
    try {
        const response = await client.post<CancelProcessingResponse>(
            `/api/bags/${bagId}/cancel`,
            {},
            {
                timeout: 10000, // 10 seconds for cancellation
            }
        );
        return response.data;
    } catch (error) {
        const pythonError = error as PythonClientError;
        throw new Error(`Failed to cancel processing: ${pythonError.message}`);
    }
}

// Export the client instance for advanced usage if needed
export { client as pythonClient };
