/**
 * API Configuration
 * Change API_BASE_URL here to switch between local development and production
 */

// For local development
// export const API_BASE_URL = 'http://localhost:8000';

// For production/VM deployment
// export const API_BASE_URL = 'http://35.226.61.255:8001';

// For relative paths (when frontend and backend are served from same origin via nginx)
export const API_BASE_URL = 'http://35.226.61.255:8001';

// API endpoints
export const API_ENDPOINTS = {
    attendance: `${API_BASE_URL}/api/v1/attendance`,
    detection: `${API_BASE_URL}/api/v1/detection`,
    media: API_BASE_URL  // For image URLs
};

// Export individual endpoints for convenience
export const ATTENDANCE_API = API_ENDPOINTS.attendance;
export const DETECTION_API = API_ENDPOINTS.detection;
export const MEDIA_BASE = API_ENDPOINTS.media;

export default {
    API_BASE_URL,
    API_ENDPOINTS,
    ATTENDANCE_API,
    DETECTION_API,
    MEDIA_BASE
};
