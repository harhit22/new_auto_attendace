# Face Scanner & SaaS Attendance System - Project Description

## 1. Project Overview
This project is a sophisticated **SaaS-based Face Attendance and Compliance System**. It allows organizations to manage employee attendance using facial recognition technology while enforcing safety compliance through custom object detection (e.g., verifying if an employee is wearing a helmet or vest).

The system supports **Multi-Tenancy**, enabling multiple organizations to subscribe and manage their own employees, settings, and detection requirements independently.

## 2. Key Features

### 🏢 Multi-Tenancy (SaaS)
- **Organization Management**: Each company has its own isolated environment with specific settings (work hours, recognition mode, etc.).
- **Subscription Plans**: Supports Free, Pro, and Business tiers with limits on employee counts.
- **Custom Branding**: Organizations can upload their logos and defining unique slugs.

### 👤 Hybrid Face Recognition System
The system implements a "Dual Model" approach for balance between speed and accuracy:
1.  **Light Model (Frontend)**: Uses `face-api.js` for quick, client-side detection and liveness checks (128-dim embeddings).
2.  **Heavy Model (Backend)**: Uses `DeepFace` / `FaceNet` (PyTorch) for high-accuracy server-side verification (512-d embeddings).
- **Training Workflow**: Captures initial images -> Admin approval -> Model training.

### 🛡️ Safety Compliance (YOLO Integration)
- **Custom Object Detection**: Admins can upload custom YOLO models (`.pt` files).
- **Login Requirements**: Organizations can enforce rules (e.g., "Must wear Helmet to check in").
- **Audit Logs**: each login attempt is recorded with a compliance snapshot.

### 📅 Advanced Attendance Tracking
- **Automated Calculations**: Tracks Check-in/out times and automatically calculates work duration.
- **Status Management**: Handling of Late, Half-day, Absent, and Holiday statuses.
- **Geolocation**: (Likely supported or planned) to verify where the check-in occurred.

## 3. Technology Stack

### Backend
- **Framework**: Django 5.0 + Django Rest Framework (DRF)
- **Language**: Python 3.x
- **Database**: MySQL (via `mysqlclient`)
- **Asynchronous Tasks**: Celery + Redis (for model training and heavy processing)
- **Machine Learning**:
    - `torch` + `torchvision` (FaceNet InceptionResnetV1)
    - `numpy`, `Pillow` (Image processing)
- **Authentication**: JWT (SimpleJWT)
- **Documentation**: drf-spectacular (Swagger/OpenAPI)

### Frontend
- **Framework**: React 19
- **Build Tool**: Craco (Create React App Configuration Override)
- **ML / Vision**:
    - `face-api.js`: Browser-based face detection/recognition.
    - `@react-three/fiber`: 3D elements (likely for UI visualization).
    - `react-webcam`: Camera access.
- **State Management**: Context API (implied by `context/` dir).
- **Routing**: React Router v7.

## 4. Architecture Standards
- **REST API**: Fully decoupled frontend and backend.
- **Soft Deletes**: Implemented via `SoftDeleteModel` to preserve data integrity.
- **UUIDs**: All primary keys utilize UUIDs for security and scalability.
- **Containerization**: Docker and Docker Compose support for easy deployment.

## 5. Directory Structure
```
/
├── backend/              # Django Project
│   ├── apps/             # Modularized Django apps
│   ├── core/             # shared models (TimeStampedModel, etc.)
│   ├── ml/               # ML Engines (FaceNet, Quality Checker)
│   └── face_datasets/    # Storage for training images
├── frontend/             # React Application
│   ├── src/
│   │   ├── pages/        # Route components (Attendance, Admin)
│   │   ├── components/   # Reusable UI components
│   │   └── services/     # API integration logic
└── docker-compose.yml    # Orchestration
```
