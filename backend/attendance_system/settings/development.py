"""
Development settings for attendance_system project.
"""
from .base import *

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '4c3e138fbbd8.ngrok-free.app', '.ngrok-free.app']

# Trust ngrok for CSRF (required for POST requests)
CSRF_TRUSTED_ORIGINS = ['https://4c3e138fbbd8.ngrok-free.app', 'https://*.ngrok-free.app']

# Database - MySQL for development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME', default='attendance_db'),
        'USER': config('DB_USER', default='root'),
        'PASSWORD': config('DB_PASSWORD', default='password'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='3306'),
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# CORS - Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True

# Cache - Use local memory cache in development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# Email - Console backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Debug Toolbar (optional)
try:
    import debug_toolbar
    INSTALLED_APPS += ['debug_toolbar']
    MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE
    INTERNAL_IPS = ['127.0.0.1']
except ImportError:
    pass

# Disable throttling in development
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []

# More verbose logging in development
LOGGING['loggers']['apps']['level'] = 'INFO'
LOGGING['loggers']['django']['level'] = 'INFO'
