// API Service for Driver Duty App
import { API_BASE_URL } from '../config/constants';

export const api = {
    // Employee Login
    login: async (orgCode, employeeId) => {
        const response = await fetch(`${API_BASE_URL}/employee-login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_code: orgCode, employee_id: employeeId })
        });
        return response.json();
    },

    // Get Dashboard Data
    getDashboard: async (orgCode, employeeId) => {
        const response = await fetch(
            `${API_BASE_URL}/employee-dashboard/?org_code=${orgCode}&employee_id=${employeeId}`
        );
        return response.json();
    },

    // Driver Check-in
    driverCheckin: async (orgCode, employeeId, imageBlob) => {
        const formData = new FormData();
        formData.append('org_code', orgCode);
        formData.append('employee_id', employeeId);
        formData.append('image', {
            uri: imageBlob,
            type: 'image/jpeg',
            name: 'face.jpg'
        });

        const response = await fetch(`${API_BASE_URL}/trips/driver-checkin/`, {
            method: 'POST',
            body: formData
        });
        return response.json();
    },

    // Get Active Trip
    getActiveTrip: async (orgCode, employeeId) => {
        const response = await fetch(
            `${API_BASE_URL}/trips/active-trip/?org_code=${orgCode}&employee_id=${employeeId}`
        );
        return response.json();
    },

    // Driver Checkout
    driverCheckout: async (tripId, employeeId, imageBlob) => {
        const formData = new FormData();
        formData.append('employee_id', employeeId);
        formData.append('image', {
            uri: imageBlob,
            type: 'image/jpeg',
            name: 'face.jpg'
        });

        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/driver-checkout/`, {
            method: 'POST',
            body: formData
        });
        return response.json();
    },

    // Get Trip Details
    getTripDetails: async (tripId) => {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/`);
        return response.json();
    },

    // Helper Check-in
    helperCheckin: async (tripId, employeeId, password, imageBlob) => {
        const formData = new FormData();
        formData.append('employee_id', employeeId);
        formData.append('password', password || '');
        formData.append('image', {
            uri: imageBlob,
            type: 'image/jpeg',
            name: 'face.jpg'
        });

        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/helper-checkin/`, {
            method: 'POST',
            body: formData
        });
        return response.json();
    },

    // Skip Helper
    skipHelper: async (tripId) => {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/skip-helper/`, {
            method: 'POST'
        });
        return response.json();
    }
};
