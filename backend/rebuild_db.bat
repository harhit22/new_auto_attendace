@echo off
echo ==========================================
echo      REBUILDING FACE RECOGNITION DB
echo ==========================================
echo.
echo 1. Cleaning up old database...
if exist chroma_db (
    rmdir /s /q chroma_db
)
if exist backend\chroma_db (
    rmdir /s /q backend\chroma_db
)

echo.
echo 2. Running migration script...
python scripts/migrate_embeddings_to_chromadb.py

echo.
echo ==========================================
echo      DONE! PLEASE RESTART SERVER
echo ==========================================
pause
