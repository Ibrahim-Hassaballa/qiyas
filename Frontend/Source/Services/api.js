import axios from 'axios';

// Create axios instance pointing to Backend API
// Assuming Backend runs on port 8000
const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
