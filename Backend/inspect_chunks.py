import sys
from pathlib import Path
import logging

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from Backend.Source.Services.KnowledgeBaseService import get_kb_service

# Configure logger
logging.basicConfig(level=logging.INFO)

def inspect_vector_store():
    kb = get_kb_service()
    
    with open("chunks_report.txt", "w", encoding="utf-8") as f:
        # 1. Inspect MAIN Collection (Raw Documents)
        f.write("\n=== Main Collection (dga_qiyas_controls) ===\n")
        count = kb.collection.count()
        f.write(f"Total Chunks: {count}\n")
        
        if count > 0:
            # Get up to 3 chunks to show as example
            results = kb.collection.peek(limit=3)
            
            ids = results['ids']
            metadatas = results['metadatas']
            documents = results['documents']
            
            for i in range(len(ids)):
                f.write(f"\n--- Chunk {i+1} ---\n")
                f.write(f"ID:       {ids[i]}\n")
                f.write(f"Metadata: {metadatas[i]}\n")
                f.write(f"Content (Preview): {documents[i][:200]}...\n")

        # 2. Inspect SESSION Collection (User Uploads)
        f.write("\n\n=== Session Collection (SessionKnowledgeBase) ===\n")
        session_count = kb.session_collection.count()
        f.write(f"Total Chunks: {session_count}\n")
        
        if session_count > 0:
            results = kb.session_collection.peek(limit=3)
            ids = results['ids']
            metadatas = results['metadatas']
            documents = results['documents']
            
            for i in range(len(ids)):
                f.write(f"\n--- Chunk {i+1} ---\n")
                f.write(f"ID:       {ids[i]}\n")
                f.write(f"Metadata: {metadatas[i]}\n")
                f.write(f"Content (Preview): {documents[i][:200]}...\n")

if __name__ == "__main__":
    inspect_vector_store()
