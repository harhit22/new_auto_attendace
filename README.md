# Face Recognition Attendance System

AI-powered face recognition attendance system with dual model support (Light/Heavy).

## Features
- 🏢 Multi-tenant SaaS architecture
- ⚡ Light Model (face-api.js) - Fast training (~5 sec), ~85% accuracy
- 🧠 Heavy Model (DeepFace/ArcFace) - High accuracy (~99%)
- 📷 Kiosk mode for check-in/check-out
- 👥 Employee self-enrollment
- 📊 Admin dashboard with attendance reports

## Tech Stack
- **Backend**: Django + Django REST Framework
- **Frontend**: React.js
- **AI/ML**: face-api.js, DeepFace, ArcFace
- **Database**: SQLite (dev) / PostgreSQL (prod)

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## API Endpoints
- `/api/v1/attendance/login/` - Admin login
- `/api/v1/attendance/employees/` - Employee CRUD
- `/api/v1/attendance/train-model/` - Train all employees
- `/api/v1/attendance/train-employee/` - Train single employee
- `/api/v1/attendance/checkin/` - Kiosk check-in
- `/api/v1/attendance/checkout/` - Kiosk check-out

## License
MIT
