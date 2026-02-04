import pytest
from unittest.mock import MagicMock, patch
import sys

# We need to make sure KnowledgeBaseService is imported after we setup some mocks if we were doing module level, 
# but here we rely on patching classes.

from Backend.Source.Services.KnowledgeBaseService import KnowledgeBaseService

@pytest.fixture
def mock_embedding_fn():
    with patch('Backend.Source.Services.KnowledgeBaseService.CustomAzureEmbeddingFunction') as MockClass:
        yield MockClass

@pytest.fixture
def mock_chroma_client():
    # Patch where the class is defined, which is the chromadb module
    with patch('chromadb.PersistentClient') as MockClient:
        mock_instance = MagicMock()
        MockClient.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def kb_service(mock_chroma_client, mock_embedding_fn):
    # Mock settings
    with patch('Backend.Source.Services.KnowledgeBaseService.settings'):
        service = KnowledgeBaseService()
        # Explicitly set the collection mock
        service.collection = MagicMock()
        return service

def test_rrf_merge_logic(kb_service):
    """
    Test RRF merging logic manually.
    """
    # Semantic results
    semantic = {
        'ids': [['A', 'B']],
        'metadatas': [[{'id': 'A'}, {'id': 'B'}]],
        'documents': [['Doc A', 'Doc B']],
        'distances': [[0.1, 0.2]]
    }
    
    # Lexical results
    lexical = {
        'ids': ['B', 'C'],
        'metadatas': [{'id': 'B'}, {'id': 'C'}],
        'documents': ['Doc B', 'Doc C']
    }
    
    result = kb_service._rrf_merge(semantic, lexical, limit=3, k=1)
    
    returned_ids = result['ids'][0]
    # B: 0.33 + 0.5 = 0.833
    # A: 0.5
    # C: 0.33
    assert returned_ids == ['B', 'A', 'C']
    assert len(returned_ids) == 3

def test_search_hybrid_integration(kb_service):
    """
    Test the search_hybrid method calls.
    """
    kb_service.query = MagicMock(return_value={'ids': [['A']], 'metadatas': [[{}]], 'documents': [['']]})
    kb_service.search_exact = MagicMock(return_value={'ids': ['B'], 'metadatas': [{}], 'documents': ['']})
    
    results = kb_service.search_hybrid("query", n_results=2)
    
    kb_service.query.assert_called_once()
    kb_service.search_exact.assert_called_once_with("query")
    assert 'ids' in results
    assert len(results['ids'][0]) == 2

def test_search_hybrid_lexical_param(kb_service):
    """
    Test lexical_query parameter.
    """
    kb_service.query = MagicMock(return_value={'ids': [], 'metadatas': [], 'documents': []})
    kb_service.search_exact = MagicMock(return_value={'ids': [], 'metadatas': [], 'documents': []})
    
    kb_service.search_hybrid("semantic", lexical_query="lexical")
    
    kb_service.query.assert_called_with("semantic", n_results=10)
    kb_service.search_exact.assert_called_with("lexical")
