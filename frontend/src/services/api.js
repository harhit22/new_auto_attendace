/**
 * API Service for communicating with Django backend
 */
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
                        refresh: refreshToken,
                    });

                    localStorage.setItem('access_token', response.data.access_token);
                    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;

                    return api(originalRequest);
                } catch (refreshError) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login/', { email, password }),
    logout: (refreshToken) => api.post('/auth/logout/', { refresh_token: refreshToken }),
    verify: () => api.get('/auth/verify/'),
};

// Users API
export const usersAPI = {
    getMe: () => api.get('/users/me/'),
    updateMe: (data) => api.patch('/users/me/', data),
    getAll: (params) => api.get('/users/', { params }),
    getById: (id) => api.get(`/users/${id}/`),
    create: (data) => api.post('/users/', data),
    update: (id, data) => api.patch(`/users/${id}/`, data),
    delete: (id) => api.delete(`/users/${id}/`),
};

// Departments API
export const departmentsAPI = {
    getAll: () => api.get('/users/departments/'),
    create: (data) => api.post('/users/departments/', data),
};

// Face Enrollment API
export const enrollmentAPI = {
    /**
     * Enroll a user with face images
     * @param {string} userId - User ID to enroll
     * @param {File[]} images - Array of image files
     * @param {object} metadata - Optional metadata
     */
    enroll: async (userId, images, metadata = {}) => {
        const formData = new FormData();

        images.forEach((image, index) => {
            formData.append('images', image, `face_${index}.jpg`);
        });

        formData.append('purpose', 'enrollment');
        formData.append('metadata', JSON.stringify(metadata));

        return api.post(`/faces/enroll/${userId}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    addFaces: async (userId, images) => {
        const formData = new FormData();
        images.forEach((image, index) => {
            formData.append('images', image, `face_${index}.jpg`);
        });

        return api.post(`/faces/enroll/${userId}/add-faces/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    getSessions: () => api.get('/faces/enroll/sessions/'),
};

// Attendance API
export const attendanceAPI = {
    /**
     * Check in with face image
     * @param {File} image - Face image file
     * @param {object} options - Additional options (device_id, latitude, longitude)
     */
    checkIn: async (image, options = {}) => {
        const formData = new FormData();
        formData.append('image', image, 'checkin.jpg');

        if (options.device_id) formData.append('device_id', options.device_id);
        if (options.latitude) formData.append('latitude', options.latitude);
        if (options.longitude) formData.append('longitude', options.longitude);

        return api.post('/attendance/check_in/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    checkOut: (attendanceId) => api.post('/attendance/check_out/', { attendance_id: attendanceId }),

    getHistory: (params) => api.get('/attendance/history/', { params }),

    override: (id, status, reason) => api.put(`/attendance/${id}/override/`, { status, reason }),
};

// Analytics API
export const analyticsAPI = {
    getDashboard: (params) => api.get('/analytics/dashboard/', { params }),
    getModelPerformance: () => api.get('/analytics/model-performance/'),
};

// ML Models API
export const modelsAPI = {
    getVersions: () => api.get('/models/versions/'),
    getActive: () => api.get('/models/versions/active/'),
    triggerTraining: (config) => api.post('/models/training/trigger/', config),
};

export default api;
