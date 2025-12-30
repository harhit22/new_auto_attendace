"""
Inspect ChromaDB Embeddings
Run this script to see what's stored in ChromaDB
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import chromadb

# Connect to ChromaDB
# Path is backend/chroma_db (parent of scripts dir + chroma_db)
chroma_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'chroma_db')
print(f"ChromaDB Path: {chroma_path}")
print(f"Exists: {os.path.exists(chroma_path)}")
print()

try:
    client = chromadb.PersistentClient(path=chroma_path)
    
    # List all collections
    collections = client.list_collections()
    print("=" * 50)
    print("CHROMADB COLLECTIONS")
    print("=" * 50)
    
    if not collections:
        print("No collections found. Train some employees first!")
    
    for col in collections:
        print(f"\nCollection: {col.name}")
        print("-" * 40)
        
        # Get all data from collection
        data = col.get(include=['metadatas', 'embeddings'])
        total = len(data['ids'])
        print(f"Total embeddings: {total}")
        
        if total > 0:
            print(f"\nSample IDs (first 5):")
            for i, id_ in enumerate(data['ids'][:5]):
                print(f"  {i+1}. {id_}")
            
            print(f"\nSample Metadata (first 2):")
            for i, meta in enumerate(data['metadatas'][:2]):
                print(f"  {i+1}. {meta}")
            
            if len(data['embeddings']) > 0:
                emb = data['embeddings'][0]
                print(f"\nEmbedding Details:")
                print(f"  Dimension: {len(emb)}")
                print(f"  First 5 values: {emb[:5]}")
                print(f"  Last 5 values: {emb[-5:]}")
        
        print()
        
except Exception as e:
    print(f"Error: {e}")
