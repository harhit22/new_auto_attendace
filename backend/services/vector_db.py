"""
Vector Database Service using ChromaDB
Handles storage and similarity search for face embeddings.
Free, self-hosted, no Docker required.
"""
import os
import logging
from typing import List, Dict, Optional, Tuple
import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)

# Get the base directory for ChromaDB storage
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DB_PATH = os.path.join(BASE_DIR, 'chroma_db')


class VectorDBService:
    """
    ChromaDB-based vector database for face embeddings.
    Supports both light (128-dim) and heavy (512-dim) embeddings.
    Organization-scoped collections for multi-tenant support.
    """
    
    _instance = None
    _client = None
    
    def __new__(cls):
        """Singleton pattern to reuse ChromaDB client."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            self._initialize_client()
    
    def _initialize_client(self):
        """Initialize ChromaDB client with persistent storage."""
        try:
            # Ensure directory exists
            os.makedirs(CHROMA_DB_PATH, exist_ok=True)
            
            # Create persistent client
            self._client = chromadb.PersistentClient(
                path=CHROMA_DB_PATH,
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            logger.info(f"ChromaDB initialized at: {CHROMA_DB_PATH}")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise
    
    def _get_collection_name(self, org_code: str, model_type: str) -> str:
        """Generate collection name for org + model type."""
        # ChromaDB collection names: only alphanumeric and underscores
        safe_org = org_code.replace('-', '_').replace(' ', '_').lower()
        return f"{safe_org}_{model_type}_embeddings"
    
    def _get_or_create_collection(self, org_code: str, model_type: str):
        """Get or create a collection for an organization's embeddings."""
        collection_name = self._get_collection_name(org_code, model_type)
        
        # Determine embedding dimension based on model type
        # Light model: 128-dim, Heavy model: 512-dim
        metadata = {"model_type": model_type, "org_code": org_code}
        
        return self._client.get_or_create_collection(
            name=collection_name,
            metadata=metadata
        )
    
    def add_embeddings(
        self, 
        org_code: str, 
        model_type: str, 
        employee_id: str, 
        embeddings: List[List[float]],
        employee_name: str = ""
    ) -> bool:
        """
        Add or update embeddings for an employee.
        
        Args:
            org_code: Organization code
            model_type: 'light' or 'heavy'
            employee_id: Employee ID
            embeddings: List of embedding vectors
            employee_name: Employee name for metadata
            
        Returns:
            True if successful
        """
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            
            # First, delete existing embeddings for this employee
            self.delete_embeddings(org_code, model_type, employee_id)
            
            # Add new embeddings with unique IDs
            ids = [f"{employee_id}_{i}" for i in range(len(embeddings))]
            metadatas = [
                {
                    "employee_id": employee_id,
                    "employee_name": employee_name,
                    "embedding_index": i
                } 
                for i in range(len(embeddings))
            ]
            
            collection.add(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )
            
            logger.info(f"Added {len(embeddings)} embeddings for employee {employee_id} ({model_type})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add embeddings: {e}")
            return False
    
    def search_similar(
        self, 
        org_code: str, 
        model_type: str, 
        query_embedding: List[float],
        n_results: int = 5,
        threshold: float = 0.0
    ) -> List[Dict]:
        """
        Search for similar embeddings.
        
        Args:
            org_code: Organization code
            model_type: 'light' or 'heavy'
            query_embedding: Query embedding vector
            n_results: Number of results to return
            threshold: Minimum similarity score (0-1), 0 = no threshold
            
        Returns:
            List of matches with employee_id, distance, and metadata
        """
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            
            # Check if collection has any embeddings
            if collection.count() == 0:
                logger.warning(f"No embeddings in collection for {org_code} ({model_type})")
                return []
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(n_results, collection.count())
            )
            
            matches = []
            if results and results['ids'] and len(results['ids']) > 0:
                for i, id_ in enumerate(results['ids'][0]):
                    distance = results['distances'][0][i] if results['distances'] else 0
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    
                    # Convert L2 distance to similarity score (0-1)
                    # Lower distance = higher similarity
                    # Using exponential decay: similarity = exp(-distance)
                    import math
                    similarity = math.exp(-distance / 2)  # Normalize for better range
                    
                    if threshold == 0 or similarity >= threshold:
                        matches.append({
                            'id': id_,
                            'employee_id': metadata.get('employee_id', ''),
                            'employee_name': metadata.get('employee_name', ''),
                            'distance': distance,
                            'similarity': similarity,
                            'confidence': round(similarity * 100, 2)
                        })
            
            # Sort by similarity descending
            matches.sort(key=lambda x: x['similarity'], reverse=True)
            
            return matches
            
        except Exception as e:
            logger.error(f"Failed to search embeddings: {e}")
            return []
    
    def find_best_match(
        self, 
        org_code: str, 
        model_type: str, 
        query_embedding: List[float],
        min_confidence: float = 0.7
    ) -> Optional[Tuple[str, float, str]]:
        """
        Find the best matching employee for a face embedding.
        
        Args:
            org_code: Organization code
            model_type: 'light' or 'heavy'
            query_embedding: Query embedding vector
            min_confidence: Minimum confidence threshold (0-1)
            
        Returns:
            Tuple of (employee_id, confidence, employee_name) or None if no match
        """
        matches = self.search_similar(org_code, model_type, query_embedding, n_results=3)
        
        if not matches:
            return None
        
        best_match = matches[0]
        
        if best_match['similarity'] >= min_confidence:
            return (
                best_match['employee_id'],
                best_match['confidence'],
                best_match['employee_name']
            )
        
        return None
    
    def delete_embeddings(self, org_code: str, model_type: str, employee_id: str) -> bool:
        """
        Delete all embeddings for an employee.
        
        Args:
            org_code: Organization code
            model_type: 'light' or 'heavy'
            employee_id: Employee ID
            
        Returns:
            True if successful
        """
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            
            # Find all IDs for this employee
            results = collection.get(
                where={"employee_id": employee_id}
            )
            
            if results and results['ids']:
                collection.delete(ids=results['ids'])
                logger.info(f"Deleted {len(results['ids'])} embeddings for employee {employee_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete embeddings: {e}")
            return False
    
    def get_employee_embeddings(self, org_code: str, model_type: str, employee_id: str) -> List[Dict]:
        """
        Get all embeddings for an employee from ChromaDB.
        
        Returns:
            List of dicts with id, metadata, and embedding_index
        """
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            
            results = collection.get(
                where={"employee_id": employee_id}
            )
            
            embeddings_list = []
            if results and results['ids']:
                for i, id_ in enumerate(results['ids']):
                    meta = results['metadatas'][i] if results['metadatas'] else {}
                    embeddings_list.append({
                        'chroma_id': id_,
                        'embedding_index': meta.get('embedding_index', i),
                        'employee_id': meta.get('employee_id', ''),
                        'employee_name': meta.get('employee_name', ''),
                    })
            
            # Sort by embedding_index
            embeddings_list.sort(key=lambda x: x.get('embedding_index', 0))
            return embeddings_list
            
        except Exception as e:
            logger.error(f"Failed to get employee embeddings: {e}")
            return []
    
    def delete_embedding_by_id(self, org_code: str, model_type: str, chroma_id: str) -> bool:
        """
        Delete a specific embedding by its ChromaDB ID.
        
        Args:
            org_code: Organization code
            model_type: 'light' or 'heavy'
            chroma_id: The ChromaDB document ID (e.g., 'EMP001_0')
            
        Returns:
            True if successful
        """
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            collection.delete(ids=[chroma_id])
            logger.info(f"Deleted embedding {chroma_id} from ChromaDB")
            return True
        except Exception as e:
            logger.error(f"Failed to delete embedding {chroma_id}: {e}")
            return False
    
    def get_employee_count(self, org_code: str, model_type: str) -> int:
        """Get number of unique employees with embeddings."""
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            
            # Get all embeddings and count unique employee IDs
            results = collection.get()
            
            if results and results['metadatas']:
                unique_employees = set()
                for meta in results['metadatas']:
                    if meta.get('employee_id'):
                        unique_employees.add(meta['employee_id'])
                return len(unique_employees)
            
            return 0
            
        except Exception as e:
            logger.error(f"Failed to get employee count: {e}")
            return 0
    
    def get_collection_stats(self, org_code: str, model_type: str) -> Dict:
        """Get statistics for a collection."""
        try:
            collection = self._get_or_create_collection(org_code, model_type)
            
            return {
                'collection_name': collection.name,
                'total_embeddings': collection.count(),
                'unique_employees': self.get_employee_count(org_code, model_type)
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {'error': str(e)}
    
    def clear_organization(self, org_code: str) -> bool:
        """Clear all embeddings for an organization."""
        try:
            for model_type in ['light', 'heavy']:
                collection_name = self._get_collection_name(org_code, model_type)
                try:
                    self._client.delete_collection(collection_name)
                    logger.info(f"Deleted collection: {collection_name}")
                except Exception:
                    pass  # Collection may not exist
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to clear organization: {e}")
            return False


# Singleton instance
vector_db = VectorDBService()
