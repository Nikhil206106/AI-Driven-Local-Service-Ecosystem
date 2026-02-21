import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// ... (Interface definitions for User, RegisterData, AuthContextType remain the same) ...
export interface User {
    id: string;
    name: string;
    email: string;
    role: 'customer' | 'vendor' | 'admin';
    isVerified: boolean;
    isActive: boolean;
}

interface RegisterData {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: 'customer' | 'vendor' | 'admin';
    businessName?: string;
    serviceCategories?: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<User>;
    register: (data: RegisterData) => Promise<User>;
    logout: () => void;
    isLoading: boolean;
    socket: Socket | null;
    isConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // --- EFFECT: Load state on mount ---
    useEffect(() => {
        // Unify token loading. There is only one user logged in at a time.
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error("Failed to parse user data from localStorage", error);
            }
        }

        setIsLoading(false);
    }, []);

    // --- EFFECT: Manage Socket.IO connection ---
    useEffect(() => {
        // Initialize socket connection only once
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        const newSocket = io(API_URL, { 
            autoConnect: false // Do not connect automatically
        });
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Socket.IO: Connected successfully with ID:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', (reason) => {
            console.warn('Socket.IO: Disconnected. Reason:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket.IO: Connection Error.', error);
            setIsConnected(false);
        });

        // Cleanup on component unmount
        return () => {
            newSocket.disconnect();
        };
    }, []); // Empty dependency array ensures this runs only once

    useEffect(() => {
        if (socket && token && user) {
            socket.auth = { token, role: user.role };
            socket.connect();
        } else if (socket) {
            socket.disconnect();
        }
    }, [socket, token, user]); // This effect manages connection state

    const handleError = async (response: Response, defaultMsg: string) => {
        let message = defaultMsg;
        try {
            const error = await response.json();
            message = error.error || message;
        } catch {
            // ignore non-JSON
        }
        throw new Error(message);
    };

    // --- LOGIN FUNCTION (Where the fix is applied) ---
    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) await handleError(response, 'Login failed');

            const data = await response.json();
            
            // Assuming your backend returns data.user which includes data.user.role
            const loggedInUser: User = data.user; 
            const newToken: string = data.token;

            setUser(loggedInUser);
            setToken(newToken);

            // Always use the same keys for token and user, regardless of role.
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(loggedInUser));

            // Clean up old, fragmented keys just in case.
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');

            return loggedInUser;

        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData: RegisterData): Promise<User> => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });

            if (!response.ok) await handleError(response, 'Registration failed');

            const data = await response.json();
            const registeredUser: User = data.user;
            const newToken: string = data.token;
            
            setUser(registeredUser);
            setToken(newToken);

            // For simplicity, registration for non-admin uses the generic keys
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(registeredUser));

            return registeredUser;
            
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        // Clear the unified token and user from storage.
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const value: AuthContextType = {
        user,
        token,
        login,
        register,
        logout,
        isLoading,
        socket,
        isConnected,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};