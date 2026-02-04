import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../Services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [csrfToken, setCsrfToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Configure API Interceptors
    useEffect(() => {
        // Add CSRF token to all non-GET requests
        const requestInterceptor = api.interceptors.request.use(
            (config) => {
                if (config.method !== 'get' && csrfToken) {
                    config.headers['X-CSRF-Token'] = csrfToken;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        return () => api.interceptors.request.eject(requestInterceptor);
    }, [csrfToken]);

    // Check authentication status on mount
    useEffect(() => {
        checkAuth();
    }, []);

    // Global API Interceptor for 401s
    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    logout();
                }
                return Promise.reject(error);
            }
        );
        return () => api.interceptors.response.eject(interceptor);
    }, []);

    const checkAuth = async () => {
        try {
            // Try to get current user info
            const response = await api.get('/auth/me');
            setUser(response.data);

            // Get CSRF token
            const csrfResponse = await api.get('/auth/csrf');
            setCsrfToken(csrfResponse.data.csrf_token);
        } catch (error) {
            console.log("Not authenticated or session expired");
            setUser(null);
            setCsrfToken(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        // Use URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        try {
            const response = await api.post('/auth/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            // Token is now in httpOnly cookie, we just get CSRF token
            setCsrfToken(response.data.csrf_token);

            // Fetch user info
            const userResponse = await api.get('/auth/me');
            setUser(userResponse.data);

            return { success: true };
        } catch (error) {
            console.error("Login failed", error);
            return { success: false, error: error.response?.data?.message || "Login failed" };
        }
    };

    const register = async (username, password) => {
        try {
            const response = await api.post('/auth/register', {
                username,
                password
            });

            // Token is now in httpOnly cookie
            setCsrfToken(response.data.csrf_token);

            // Fetch user info
            const userResponse = await api.get('/auth/me');
            setUser(userResponse.data);

            return { success: true };
        } catch (error) {
            console.error("Registration failed", error);
            return { success: false, error: error.response?.data?.message || error.response?.data?.detail || "Registration failed" };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error("Logout request failed", error);
        } finally {
            setUser(null);
            setCsrfToken(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading, csrfToken }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

