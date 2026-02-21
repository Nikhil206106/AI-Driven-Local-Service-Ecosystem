import React, { useState, useEffect, useCallback } from 'react';
// Import necessary icons
import { Users, UserCheck, Calendar, IndianRupee, TrendingUp, Activity, RefreshCw, Layers, AlertCircle, AlertTriangle } from 'lucide-react';
// Import routing hooks for navigation actions
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

// ===============================================
// 1. TYPE DEFINITIONS
// ===============================================

// Interface for the main analytics data structure
interface AnalyticsData {
    totalUsers: number;
    totalVendors: number;
    totalBookings: number;
    completedBookings: number;
    totalRevenue: number;
    monthlyBookings: { month: string; count: number }[];
}

// Interface for a single recent activity item
interface ActivityItem {
    type: 'user' | 'vendor' | 'booking' | 'report'; // Union type for activity type
    message: string;
    time: string;
    status: 'success' | 'warning' | 'error'; // Union type for status
}

// Interface for quick stat cards (data is derived, but typing helps)
interface QuickStat {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    change: string;
}

// ===============================================
// 2. API CONFIGURATION
// ===============================================
const API_BASE_URL = '/api/admin'; 

// --- Initial state for loading ---
const initialAnalyticsState: AnalyticsData = {
    totalUsers: 0,
    totalVendors: 0,
    totalBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    monthlyBookings: []
};

// --- Helper: Format Time Ago ---
const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

export const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { token, logout, socket, isConnected } = useAuth();
    const [analytics, setAnalytics] = useState<AnalyticsData>(initialAnalyticsState);
    const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRedirecting, setIsRedirecting] = useState<boolean>(false); // New state for managing redirect
    const [error, setError] = useState<string | null>(null);

    // --- Data Fetching Function ---
    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        if (!token) {
            setError("Authentication token missing. Redirecting to login...");
            setIsLoading(false);
            setIsRedirecting(true);
            
            // 🛑 FIX: Redirect to the generic /login route based on your file structure
            setTimeout(() => {
                navigate('/login');
            }, 1500);

            return;
        }

        try {
            // 1. Fetch Analytics
            const response = await fetch(`${API_BASE_URL}/analytics`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                }
            });

            if (!response.ok) {
                // Handle 401/403 specifically (Expired/Invalid Token)
                if (response.status === 401 || response.status === 403) {
                    logout(); // Use context logout to clear state
                    setError("Session expired or token invalid. Please log in again.");
                    setIsRedirecting(true);
                    // 🛑 FIX: Redirect to the generic /login route
                    setTimeout(() => {
                        navigate('/login'); 
                    }, 1500);
                    return; // Stop further execution
                }

                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch analytics: ${response.status}`);
            }

            // Cast response to the defined interface
            const data: AnalyticsData = await response.json();
            setAnalytics(data);

            // 2. Fetch Recent Activities (Non-blocking for main dashboard)
            try {
                const activitiesResponse = await fetch(`${API_BASE_URL}/activities?limit=5`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (activitiesResponse.ok) {
                    const actData = await activitiesResponse.json();
                    const activities = actData.activities || [];
                    setRecentActivities(activities.map((item: any) => ({
                        type: item.type,
                        message: item.message,
                        time: formatTimeAgo(item.createdAt),
                        status: item.status
                    })));
                }
            } catch (actErr) {
                console.warn("Failed to fetch activities:", actErr);
            }

        } catch (err: any) {
            console.error("Error fetching analytics data:", err.message);
            setError(`Failed to load real-time data. Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [navigate, token, logout]); // navigate added to dependency array


    // --- Side Effect: Fetch data on mount ---
    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    // --- Side Effect for Real-time Report Notifications ---
    useEffect(() => {
        if (socket && isConnected) {
            const handleNewDispute = (data: { bookingId: string; reason: string; raisedBy: { name: string; role: string; }}) => {
                toast.custom(
                    (t) => (
                        <div
                            className={`${
                                t.visible ? 'animate-enter' : 'animate-leave'
                            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                        >
                            <div className="flex-1 w-0 p-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 pt-0.5">
                                        <AlertTriangle className="h-6 w-6 text-yellow-500" />
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            New Dispute Raised
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {data.raisedBy.name} raised a dispute: "{data.reason}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex border-l border-gray-200">
                                <button
                                    onClick={() => { navigate(`/admin/disputes`); toast.dismiss(t.id); }}
                                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    Review
                                </button>
                            </div>
                        </div>
                    ),
                    { duration: 10000 } // Keep it on screen for 10 seconds
                );
            };

            socket.on('new-dispute', handleNewDispute);

            return () => {
                socket.off('new-dispute', handleNewDispute);
            };
        }
    }, [socket, isConnected, navigate]);


    // --- Derived State for Quick Stats (Uses the data fetching result) ---
    const quickStats: QuickStat[] = [
        {
            title: 'Total Customers',
            value: analytics.totalUsers.toLocaleString(),
            icon: <Users className="h-8 w-8" />,
            color: 'bg-blue-600',
            change: '+12% (30d)'
        },
        {
            title: 'Active Vendors',
            value: analytics.totalVendors.toLocaleString(),
            icon: <UserCheck className="h-8 w-8" />,
            color: 'bg-green-600',
            change: '+8% (30d)'
        },
        {
            title: 'Total Bookings',
            value: analytics.totalBookings.toLocaleString(),
            icon: <Calendar className="h-8 w-8" />,
            color: 'bg-purple-600',
            change: '+25% (30d)'
        },
        {
            title: 'Platform Revenue',
            // 💰 INDIAN CURRENCY FIX: Use 'en-IN' locale for Rupee symbol and Indian numbering format
            value: analytics.totalRevenue.toLocaleString('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }),
            icon: <IndianRupee className="h-8 w-8" />,
            color: 'bg-orange-600',
            change: '+18% (30d)'
        }
    ];

    // --- Helper Functions (Remain the same) ---
    const getActivityIcon = (type: ActivityItem['type']): React.ReactNode => {
        switch (type) {
            case 'user':
                return <Users className="h-5 w-5" />;
            case 'vendor':
                return <UserCheck className="h-5 w-5" />;
            case 'booking':
                return <Calendar className="h-5 w-5" />;
            case 'report':
                return <AlertCircle className="h-5 w-5" />;
            default:
                return <Activity className="h-5 w-5" />;
        }
    };

    const getStatusColor = (status: ActivityItem['status']): string => {
        switch (status) {
            case 'success':
                return 'text-green-600 bg-green-50';
            case 'warning':
                return 'text-yellow-600 bg-yellow-50';
            case 'error':
                return 'text-red-600 bg-red-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };

    // --- Render Loading State ---
    if (isLoading || isRedirecting) {
        return <div className="p-8 text-center text-gray-600">
            {error ? error : "Loading dashboard data..."}
        </div>;
    }

    // --- JSX Rendering ---
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
                        <p className="text-gray-600">Monitor platform performance and manage users</p>
                    </div>
                    <button 
                        onClick={fetchAnalytics} 
                        className="flex items-center space-x-1 p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                </div>
                
                {/* Error Banner */}
                {error && (
                    <div className="mb-6 p-3 bg-yellow-100 text-yellow-800 rounded-lg font-medium">
                        {error}
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {quickStats.map((stat, index) => (
                        <div key={index} className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">{stat.title}</p>
                                    <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                                    <p className="text-sm text-green-600 font-medium mt-1">{stat.change}</p>
                                </div>
                                <div className={`${stat.color} p-3 rounded-full text-white`}>
                                    {stat.icon}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Platform Overview & Quick Actions */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Platform Overview */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Platform Overview</h2>
                            
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                    <div className="text-3xl font-bold text-blue-600 mb-2">
                                        {((analytics.completedBookings / analytics.totalBookings) * 100 || 0).toFixed(1)}%
                                    </div>
                                    <p className="text-sm text-gray-600">Completion Rate</p>
                                </div>
                                
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                    <div className="text-3xl font-bold text-green-600 mb-2">4.8</div>
                                    <p className="text-sm text-gray-600">Avg Platform Rating</p>
                                </div>
                                
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                    <div className="text-3xl font-bold text-purple-600 mb-2">95%</div>
                                    <p className="text-sm text-gray-600">Vendor Verification</p>
                                </div>
                            </div>
                        </div>

                        {/* Management Actions */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Quick Management</h2>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => navigate('/admin/users')}
                                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-blue-100 p-2 rounded-full">
                                            <Users className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-800">Manage Roles</p>
                                            <p className="text-sm text-gray-500">View all Users</p>
                                        </div>
                                    </div>
                                    <span className="text-blue-600">→</span>
                                </button>

                                <button 
                                    onClick={() => navigate('/admin/vendors')}
                                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-green-100 p-2 rounded-full">
                                            <UserCheck className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-800">Manage Vendors</p>
                                            <p className="text-sm text-gray-500">Verify providers</p>
                                        </div>
                                    </div>
                                    <span className="text-green-600">→</span>
                                </button>

                                <button 
                                    onClick={() => navigate('/admin/bookings')}
                                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-purple-100 p-2 rounded-full">
                                            <Calendar className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-800">View Bookings</p>
                                            <p className="text-sm text-gray-500">Monitor services</p>
                                        </div>
                                    </div>
                                    <span className="text-purple-600">→</span>
                                </button>

                                <button 
                                    onClick={() => navigate('/admin/analytics')}
                                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-orange-100 p-2 rounded-full">
                                            <TrendingUp className="h-5 w-5 text-orange-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-800">Performance Analytics</p>
                                            <p className="text-sm text-gray-500">View charts & reports</p>
                                        </div>
                                    </div>
                                    <span className="text-orange-600">→</span>
                                </button>

                                <button 
                                    onClick={() => navigate('/admin/categories')}
                                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-teal-100 p-2 rounded-full">
                                            <Layers className="h-5 w-5 text-teal-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-800">Categories</p>
                                            <p className="text-sm text-gray-500">Manage service types</p>
                                        </div>
                                    </div>
                                    <span className="text-teal-600">→</span>
                                </button>

                                <button 
                                    onClick={() => navigate('/admin/disputes')}
                                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-red-100 p-2 rounded-full">
                                            <AlertCircle className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-800">Manage Disputes</p>
                                            <p className="text-sm text-gray-500">Resolve customer issues</p>
                                        </div>
                                    </div>
                                    <span className="text-red-600">→</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-6">Recent Activity</h2>
                        <div className="space-y-4">
                            {recentActivities.map((activity, index) => (
                                <div key={index} className={`flex items-start space-x-3 p-3 rounded-lg ${getStatusColor(activity.status)}`}>
                                    <div className="mt-1">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-800">{activity.message}</p>
                                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={() => navigate('/admin/activities')}
                            className="w-full mt-4 text-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                            View All Activities
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};