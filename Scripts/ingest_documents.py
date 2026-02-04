import os
import sys
import asyncio
from pathlib import Path

# Add project root to sys.path to allow imports from Backend
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from Backend.Source.Services.IngestionService import ingestion_service

async def main():
    raw_data_path = project_root / "Data" / "Raw"
    
    if not raw_data_path.exists():
        print(f"Error: Directory {raw_data_path} does not exist.")
        return

    files = [f for f in raw_data_path.iterdir() if f.is_file()]
    
    if not files:
        print("No files found in Data/Raw to ingest.")
        return

    print(f"Found {len(files)} files. Starting ingestion with SAMRT CHUNKERS...")

    for file_path in files:
        if file_path.name.startswith("~"): # Ignore temp files
            continue
            
        # Sanitize filename for printing
        safe_name = file_path.name.encode('ascii', 'replace').decode('ascii')
        print(f"Processing {safe_name}...")
        
        try:
            success, msg = await ingestion_service.ingest_file(file_path)
            if success:
                print(f"SUCCESS: {msg}")
            else:
                print(f"FAILED: {msg}")
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Failed to ingest: {e}")

    print("\nIngestion Complete!")

if __name__ == "__main__":
    asyncio.run(main())
