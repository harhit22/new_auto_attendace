"""
Face models placeholder.

NOTE: Face embeddings are now stored in SaaSEmployee (core/models.py)
and ChromaDB (services/vector_db.py).

This file is kept to prevent import errors but models are deprecated.
"""

# Models have been removed because:
# - FaceImage: Not used - face images stored in media/employee_faces/
# - FaceEmbedding: Not used - embeddings stored in SaaSEmployee fields + ChromaDB
# - EnrollmentSession: Not used - enrollment tracked directly on SaaSEmployee

def face_image_upload_path(instance, filename):
    """
    Legacy helper for migrations.
    """
    return f"faces/deleted/{filename}"
