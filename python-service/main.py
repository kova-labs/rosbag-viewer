from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import shutil
import asyncio
from typing import Dict, List
import traceback

from config import settings
from models import (
    UploadResponse, 
    ProcessingStatus, 
    TagCreate, 
    BagTagAssignment
)
from database import db
from rosbag_parser import ROS2BagParser
import zipfile

app = FastAPI(title="ROS2 Bag Processor API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Next.js domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for tracking processing jobs
processing_jobs: Dict[int, ProcessingStatus] = {}


async def process_bag_background(bag_id: int, bag_path: Path):
    """Background task to process a bag file"""
    try:
        processing_jobs[bag_id] = ProcessingStatus(
            bag_id=bag_id,
            status="processing",
            progress=0.0,
            message="Starting bag processing..."
        )
        
        parser = ROS2BagParser(str(bag_path), bag_id)
        
        def update_progress(progress: float):
            if bag_id in processing_jobs:
                processing_jobs[bag_id].progress = progress * 100
        
        # Process the bag
        parser.process_all(progress_callback=update_progress)
        
        # Mark as completed
        processing_jobs[bag_id] = ProcessingStatus(
            bag_id=bag_id,
            status="completed",
            progress=100.0,
            message="Bag processing completed successfully"
        )
        
    except Exception as e:
        error_msg = f"Error processing bag: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        processing_jobs[bag_id] = ProcessingStatus(
            bag_id=bag_id,
            status="failed",
            progress=0.0,
            message=error_msg
        )


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "ROS2 Bag Processor"}


@app.post("/api/bags/upload", response_model=UploadResponse)
async def upload_bag(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tag_ids: str = ""  # Comma-separated tag IDs
):
    """
    Upload a ROS2 bag file for processing
    
    The bag should be a directory (zipped) containing .db3 and metadata.yaml files
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Create temporary directory for extraction
        temp_dir = Path(settings.upload_dir) / "temp" / file.filename
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded file
        upload_path = temp_dir / file.filename
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = upload_path.stat().st_size

        if upload_path.suffix == '.zip':
            extract_dir = temp_dir / upload_path.stem
            with zipfile.ZipFile(upload_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            bag_candidates = list(extract_dir.glob('*.db3'))
            if not bag_candidates:
                raise HTTPException(status_code=400, detail="No .db3 files found in zip file")
            bag_path = bag_candidates[0].parent
        else:
            bag_path = temp_dir
        
        # Get basic metadata (without processing yet)
        try:
            parser = ROS2BagParser(str(bag_path), 0)  # Temporary ID
            parser.connect()
            metadata = parser.get_metadata()
            parser.close()
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid bag file: {str(e)}"
            )

        if upload_path.suffix == '.zip' and upload_path.exists():
            upload_path.unlink()
        
        # Create database entry
        bag_id = db.create_bag(
            filename=file.filename,
            filepath=str(bag_path),
            size=file_size,
            metadata=metadata
        )
        
        # Rename directory to use bag_id
        final_dir = Path(settings.upload_dir) / str(bag_id)
        if final_dir.exists():
            shutil.rmtree(final_dir)
        shutil.move(str(bag_path), str(final_dir))
        
        # Update filepath in database
        # (In production, you'd want to update this properly)
        
        # Assign tags if provided
        if tag_ids:
            try:
                tag_id_list = [int(x.strip()) for x in tag_ids.split(",") if x.strip()]
                db.assign_tags_to_bag(bag_id, tag_id_list)
            except ValueError:
                print(f"Invalid tag IDs: {tag_ids}")
        
        # Start background processing
        background_tasks.add_task(process_bag_background, bag_id, final_dir)
        
        return UploadResponse(
            bag_id=bag_id,
            filename=file.filename,
            status="processing",
            message="Bag uploaded successfully and processing started"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Upload failed: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/api/bags/status/{bag_id}", response_model=ProcessingStatus)
async def get_processing_status(bag_id: int):
    """Get the processing status of a bag"""
    
    # Check if bag exists
    bag = db.get_bag(bag_id)
    if not bag:
        raise HTTPException(status_code=404, detail="Bag not found")
    
    # Check if currently processing
    if bag_id in processing_jobs:
        return processing_jobs[bag_id]
    
    # Check if already processed
    if bag['processed']:
        return ProcessingStatus(
            bag_id=bag_id,
            status="completed",
            progress=100.0,
            message="Bag processing completed"
        )
    
    # Not yet started
    return ProcessingStatus(
        bag_id=bag_id,
        status="pending",
        progress=0.0,
        message="Bag processing not yet started"
    )


@app.post("/api/bags/{bag_id}/cancel")
async def cancel_processing(bag_id: int):
    """Cancel processing of a bag (if still in progress)"""
    
    if bag_id not in processing_jobs:
        raise HTTPException(
            status_code=404, 
            detail="No active processing job found for this bag"
        )
    
    # Mark as cancelled
    processing_jobs[bag_id] = ProcessingStatus(
        bag_id=bag_id,
        status="failed",
        progress=0.0,
        message="Processing cancelled by user"
    )
    
    return {"message": "Processing cancelled"}


@app.post("/api/bags/tags", response_model=Dict)
async def create_tag(tag: TagCreate):
    """Create a new tag (called from Next.js if needed)"""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tags (name, category, color)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (tag.name, tag.category, tag.color)
                )
                tag_id = cur.fetchone()[0]
                return {"id": tag_id, "name": tag.name, "category": tag.category}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/bags/{bag_id}/tags")
async def assign_tags(bag_id: int, assignment: BagTagAssignment):
    """Assign tags to a bag"""
    try:
        db.assign_tags_to_bag(bag_id, assignment.tag_ids)
        return {"message": "Tags assigned successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )