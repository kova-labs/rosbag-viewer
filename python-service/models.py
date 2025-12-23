from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class BagMetadata(BaseModel):
    filename: str
    size: int
    duration: float
    start_time: float
    end_time: float
    message_count: int
    topics: List[Dict[str, Any]]


class TopicInfo(BaseModel):
    name: str
    message_type: str
    message_count: int
    frequency: Optional[float] = None


class UploadResponse(BaseModel):
    bag_id: int
    filename: str
    status: str
    message: str


class ProcessingStatus(BaseModel):
    bag_id: int
    status: str  # 'pending', 'processing', 'completed', 'failed'
    progress: float  # 0-100
    message: Optional[str] = None
    topics_processed: Optional[int] = None
    total_topics: Optional[int] = None


class TagCreate(BaseModel):
    name: str
    category: str  # 'device', 'location', 'sensor'
    color: Optional[str] = None


class BagTagAssignment(BaseModel):
    bag_id: int
    tag_ids: List[int]