from Backend.Source.Core.Config.Config import settings
import os
from Backend.Source.Core.Logging import logger
from openai import AzureOpenAI


class UnifiedEmbeddingFunction:
    """
    Unified embedding function that uses Azure OpenAI for embeddings.
    Used by ChromaDB for embedding documents and queries.
    """

    def __init__(self, provider: str = None, model: str = None):
        """
        Initialize embedding function.

        Args:
            provider: "azure" (defaults to azure, ollama not supported yet)
            model: Optional model name override
        """
        self._provider_name = provider or 'azure'
        self._model_name = model or settings.AZURE_EMBEDDING_DEPLOYMENT
        self._client = None
        self._dimension = 1536  # text-embedding-ada-002 dimension

    def name(self) -> str:
        """Name of the embedding function (required by ChromaDB 0.4+)."""
        return "UnifiedEmbeddingFunction"

    def _get_client(self):
        """Lazy initialization of Azure OpenAI client."""
        if self._client is None:
            self._client = AzureOpenAI(
                azure_endpoint=settings.AZURE_EMBEDDING_ENDPOINT,
                api_key=settings.AZURE_EMBEDDING_KEY,
                api_version=settings.AZURE_EMBEDDING_API_VERSION
            )
            logger.info(f"Initialized Azure OpenAI embedding client (model: {self._model_name})")
        return self._client

    @property
    def dimension(self) -> int:
        """Return the embedding dimension."""
        return self._dimension

    def __call__(self, input: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a list of texts.
        ChromaDB calls this method for embedding.
        """
        client = self._get_client()
        try:
            response = client.embeddings.create(
                input=input,
                model=self._model_name
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Embedding creation failed. Model: {self._model_name}, Input length: {len(input)}, Error: {e}", exc_info=True)
            raise e

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Compatibility method for ChromaDB."""
        return self(texts)

    def embed_query(self, *args, **kwargs) -> list[list[float]]:
        """
        Compatibility method for ChromaDB which may call embed_query with a list.
        Returns a list of embeddings (vectors).
        """
        input_data = kwargs.get('input') or kwargs.get('text')
        if not input_data and args:
            input_data = args[0]

        if isinstance(input_data, str):
            input_data = [input_data]

        return self(input_data)


# Keep old class for backward compatibility during transition
class CustomAzureEmbeddingFunction(UnifiedEmbeddingFunction):
    """
    Legacy Azure embedding function. Use UnifiedEmbeddingFunction instead.
    Kept for backward compatibility.
    """

    def __init__(self):
        super().__init__(provider="azure")

class KnowledgeBaseService:
    def __init__(self, provider: str = None, model: str = None):
        """
        Initialize Knowledge Base Service.

        Args:
            provider: Embedding provider ("azure" or "ollama"). Defaults to settings.
            model: Optional embedding model override
        """
        # Persistent Client (saves to disk)
        import chromadb
        base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        db_path = os.path.join(base_path, settings.CHROMA_DB_PATH)

        self.client = chromadb.PersistentClient(path=db_path)

        # Use Unified Embedding Function (supports Azure and Ollama)
        self.embedding_fn = UnifiedEmbeddingFunction(provider=provider, model=model)

        # Get or create main collection with dimension metadata
        self.collection = self._get_or_create_collection_with_validation(
            name="dga_qiyas_controls",
            embedding_function=self.embedding_fn
        )

        # Session Knowledge Base (Transient/User Uploads)
        self.session_collection = self._get_or_create_collection_with_validation(
            name="SessionKnowledgeBase",
            embedding_function=self.embedding_fn
        )

    def _get_or_create_collection_with_validation(self, name: str, embedding_function):
        """
        Get or create a collection with dimension validation.
        Warns if existing collection has different embedding dimension.
        """
        # Use standard get_or_create_collection which handles existence check safely
        collection = self.client.get_or_create_collection(
            name=name,
            embedding_function=embedding_function,
            # Only set metadata if creating (Chroma handles this merge if we pass it, but for safety let's just pass it)
            metadata={"embedding_dimension": embedding_function.dimension}
        )

        # Validate dimension if possible (optional but good practice)
        stored_dim = collection.metadata.get("embedding_dimension") if collection.metadata else None
        current_dim = embedding_function.dimension

        if stored_dim and stored_dim != current_dim:
            logger.warning(
                f"Collection '{name}' uses dimension {stored_dim} but "
                f"current provider uses {current_dim}. Verify embedding compatibility."
            )

        return collection

    def add_documents(self, documents: list[str], ids: list[str], metadatas: list[dict] = None):
        """
        Adds text documents to the vector DB.
        """
        self.collection.upsert(
            documents=documents,
            ids=ids,
            metadatas=metadatas
        )

    def query(self, query_text: str, n_results: int = 5):
        """
        Search for relevant documents.
        """
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        return results
        
    def search_exact(self, query: str, limit: int = 2000):
        """
        Performs a deterministic search using Full Collection Scan + Strict Python Filtering.
        This bypasses vector ANN approximation to guarantee finding specific IDs.
        """
        try:
            # 1. Use ChromaDB's native filtering
            # This pushes the query to the database engine, avoiding loading all docs into RAM.
            results = self.collection.get(
                where_document={"$contains": query},
                limit=limit,
                include=["documents", "metadatas"]
            )
            
            return results

        except Exception as e:
            logger.error(f"Exact search scan failed for query '{query}': {e}")
            return {"ids": [], "documents": [], "metadatas": []}

    def search_hybrid(self, query_text: str, n_results: int = 5, lexical_query: str = None) -> dict:
        """
        Hybrid search combining semantic and lexical search.
        Uses Reciprocal Rank Fusion (RRF) to combine rankings.
        Args:
            query_text: The text for semantic search (can include extra context)
            n_results: Number of results to return
            lexical_query: Optional text for exact search (defaults to query_text). 
                           Useful when query_text has appended metadata.
        """
        try:
            # 1. Semantic Search (Vector)
            # Fetch more results than needed to allow for re-ranking
            semantic_results = self.query(query_text, n_results=n_results * 2)
            
            # 2. Lexical Search (Exact Phrase)
            # Use specific lexical query if provided, else use the full text
            target_lexical = lexical_query if lexical_query else query_text
            lexical_results = self.search_exact(target_lexical)
            
            # 3. Combine using RRF
            combined_results = self._rrf_merge(semantic_results, lexical_results, n_results)
            
            return combined_results
        except Exception as e:
            logger.error(f"Hybrid search failed for '{query_text}': {e}")
            # Fallback to semantic search
            return self.query(query_text, n_results)

    def _rrf_merge(self, semantic: dict, lexical: dict, limit: int, k: int = 60) -> dict:
        """
        Merges results using Reciprocal Rank Fusion.
        score = 1 / (k + rank)
        """
        scores = {}
        metadata_map = {}
        document_map = {}
        
        # Process Semantic Results
        # Semantic results are lists of lists (batch format)
        if semantic.get('ids') and len(semantic['ids']) > 0:
            sem_ids = semantic['ids'][0]
            sem_metas = semantic['metadatas'][0] if semantic.get('metadatas') else []
            sem_docs = semantic['documents'][0] if semantic.get('documents') else []
            
            for rank, doc_id in enumerate(sem_ids):
                if doc_id not in scores:
                    scores[doc_id] = 0
                scores[doc_id] += 1 / (k + rank + 1)
                
                # Store data for retrieval
                if doc_id not in metadata_map and rank < len(sem_metas):
                    metadata_map[doc_id] = sem_metas[rank]
                if doc_id not in document_map and rank < len(sem_docs):
                    document_map[doc_id] = sem_docs[rank]

        # Process Lexical Results
        # Lexical results are flat lists (from .get())
        if lexical.get('ids'):
            lex_ids = lexical['ids']
            lex_metas = lexical['metadatas'] if lexical.get('metadatas') else []
            lex_docs = lexical['documents'] if lexical.get('documents') else []
            
            for rank, doc_id in enumerate(lex_ids):
                if doc_id not in scores:
                    scores[doc_id] = 0
                # Lexical matches are treated as high priority
                scores[doc_id] += 1 / (k + rank + 1)
                
                if doc_id not in metadata_map and rank < len(lex_metas):
                    metadata_map[doc_id] = lex_metas[rank]
                if doc_id not in document_map and rank < len(lex_docs):
                    document_map[doc_id] = lex_docs[rank]

        # Sort by Score (Descending)
        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:limit]
        
        # Format output to match ChromaDB query structure
        return {
            "ids": [sorted_ids],
            "metadatas": [[metadata_map.get(id, {}) for id in sorted_ids]],
            "documents": [[document_map.get(id, "") for id in sorted_ids]],
            "distances": [[scores.get(id, 0) for id in sorted_ids]]  # Returning RRF scores as distances (not true distances)
        }

    def get_neighbors(self, filename: str, index: int, window: int = 1):
        """
        Retrieves neighbor chunks (index-window to index+window) for context expansion.
        """
        start = max(0, index - window)
        end = index + window
        
        # Build list of target indices
        target_indices = list(range(start, end + 1))
        
        try:
            results = self.collection.get(
                where={
                    "$and": [
                        {"source": filename},
                        {"chunk_index": {"$in": target_indices}}
                    ]
                },
                include=["documents", "metadatas"]
            )
            
            # Sort by chunk_index to maintain reading order
            combined = []
            if results['ids']:
                # Zip and sort
                zipped = zip(results['documents'], results['metadatas'])
                # Sort by chunk_index
                sorted_docs = sorted(zipped, key=lambda x: x[1].get('chunk_index', 0))
                return [doc[0] for doc in sorted_docs]
            return []
        except Exception as e:
            logger.error(f"Neighbor fetch failed for {filename} index {index}: {e}")
            return []

    # --- SESSION KNOWLEDGE METHODS ---

    def add_session_document(self, text: str, conversation_id: int, filename: str):
        """
        Adds a document to the Session Knowledge Base.
        Chunks the text and tags it with conversation_id.
        """
        try:
            # Simple chunking for now (approx 1000 chars)
            chunk_size = 1000
            overlap = 100
            chunks = []
            
            start = 0
            while start < len(text):
                end = start + chunk_size
                chunks.append(text[start:end])
                start = end - overlap
            
            ids = [f"sess_{conversation_id}_{i}_{os.urandom(4).hex()}" for i in range(len(chunks))]
            metadatas = [{"conversation_id": conversation_id, "source": filename, "chunk_index": i} for i in range(len(chunks))]

            logger.info(f"Adding {len(chunks)} chunks to Session KB for conversation {conversation_id} from {filename}")
            self.session_collection.upsert(
                documents=chunks,
                ids=ids,
                metadatas=metadatas
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add session document {filename} for conversation {conversation_id}: {e}")
            return False

    def query_session(self, query: str, conversation_id: int, n_results: int = 5):
        """
        Searches ONLY within the specific conversation's documents.
        """
        try:
            results = self.session_collection.query(
                query_texts=[query],
                n_results=n_results,
                where={"conversation_id": conversation_id}
            )
            return results
        except Exception as e:
            logger.error(f"Session query failed for conversation {conversation_id}: {e}")
            return {"ids": [], "documents": [], "metadatas": []}

    def delete_session_data(self, conversation_id: int):
        """
        Deletes all vectors associated with a conversation.
        """
        try:
            logger.info(f"Deleting session data for conversation {conversation_id}")
            self.session_collection.delete(
                where={"conversation_id": conversation_id}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to delete session data for conversation {conversation_id}: {e}")
            return False

_kb_service_instance = None
_kb_service_provider = None

def get_kb_service(provider: str = None, model: str = None, force_new: bool = False):
    """
    Get or create Knowledge Base Service instance.

    Args:
        provider: Embedding provider ("azure" or "ollama"). Defaults to settings.
        model: Optional embedding model override
        force_new: Force creation of new instance (useful when switching providers)

    Returns:
        KnowledgeBaseService instance
    """
    global _kb_service_instance, _kb_service_provider

    # Determine the provider to use
    target_provider = provider or getattr(settings, 'EMBEDDING_PROVIDER', 'azure')

    # Check if we need a new instance (provider changed or forced)
    if force_new or _kb_service_instance is None or _kb_service_provider != target_provider:
        _kb_service_instance = KnowledgeBaseService(provider=provider, model=model)
        _kb_service_provider = target_provider

    return _kb_service_instance
