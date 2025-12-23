import sqlite3
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import json
from datetime import datetime
from config import settings
from database import db
import struct


class ROS2BagParser:
    """
    Parser for ROS2 bag files (.db3 format)
    Extracts metadata, camera frames, pose data, and IMU data
    """
    
    def __init__(self, bag_path: str, bag_id: int):
        self.bag_path = Path(bag_path)
        self.bag_id = bag_id
        self.conn = None
        
        # Create storage directories
        self.bag_dir = Path(settings.upload_dir) / str(bag_id)
        self.frames_dir = self.bag_dir / "frames"
        self.frames_dir.mkdir(parents=True, exist_ok=True)
        
    def connect(self):
        """Connect to the SQLite database in the bag file"""
        db3_file = self.bag_path / f"{self.bag_path.name}_0.db3"
        if not db3_file.exists():
            # Try without suffix
            db3_file = self.bag_path / f"{self.bag_path.name}.db3"
        
        if not db3_file.exists():
            raise FileNotFoundError(f"Could not find .db3 file in {self.bag_path}")
        
        self.conn = sqlite3.connect(str(db3_file))
        self.conn.row_factory = sqlite3.Row
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
    
    def get_metadata(self) -> Dict[str, Any]:
        """Extract bag metadata"""
        cursor = self.conn.cursor()
        
        # Get topics
        cursor.execute("SELECT * FROM topics")
        topics = []
        for row in cursor.fetchall():
            topics.append({
                'id': row['id'],
                'name': row['name'],
                'type': row['type'],
                'serialization_format': row['serialization_format']
            })
        
        # Get message count and time range
        cursor.execute("""
            SELECT 
                COUNT(*) as message_count,
                MIN(timestamp) as start_time,
                MAX(timestamp) as end_time
            FROM messages
        """)
        stats = cursor.fetchone()
        
        start_time_ns = stats['start_time'] if stats['start_time'] else 0
        end_time_ns = stats['end_time'] if stats['end_time'] else 0
        duration = (end_time_ns - start_time_ns) / 1e9  # Convert to seconds
        
        return {
            'topics': topics,
            'message_count': stats['message_count'],
            'start_time': start_time_ns / 1e9,
            'end_time': end_time_ns / 1e9,
            'duration': duration
        }
    
    def get_topic_info(self, topic_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific topic"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM topics WHERE name = ?", (topic_name,))
        topic = cursor.fetchone()
        
        if not topic:
            return None
        
        cursor.execute("""
            SELECT COUNT(*) as count, 
                   MIN(timestamp) as first_time,
                   MAX(timestamp) as last_time
            FROM messages 
            WHERE topic_id = ?
        """, (topic['id'],))
        stats = cursor.fetchone()
        
        duration = (stats['last_time'] - stats['first_time']) / 1e9
        frequency = stats['count'] / duration if duration > 0 else 0
        
        return {
            'topic_id': topic['id'],
            'name': topic['name'],
            'type': topic['type'],
            'message_count': stats['count'],
            'frequency': frequency
        }
    
    def deserialize_image_message(self, data: bytes, message_type: str) -> Optional[Tuple[np.ndarray, int, int]]:
        """
        Deserialize ROS2 image message (sensor_msgs/Image or sensor_msgs/CompressedImage)
        Returns: (numpy array, width, height) or None if failed
        """
        try:
            if 'CompressedImage' in message_type:
                # For CompressedImage, data contains JPEG/PNG directly after header
                # Skip CDR header (4 bytes) and message header
                offset = 4
                
                # Read format string (usually 'jpeg' or 'png')
                format_len = struct.unpack_from('<I', data, offset)[0]
                offset += 4 + format_len
                
                # Rest is compressed image data
                compressed_data = data[offset:]
                
                # Decode using OpenCV
                nparr = np.frombuffer(compressed_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    return img, img.shape[1], img.shape[0]
            
            else:
                # For uncompressed Image messages
                # This is a simplified parser - may need adjustment based on actual format
                offset = 4  # Skip CDR header
                
                # Parse Image header (simplified)
                # header: stamp(8) + frame_id(string)
                offset += 8  # Skip stamp
                frame_id_len = struct.unpack_from('<I', data, offset)[0]
                offset += 4 + frame_id_len
                
                # Image data
                height = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                width = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                
                encoding_len = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                encoding = data[offset:offset + encoding_len].decode('utf-8')
                offset += encoding_len
                
                is_bigendian = struct.unpack_from('<B', data, offset)[0]
                offset += 1
                step = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                
                data_len = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                
                image_data = data[offset:offset + data_len]
                
                # Convert to numpy array based on encoding
                if 'bgr8' in encoding or 'rgb8' in encoding:
                    img = np.frombuffer(image_data, dtype=np.uint8).reshape(height, width, 3)
                elif 'mono8' in encoding:
                    img = np.frombuffer(image_data, dtype=np.uint8).reshape(height, width)
                elif '16UC1' in encoding:
                    img = np.frombuffer(image_data, dtype=np.uint16).reshape(height, width)
                    # Convert to 8-bit for visualization
                    img = (img / 256).astype(np.uint8)
                else:
                    print(f"Unsupported encoding: {encoding}")
                    return None
                
                return img, width, height
        
        except Exception as e:
            print(f"Error deserializing image: {e}")
            return None
    
    def deserialize_pose_message(self, data: bytes) -> Optional[Dict[str, float]]:
        """
        Deserialize pose message (geometry_msgs/PoseStamped or similar)
        Returns dict with x, y, z, qx, qy, qz, qw
        """
        try:
            offset = 4  # Skip CDR header
            
            # Skip header (stamp + frame_id)
            offset += 8  # stamp
            frame_id_len = struct.unpack_from('<I', data, offset)[0]
            offset += 4 + frame_id_len
            
            # Read pose
            x, y, z = struct.unpack_from('<ddd', data, offset)
            offset += 24
            qx, qy, qz, qw = struct.unpack_from('<dddd', data, offset)
            
            return {
                'x': x, 'y': y, 'z': z,
                'qx': qx, 'qy': qy, 'qz': qz, 'qw': qw
            }
        except Exception as e:
            print(f"Error deserializing pose: {e}")
            return None
    
    def deserialize_imu_message(self, data: bytes) -> Optional[Dict[str, Any]]:
        """
        Deserialize IMU message (sensor_msgs/Imu)
        Returns dict with angular_velocity and linear_acceleration
        """
        try:
            offset = 4  # Skip CDR header
            
            # Skip header
            offset += 8  # stamp
            frame_id_len = struct.unpack_from('<I', data, offset)[0]
            offset += 4 + frame_id_len
            
            # Skip orientation (we don't use it here)
            offset += 32  # 4 doubles
            offset += 72  # orientation covariance (9 doubles)
            
            # Read angular velocity
            ang_x, ang_y, ang_z = struct.unpack_from('<ddd', data, offset)
            offset += 24
            offset += 72  # angular velocity covariance
            
            # Read linear acceleration
            lin_x, lin_y, lin_z = struct.unpack_from('<ddd', data, offset)
            
            return {
                'angular_velocity': {'x': ang_x, 'y': ang_y, 'z': ang_z},
                'linear_acceleration': {'x': lin_x, 'y': lin_y, 'z': lin_z}
            }
        except Exception as e:
            print(f"Error deserializing IMU: {e}")
            return None
    
    def process_camera_topic(self, topic_name: str, progress_callback=None) -> int:
        """
        Extract all frames from a camera topic and save as JPEGs
        Returns: topic_id in database
        """
        topic_info = self.get_topic_info(topic_name)
        if not topic_info:
            print(f"Topic {topic_name} not found")
            return None
        
        # Create topic directory
        topic_dir = self.frames_dir / topic_name.replace('/', '_')
        topic_dir.mkdir(parents=True, exist_ok=True)
        
        # Get all messages for this topic
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT timestamp, data 
            FROM messages 
            WHERE topic_id = ?
            ORDER BY timestamp
        """, (topic_info['topic_id'],))
        
        messages = cursor.fetchall()
        total_messages = len(messages)
        
        frames_data = []
        cover_image_path = None
        
        for idx, row in enumerate(messages):
            timestamp_ns = row['timestamp']
            timestamp_s = timestamp_ns / 1e9
            data = row['data']
            
            # Deserialize image
            result = self.deserialize_image_message(data, topic_info['type'])
            if result is None:
                continue
            
            img, width, height = result
            
            # Save as JPEG
            filename = f"{timestamp_s:.6f}.jpg"
            filepath = topic_dir / filename
            cv2.imwrite(str(filepath), img, [cv2.IMWRITE_JPEG_QUALITY, settings.frame_quality])
            
            # Store relative path
            relative_path = str(filepath.relative_to(Path(settings.upload_dir)))
            
            frames_data.append({
                'topic_id': None,  # Will be set after topic is created
                'timestamp': timestamp_s,
                'sequence_number': idx,
                'file_path': relative_path,
                'width': width,
                'height': height
            })
            
            # Use first frame as cover
            if idx == 0:
                cover_image_path = relative_path
            
            if progress_callback and idx % 10 == 0:
                progress_callback(idx / total_messages)
        
        # Create topic in database
        topic_db_id = db.create_topic(
            bag_id=self.bag_id,
            name=topic_name,
            message_type=topic_info['type'],
            message_count=topic_info['message_count'],
            frequency=topic_info['frequency'],
            cover_image_path=cover_image_path
        )
        
        # Update frames with topic_id
        for frame in frames_data:
            frame['topic_id'] = topic_db_id
        
        # Bulk insert frames
        db.bulk_insert_frames(frames_data)
        
        print(f"Processed {len(frames_data)} frames from {topic_name}")
        return topic_db_id
    
    def process_pose_topic(self, topic_name: str) -> int:
        """Extract pose data from topic"""
        topic_info = self.get_topic_info(topic_name)
        if not topic_info:
            return None
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT timestamp, data 
            FROM messages 
            WHERE topic_id = ?
            ORDER BY timestamp
        """, (topic_info['topic_id'],))
        
        pose_data = []
        for row in cursor.fetchall():
            timestamp_ns = row['timestamp']
            timestamp_s = timestamp_ns / 1e9
            data = row['data']
            
            pose = self.deserialize_pose_message(data)
            if pose:
                pose['bag_id'] = self.bag_id
                pose['timestamp'] = timestamp_s
                pose_data.append(pose)
        
        # Bulk insert
        db.bulk_insert_pose_data(pose_data)
        
        # Create topic entry
        topic_db_id = db.create_topic(
            bag_id=self.bag_id,
            name=topic_name,
            message_type=topic_info['type'],
            message_count=topic_info['message_count'],
            frequency=topic_info['frequency'],
            cover_image_path=None
        )
        
        print(f"Processed {len(pose_data)} pose messages from {topic_name}")
        return topic_db_id
    
    def process_imu_topic(self, topic_name: str) -> int:
        """Extract IMU data from topic"""
        topic_info = self.get_topic_info(topic_name)
        if not topic_info:
            return None
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT timestamp, data 
            FROM messages 
            WHERE topic_id = ?
            ORDER BY timestamp
        """, (topic_info['topic_id'],))
        
        imu_data = []
        for row in cursor.fetchall():
            timestamp_ns = row['timestamp']
            timestamp_s = timestamp_ns / 1e9
            data = row['data']
            
            imu = self.deserialize_imu_message(data)
            if imu:
                imu['bag_id'] = self.bag_id
                imu['timestamp'] = timestamp_s
                imu_data.append(imu)
        
        # Bulk insert
        db.bulk_insert_imu_data(imu_data)
        
        # Create topic entry
        topic_db_id = db.create_topic(
            bag_id=self.bag_id,
            name=topic_name,
            message_type=topic_info['type'],
            message_count=topic_info['message_count'],
            frequency=topic_info['frequency'],
            cover_image_path=None
        )
        
        print(f"Processed {len(imu_data)} IMU messages from {topic_name}")
        return topic_db_id
    
    def process_all(self, progress_callback=None):
        """Process all topics in the bag"""
        self.connect()
        
        try:
            metadata = self.get_metadata()
            
            # Camera topics to process
            camera_topics = [
                '/camera/camera/color/image_raw',
                '/camera/camera/depth/image_rect_raw',
                '/camera/camera/infra1/image_rect_raw',
                '/camera/camera/infra2/image_rect_raw'
            ]
            
            pose_topics = ['/camera/pose']
            imu_topics = ['/camera/camera/imu']
            
            total_topics = len(camera_topics) + len(pose_topics) + len(imu_topics)
            processed = 0
            
            # Process camera topics
            for topic in camera_topics:
                if topic in [t['name'] for t in metadata['topics']]:
                    print(f"Processing camera topic: {topic}")
                    self.process_camera_topic(topic, progress_callback)
                    processed += 1
                    if progress_callback:
                        progress_callback(processed / total_topics)
            
            # Process pose topics
            for topic in pose_topics:
                if topic in [t['name'] for t in metadata['topics']]:
                    print(f"Processing pose topic: {topic}")
                    self.process_pose_topic(topic)
                    processed += 1
                    if progress_callback:
                        progress_callback(processed / total_topics)
            
            # Process IMU topics
            for topic in imu_topics:
                if topic in [t['name'] for t in metadata['topics']]:
                    print(f"Processing IMU topic: {topic}")
                    self.process_imu_topic(topic)
                    processed += 1
                    if progress_callback:
                        progress_callback(processed / total_topics)
            
            # Mark bag as processed
            db.update_bag_processed(self.bag_id, True)
            
        finally:
            self.close()