"""
Celery configuration for attendance_system project.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.production')

app = Celery('attendance_system')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Schedule for periodic tasks
app.conf.beat_schedule = {
    # Clean up expired tokens daily
    'cleanup-expired-tokens': {
        'task': 'apps.authentication.tasks.cleanup_expired_tokens',
        'schedule': crontab(hour=2, minute=0),  # Run at 2 AM
    },
    # Check for model retraining weekly
    'check-model-retraining': {
        'task': 'apps.ml_models.tasks.check_retraining_needed',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # Sunday 3 AM
    },
    # Generate daily attendance report
    'daily-attendance-report': {
        'task': 'apps.analytics.tasks.generate_daily_report',
        'schedule': crontab(hour=23, minute=55),  # 11:55 PM
    },
    # Cleanup old sync queue entries
    'cleanup-sync-queue': {
        'task': 'apps.sync.tasks.cleanup_old_entries',
        'schedule': crontab(hour=4, minute=0),  # 4 AM
    },
    # Process pending validations
    'process-pending-validations': {
        'task': 'apps.attendance.tasks.process_pending_validations',
        'schedule': 60.0,  # Every minute
    },
}

# Task routing - separate queues for different task types
app.conf.task_routes = {
    'apps.ml_models.tasks.*': {'queue': 'ml_queue'},
    'apps.faces.tasks.*': {'queue': 'image_queue'},
    'apps.attendance.tasks.*': {'queue': 'default'},
    'apps.sync.tasks.*': {'queue': 'sync_queue'},
}

# Task priorities
app.conf.task_default_priority = 5
app.conf.task_queue_max_priority = 10


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery."""
    print(f'Request: {self.request!r}')
