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
        self._provider_name = provider or 'azure'
        self._model_name = model or settings.AZURE_EMBEDDING_DEPLOYMENT
        self._client = None
        self._dimension = 1536  # text-embedding-ada-002 dimension

    def name(self) -> str:
        return "UnifiedEmbeddingFunction"

    def _get_client(self):
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
        return self._dimension

    def __call__(self, input: list[str]) -> list[list[float]]:
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
        return self(texts)

    def embed_query(self, *args, **kwargs) -> list[list[float]]:
        input_data = kwargs.get('input') or kwargs.get('text')
        if not input_data and args:
            input_data = args[0]
        if isinstance(input_data, str):
            input_data = [input_data]
        return self(input_data)


# Keep old class for backward compatibility
class CustomAzureEmbeddingFunction(UnifiedEmbeddingFunction):
    def __init__(self):
        super().__init__(provider="azure")


class KnowledgeBaseService:
    def __init__(self, provider: str = None, model: str = None):
        """
        Initialize Knowledge Base Service.
        Uses per-tenant ChromaDB collections for data isolation.
        """
        import chromadb
        base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        db_path = os.path.join(base_path, settings.CHROMA_DB_PATH)

        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_fn = UnifiedEmbeddingFunction(provider=provider, model=model)

        # Cache for tenant collections to avoid repeated get_or_create calls
        self._tenant_collections = {}
        self._session_collections = {}

        # Keep a default collection for backward compatibility / global operations
        self._default_collection = self._get_or_create_collection_with_validation(
            name="dga_qiyas_controls",
            embedding_function=self.embedding_fn
        )

    def _get_or_create_collection_with_validation(self, name: str, embedding_function):
        """Get or create a collection with dimension validation."""
        collection = self.client.get_or_create_collection(
            name=name,
            embedding_function=embedding_function,
            metadata={"embedding_dimension": embedding_function.dimension}
        )

        stored_dim = collection.metadata.get("embedding_dimension") if collection.metadata else None
        current_dim = embedding_function.dimension

        if stored_dim and stored_dim != current_dim:
            logger.warning(
                f"Collection '{name}' uses dimension {stored_dim} but "
                f"current provider uses {current_dim}. Verify embedding compatibility."
            )

        return collection

    def _get_tenant_collection(self, tenant_id: str = None):
        """
        Get the collection for a specific tenant.
        Each tenant has their own isolated ChromaDB collection.
        Falls back to the default global collection if no tenant_id provided.
        """
        if not tenant_id:
            return self._default_collection

        if tenant_id not in self._tenant_collections:
            collection_name = f"tenant_{tenant_id[:8]}_standards"
            self._tenant_collections[tenant_id] = self._get_or_create_collection_with_validation(
                name=collection_name,
                embedding_function=self.embedding_fn
            )
            logger.info(f"Created/loaded collection for tenant: {tenant_id[:8]}")

        return self._tenant_collections[tenant_id]

    def _get_session_collection(self, tenant_id: str = None):
        """
        Get the session collection for a specific tenant.
        Used for per-conversation uploaded documents.
        """
        if not tenant_id:
            # Backward compat: use a global session collection
            return self._get_or_create_collection_with_validation(
                name="SessionKnowledgeBase",
                embedding_function=self.embedding_fn
            )

        if tenant_id not in self._session_collections:
            collection_name = f"tenant_{tenant_id[:8]}_sessions"
            self._session_collections[tenant_id] = self._get_or_create_collection_with_validation(
                name=collection_name,
                embedding_function=self.embedding_fn
            )

        return self._session_collections[tenant_id]

    # --- GLOBAL / TENANT KNOWLEDGE METHODS ---

    def add_documents(self, documents: list[str], ids: list[str], metadatas: list[dict] = None, tenant_id: str = None):
        """Add documents to the tenant's knowledge base collection."""
        collection = self._get_tenant_collection(tenant_id)
        collection.upsert(
            documents=documents,
            ids=ids,
            metadatas=metadatas
        )

    def query(self, query_text: str, n_results: int = 5, tenant_id: str = None):
        """
        Search the tenant's collection + the default (shared) collection.
        Merges results via RRF so default knowledge base is always accessible.
        """
        # Always search the default/global collection first
        default_results = self._default_collection.query(
            query_texts=[query_text],
            n_results=n_results
        )

        # If tenant has their own collection, search it too and merge
        if tenant_id:
            tenant_collection = self._get_tenant_collection(tenant_id)
            if tenant_collection != self._default_collection:
                tenant_results = tenant_collection.query(
                    query_texts=[query_text],
                    n_results=n_results
                )
                return self._merge_query_results(default_results, tenant_results, n_results)

        return default_results
        
    def _merge_query_results(self, results_a: dict, results_b: dict, limit: int) -> dict:
        """Merge two ChromaDB query results, deduplicating by ID."""
        seen = set()
        merged_ids = []
        merged_docs = []
        merged_metas = []
        merged_dists = []

        for results in [results_a, results_b]:
            if results.get('ids') and results['ids'][0]:
                ids = results['ids'][0]
                docs = results['documents'][0] if results.get('documents') else []
                metas = results['metadatas'][0] if results.get('metadatas') else []
                dists = results['distances'][0] if results.get('distances') else []
                for i, doc_id in enumerate(ids):
                    if doc_id not in seen:
                        seen.add(doc_id)
                        merged_ids.append(doc_id)
                        merged_docs.append(docs[i] if i < len(docs) else "")
                        merged_metas.append(metas[i] if i < len(metas) else {})
                        merged_dists.append(dists[i] if i < len(dists) else 0)

        # Sort by distance (ascending = most similar) and limit
        if merged_dists:
            combined = sorted(zip(merged_dists, merged_ids, merged_docs, merged_metas))
            combined = combined[:limit]
            return {
                "ids": [[c[1] for c in combined]],
                "documents": [[c[2] for c in combined]],
                "metadatas": [[c[3] for c in combined]],
                "distances": [[c[0] for c in combined]]
            }

        return {"ids": [merged_ids[:limit]], "documents": [merged_docs[:limit]], "metadatas": [merged_metas[:limit]], "distances": [merged_dists[:limit]]}

    def search_exact(self, query: str, limit: int = 2000, tenant_id: str = None):
        """Exact search across default + tenant collection."""
        try:
            # Search default collection
            default_results = self._default_collection.get(
                where_document={"$contains": query},
                limit=limit,
                include=["documents", "metadatas"]
            )

            # Also search tenant collection if different
            if tenant_id:
                tenant_collection = self._get_tenant_collection(tenant_id)
                if tenant_collection != self._default_collection:
                    tenant_results = tenant_collection.get(
                        where_document={"$contains": query},
                        limit=limit,
                        include=["documents", "metadatas"]
                    )
                    # Merge flat results (dedup by ID)
                    seen = set(default_results.get('ids', []))
                    for i, doc_id in enumerate(tenant_results.get('ids', [])):
                        if doc_id not in seen:
                            default_results['ids'].append(doc_id)
                            if tenant_results.get('documents'):
                                default_results.setdefault('documents', []).append(tenant_results['documents'][i])
                            if tenant_results.get('metadatas'):
                                default_results.setdefault('metadatas', []).append(tenant_results['metadatas'][i])

            return default_results
        except Exception as e:
            logger.error(f"Exact search scan failed for query '{query}': {e}")
            return {"ids": [], "documents": [], "metadatas": []}

    def search_hybrid(self, query_text: str, n_results: int = 5, lexical_query: str = None, tenant_id: str = None) -> dict:
        """Hybrid search within tenant's collection."""
        try:
            semantic_results = self.query(query_text, n_results=n_results * 2, tenant_id=tenant_id)
            target_lexical = lexical_query if lexical_query else query_text
            lexical_results = self.search_exact(target_lexical, tenant_id=tenant_id)
            combined_results = self._rrf_merge(semantic_results, lexical_results, n_results)
            return combined_results
        except Exception as e:
            logger.error(f"Hybrid search failed for '{query_text}': {e}")
            return self.query(query_text, n_results, tenant_id=tenant_id)

    def _rrf_merge(self, semantic: dict, lexical: dict, limit: int, k: int = 60) -> dict:
        """Merges results using Reciprocal Rank Fusion."""
        scores = {}
        metadata_map = {}
        document_map = {}
        
        if semantic.get('ids') and len(semantic['ids']) > 0:
            sem_ids = semantic['ids'][0]
            sem_metas = semantic['metadatas'][0] if semantic.get('metadatas') else []
            sem_docs = semantic['documents'][0] if semantic.get('documents') else []
            
            for rank, doc_id in enumerate(sem_ids):
                if doc_id not in scores:
                    scores[doc_id] = 0
                scores[doc_id] += 1 / (k + rank + 1)
                if doc_id not in metadata_map and rank < len(sem_metas):
                    metadata_map[doc_id] = sem_metas[rank]
                if doc_id not in document_map and rank < len(sem_docs):
                    document_map[doc_id] = sem_docs[rank]

        if lexical.get('ids'):
            lex_ids = lexical['ids']
            lex_metas = lexical['metadatas'] if lexical.get('metadatas') else []
            lex_docs = lexical['documents'] if lexical.get('documents') else []
            
            for rank, doc_id in enumerate(lex_ids):
                if doc_id not in scores:
                    scores[doc_id] = 0
                scores[doc_id] += 1 / (k + rank + 1)
                if doc_id not in metadata_map and rank < len(lex_metas):
                    metadata_map[doc_id] = lex_metas[rank]
                if doc_id not in document_map and rank < len(lex_docs):
                    document_map[doc_id] = lex_docs[rank]

        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:limit]
        
        return {
            "ids": [sorted_ids],
            "metadatas": [[metadata_map.get(id, {}) for id in sorted_ids]],
            "documents": [[document_map.get(id, "") for id in sorted_ids]],
            "distances": [[scores.get(id, 0) for id in sorted_ids]]
        }

    def get_neighbors(self, filename: str, index: int, window: int = 1, tenant_id: str = None):
        """Retrieves neighbor chunks from default + tenant collections."""
        start = max(0, index - window)
        end = index + window
        target_indices = list(range(start, end + 1))
        where_filter = {
            "$and": [
                {"source": filename},
                {"chunk_index": {"$in": target_indices}}
            ]
        }
        
        try:
            # Search default collection first
            results = self._default_collection.get(
                where=where_filter,
                include=["documents", "metadatas"]
            )
            
            # Also search tenant collection if different
            if tenant_id:
                tenant_collection = self._get_tenant_collection(tenant_id)
                if tenant_collection != self._default_collection:
                    tenant_results = tenant_collection.get(
                        where=where_filter,
                        include=["documents", "metadatas"]
                    )
                    # Merge
                    seen = set(results.get('ids', []))
                    for i, doc_id in enumerate(tenant_results.get('ids', [])):
                        if doc_id not in seen:
                            results['ids'].append(doc_id)
                            results['documents'].append(tenant_results['documents'][i])
                            results['metadatas'].append(tenant_results['metadatas'][i])

            if results['ids']:
                zipped = zip(results['documents'], results['metadatas'])
                sorted_docs = sorted(zipped, key=lambda x: x[1].get('chunk_index', 0))
                return [doc[0] for doc in sorted_docs]
            return []
        except Exception as e:
            logger.error(f"Neighbor fetch failed for {filename} index {index}: {e}")
            return []

    # --- SESSION KNOWLEDGE METHODS ---

    def add_session_document(self, text: str, conversation_id, filename: str, tenant_id: str = None):
        """Add a document to the tenant's session knowledge base."""
        collection = self._get_session_collection(tenant_id)
        try:
            chunk_size = 1000
            overlap = 100
            chunks = []

            start = 0
            while start < len(text):
                end = start + chunk_size
                chunks.append(text[start:end])
                start = end - overlap

            conv_id_str = str(conversation_id)
            ids = [f"sess_{conv_id_str}_{i}_{os.urandom(4).hex()}" for i in range(len(chunks))]
            metadatas = [{"conversation_id": conv_id_str, "source": filename, "chunk_index": i} for i in range(len(chunks))]

            logger.info(f"Adding {len(chunks)} chunks to Session KB for conversation {conversation_id} from {filename}")
            collection.upsert(
                documents=chunks,
                ids=ids,
                metadatas=metadatas
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add session document {filename} for conversation {conversation_id}: {e}")
            return False

    def query_session(self, query: str, conversation_id, n_results: int = 5, tenant_id: str = None):
        """Search within the tenant's session documents for a conversation."""
        collection = self._get_session_collection(tenant_id)
        try:
            results = collection.query(
                query_texts=[query],
                n_results=n_results,
                where={"conversation_id": str(conversation_id)}
            )
            return results
        except Exception as e:
            logger.error(f"Session query failed for conversation {conversation_id}: {e}")
            return {"ids": [], "documents": [], "metadatas": []}

    def delete_session_data(self, conversation_id, tenant_id: str = None):
        """Delete all vectors for a conversation from the tenant's session collection."""
        collection = self._get_session_collection(tenant_id)
        try:
            logger.info(f"Deleting session data for conversation {conversation_id}")
            collection.delete(
                where={"conversation_id": str(conversation_id)}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to delete session data for conversation {conversation_id}: {e}")
            return False

_kb_service_instance = None
_kb_service_provider = None

def get_kb_service(provider: str = None, model: str = None, force_new: bool = False):
    """Get or create Knowledge Base Service instance (singleton)."""
    global _kb_service_instance, _kb_service_provider

    target_provider = provider or getattr(settings, 'EMBEDDING_PROVIDER', 'azure')

    if force_new or _kb_service_instance is None or _kb_service_provider != target_provider:
        _kb_service_instance = KnowledgeBaseService(provider=provider, model=model)
        _kb_service_provider = target_provider

    return _kb_service_instance
