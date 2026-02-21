import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Download, BarChart2, Users, UserCheck, Calendar, IndianRupee } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Type definitions
interface AnalyticsData {
    totalUsers: number;
    totalVendors: number;
    totalBookings: number;
    completedBookings: number;
    totalRevenue: number;
    monthlyBookings: { _id: { year: number, month: number }, count: number }[];
}

export const AdminAnalytics: React.FC = () => {
    const { token } = useAuth();
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAnalyticsData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/analytics', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch analytics data');
            const data = await response.json();
            setAnalytics(data);
        } catch (error) {
            toast.error('Could not load analytics data.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchAnalyticsData();
    }, [fetchAnalyticsData]);

    const downloadCSV = () => {
        if (!analytics) return;

        const headers = ['Metric', 'Value'];
        const rows = [
            ['Total Users', analytics.totalUsers],
            ['Total Vendors', analytics.totalVendors],
            ['Total Bookings', analytics.totalBookings],
            ['Completed Bookings', analytics.completedBookings],
            ['Total Revenue (INR)', analytics.totalRevenue],
        ];

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
        
        csvContent += "\n\nMonthly Bookings\nMonth,Year,Count\n";
        analytics.monthlyBookings.forEach(item => {
            csvContent += `${item._id.month},${item._id.year},${item.count}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "platform_analytics.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const maxMonthlyCount = analytics ? Math.max(...analytics.monthlyBookings.map(b => b.count), 0) : 0;

    if (isLoading) {
        return <div className="p-8 text-center">Loading analytics...</div>;
    }

    if (!analytics) {
        return <div className="p-8 text-center text-red-500">Failed to load analytics data.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Platform Analytics</h1>
                    <button
                        onClick={downloadCSV}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Download className="h-5 w-5" />
                        <span>Download CSV</span>
                    </button>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Total Customers</p><p className="text-3xl font-bold text-gray-800">{analytics.totalUsers.toLocaleString()}</p></div><div className="bg-blue-100 p-3 rounded-full"><Users className="h-6 w-6 text-blue-600" /></div></div></div>
                    <div className="bg-white p-6 rounded-xl shadow-lg"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Total Vendors</p><p className="text-3xl font-bold text-gray-800">{analytics.totalVendors.toLocaleString()}</p></div><div className="bg-green-100 p-3 rounded-full"><UserCheck className="h-6 w-6 text-green-600" /></div></div></div>
                    <div className="bg-white p-6 rounded-xl shadow-lg"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Total Bookings</p><p className="text-3xl font-bold text-gray-800">{analytics.totalBookings.toLocaleString()}</p></div><div className="bg-purple-100 p-3 rounded-full"><Calendar className="h-6 w-6 text-purple-600" /></div></div></div>
                    <div className="bg-white p-6 rounded-xl shadow-lg"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Total Revenue</p><p className="text-3xl font-bold text-gray-800">{analytics.totalRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p></div><div className="bg-orange-100 p-3 rounded-full"><IndianRupee className="h-6 w-6 text-orange-600" /></div></div></div>
                </div>

                {/* Monthly Bookings Chart */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                        <BarChart2 className="mr-2 text-blue-600" />
                        Monthly Bookings
                    </h2>
                    {analytics.monthlyBookings.length > 0 ? (
                        <div className="flex items-end h-64 space-x-2 md:space-x-4 border-b border-gray-200 pb-4">
                            {analytics.monthlyBookings.map(item => (
                                <div key={`${item._id.year}-${item._id.month}`} className="flex-1 flex flex-col items-center group">
                                    <div className="text-xs font-bold text-gray-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</div>
                                    <div 
                                        className="w-full bg-blue-400 hover:bg-blue-500 transition-colors rounded-t-lg"
                                        style={{ height: `${(item.count / (maxMonthlyCount || 1)) * 100}%` }}
                                        title={`${item.count} bookings`}
                                    ></div>
                                    <div className="text-xs font-medium text-gray-500 mt-2 text-center">
                                        {monthNames[item._id.month - 1]} '{String(item._id.year).slice(-2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-10">No monthly booking data available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};