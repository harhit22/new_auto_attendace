# AI Attendance Verification System - Backend

Django REST Framework backend for AI-based attendance verification with face recognition.

## Features
- Employee enrollment with face image capture
- Two-level AI model architecture (on-device + server)
- Contextual validation (vehicle detection, crowd check)
- Offline-first sync support
- Role-based access control

## Tech Stack
- Django 5.0 + Django REST Framework
- MySQL 8.0
- Celery + Redis (background tasks)
- TensorFlow/PyTorch (ML models)

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

## Project Structure
```
backend/
├── attendance_system/    # Django project settings
├── apps/                 # Django applications
│   ├── users/           # User & Department management
│   ├── authentication/  # JWT auth
│   ├── attendance/      # Attendance records
│   ├── faces/           # Face images & embeddings
│   ├── ml_models/       # Model versioning
│   ├── sync/            # Offline sync
│   └── analytics/       # Dashboard & reports
├── core/                # Shared utilities
├── ml/                  # ML inference code
└── storage/             # Storage backends
```
