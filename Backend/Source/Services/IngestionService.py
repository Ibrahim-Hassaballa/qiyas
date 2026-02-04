import os
from pathlib import Path
from Backend.Source.Services.DocumentService import DocumentService
from Backend.Source.Services.KnowledgeBaseService import get_kb_service
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger

class IngestionService:
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100):
        """
        Smart chunking that respects semantic boundaries (paragraphs, newlines).
        """
        if not text:
            return []
            
        separators = ["\n\n", "\n", ". ", " "]
        
        def split_text_recursive(text, separators):
            final_chunks = []
            if not separators:
                # Base case: Just slice hard
                start = 0
                while start < len(text):
                    final_chunks.append(text[start:start+chunk_size])
                    start += chunk_size - overlap
                return final_chunks
            
            sep = separators[0]
            splits = text.split(sep)
            
            current_chunk = ""
            for s in splits:
                if len(current_chunk) + len(s) + len(sep) <= chunk_size:
                     current_chunk += s + sep
                else:
                    if current_chunk:
                        final_chunks.append(current_chunk.strip())
                        current_chunk = ""
                    
                    if len(s) > chunk_size:
                        # Recursively split this big chunk
                        sub_chunks = split_text_recursive(s, separators[1:])
                        final_chunks.extend(sub_chunks)
                    else:
                        current_chunk = s + sep
            
            if current_chunk:
                final_chunks.append(current_chunk.strip())
                
            return final_chunks

        # Initial clean up
        text = text.replace('\r', '')
        return split_text_recursive(text, separators)

    @staticmethod
    async def ingest_file(file_path: Path):
        """
        Ingests a local file into the Knowledge Base.
        """
        try:
            # Mock UploadFile interface for DocumentService if needed, 
            # OR better yet, update DocumentService to handle Paths directly?
            # DocumentService expects UploadFile which has .filename and .content_type and .read() (async)
            # We can reuse the LocalFile mock specific to this purpose or simplify DocumentService.
            
            # Let's use a simple wrapper inline here or re-use the one from the script concept
            class LocalFile:
                def __init__(self, path): 
                    self.path = path
                    self.filename = path.name
                    self.content_type = "application/pdf" if path.suffix == ".pdf" else "application/octet-stream"
                    self.file = None
                async def read(self):
                    with open(self.path, "rb") as f: return f.read()

            local_file = LocalFile(file_path)
            
            # 1. Extract
            text = await DocumentService.extract_text(local_file)
            if not text.strip():
                return False, "No text extracted"

            # 2. Chunk
            chunks = IngestionService.chunk_text(text)

            # 3. Store in Batches
            batch_size = 1
            total_chunks = len(chunks)
            logger.info(f"Ingesting {total_chunks} chunks from {file_path.name} in batches of {batch_size}")
            
            for i in range(0, total_chunks, batch_size):
                batch_chunks = chunks[i : i + batch_size]
                batch_ids = [f"{file_path.name}_chunk_{j}" for j in range(i, i + len(batch_chunks))]
                batch_metas = [{"source": file_path.name, "chunk_index": j} for j in range(i, i + len(batch_chunks))]
                
                try:
                    get_kb_service().add_documents(documents=batch_chunks, ids=batch_ids, metadatas=batch_metas)
                    logger.debug(f"Ingested batch {i} to {i+len(batch_chunks)} from {file_path.name}")
                except Exception as e:
                    logger.error(f"Error ingesting batch {i} from {file_path.name}: {e}", exc_info=True)
                    continue # Skip this batch and continue

            return True, f"Ingested chunks (skipping failures)"

        except Exception as e:
            return False, str(e)

    @staticmethod
    def delete_document(filename: str):
        """
        Removes a document's chunks from Chroma.
        """
        try:
            get_kb_service().collection.delete(where={"source": filename})
            return True
        except Exception as e:
            logger.error(f"Error deleting {filename} from knowledge base: {e}")
            return False

ingestion_service = IngestionService()
