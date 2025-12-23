import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
from config import settings
import json


class Database:
    def __init__(self):
        self.connection_string = settings.database_url
    
    @contextmanager
    def get_connection(self):
        conn = psycopg2.connect(self.connection_string)
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def create_bag(self, filename: str, filepath: str, size: int, metadata: Dict[str, Any]) -> int:
        """Create a new bag entry in database"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO bags (filename, filepath, size, duration, start_time, end_time, 
                                     message_count, metadata, processed)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        filename,
                        filepath,
                        size,
                        metadata.get('duration'),
                        metadata.get('start_time'),
                        metadata.get('end_time'),
                        metadata.get('message_count'),
                        json.dumps(metadata),
                        False
                    )
                )
                bag_id = cur.fetchone()[0]
                return bag_id
    
    def update_bag_processed(self, bag_id: int, processed: bool):
        """Mark bag as processed"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE bags SET processed = %s WHERE id = %s",
                    (processed, bag_id)
                )
    
    def create_topic(self, bag_id: int, name: str, message_type: str, 
                     message_count: int, frequency: Optional[float], 
                     cover_image_path: Optional[str]) -> int:
        """Create a new topic entry"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO topics (bag_id, name, message_type, message_count, 
                                       frequency, cover_image_path)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (bag_id, name, message_type, message_count, frequency, cover_image_path)
                )
                topic_id = cur.fetchone()[0]
                return topic_id
    
    def bulk_insert_frames(self, frames: List[Dict[str, Any]]):
        """Bulk insert frame records"""
        if not frames:
            return
        
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO frames (topic_id, timestamp, sequence_number, 
                                       file_path, width, height)
                    VALUES %s
                    """,
                    [
                        (
                            f['topic_id'],
                            f['timestamp'],
                            f['sequence_number'],
                            f['file_path'],
                            f['width'],
                            f['height']
                        )
                        for f in frames
                    ]
                )
    
    def bulk_insert_pose_data(self, pose_data: List[Dict[str, Any]]):
        """Bulk insert pose data records"""
        if not pose_data:
            return
        
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO pose_data (bag_id, timestamp, x, y, z, qx, qy, qz, qw)
                    VALUES %s
                    """,
                    [
                        (
                            p['bag_id'],
                            p['timestamp'],
                            p['x'],
                            p['y'],
                            p['z'],
                            p['qx'],
                            p['qy'],
                            p['qz'],
                            p['qw']
                        )
                        for p in pose_data
                    ]
                )
    
    def bulk_insert_imu_data(self, imu_data: List[Dict[str, Any]]):
        """Bulk insert IMU data records"""
        if not imu_data:
            return
        
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO imu_data (bag_id, timestamp, angular_velocity, 
                                         linear_acceleration)
                    VALUES %s
                    """,
                    [
                        (
                            i['bag_id'],
                            i['timestamp'],
                            json.dumps(i['angular_velocity']),
                            json.dumps(i['linear_acceleration'])
                        )
                        for i in imu_data
                    ]
                )
    
    def assign_tags_to_bag(self, bag_id: int, tag_ids: List[int]):
        """Assign tags to a bag"""
        if not tag_ids:
            return
        
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # First, remove existing tags
                cur.execute("DELETE FROM bag_tags WHERE bag_id = %s", (bag_id,))
                
                # Insert new tags
                execute_values(
                    cur,
                    "INSERT INTO bag_tags (bag_id, tag_id) VALUES %s",
                    [(bag_id, tag_id) for tag_id in tag_ids]
                )
    
    def get_bag(self, bag_id: int) -> Optional[Dict[str, Any]]:
        """Get bag by ID"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM bags WHERE id = %s", (bag_id,))
                return cur.fetchone()


db = Database()