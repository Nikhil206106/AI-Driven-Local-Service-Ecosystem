import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Calendar, MessageSquare,
  IndianRupee, 
  Star, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  Plus,
  AlertCircle
} from 'lucide-react';

interface VendorStats {
  activeBookings: number;
  completedServices: number;
  totalRevenue: number;
  avgRating: number;
}

interface RecentBooking {
  _id: string;
  customer: {
    name: string;
  };
  service: {
    title: string;
  };
  scheduledDate: string;
  status: string;
  price: {
    amount: number;
  };
}

interface RecentReview {
  _id: string;
  customer: {
    name: string;
  };
  rating: {
    score: number;
    review: string;
  };
}

export const VendorDashboard = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const quickActions = [
    {
      title: 'View Bookings',
      description: 'Manage service requests',
      icon: <Calendar className="h-6 w-6" />,
      link: '/my-bookings',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Add Service',
      description: 'List new services',
      icon: <Plus className="h-6 w-6" />,
      link: '/vendor-profile',
      color: 'bg-purple-600 hover:bg-purple-700'
    }
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/vendors/dashboard-stats', { // Updated endpoint
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        const data = await response.json();
        setStats(data.stats);
        setRecentBookings(data.recentBookings || []);
        setRecentReviews(data.recentReviews || []); // Safely set to empty array if undefined
      } catch (error) {
        console.error('Error fetching vendor dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [token]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Verification Status Banner */}
        {user?.role === 'vendor' && !user.isVerified && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded-r-lg shadow-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  Your account is <span className="font-bold">pending verification</span>. 
                  You will not be able to create services and your profile will not be visible to customers until an admin approves your account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600">
            Manage your services and track your business performance
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Bookings</p>
                <p className="text-3xl font-bold text-gray-800">{stats?.activeBookings ?? 0}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-800">₹{(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed Services</p>
                <p className="text-3xl font-bold text-gray-800">{stats?.completedServices ?? 0}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Average Rating</p>
                <p className="text-3xl font-bold text-gray-800">{stats?.avgRating?.toFixed(1) ?? 'N/A'}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions & Recent Bookings */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {quickActions.map((action, index) => (
                  <Link
                    key={index}
                    to={action.link}
                    className={`${action.color} text-white p-6 rounded-xl hover:shadow-lg transition-all transform hover:-translate-y-1 group`}
                  >
                    <div className="flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      {action.icon}
                    </div>
                    <h3 className="font-semibold text-center mb-2">{action.title}</h3>
                    <p className="text-sm opacity-90 text-center">{action.description}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Recent Bookings</h2>
                <Link
                  to="/my-bookings"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View All
                </Link>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Service</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.length > 0 ? recentBookings.map((booking) => (
                      <tr key={booking._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-800">{booking.customer.name}</div>
                        </td>
                        <td className="py-4 px-4 text-gray-600">{booking.service.title}</td>
                        <td className="py-4 px-4 text-gray-600">{new Date(booking.scheduledDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-gray-800">₹{booking.price.amount}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">No recent bookings found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Reviews */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Recent Reviews</h2>
            <div className="space-y-6">
              {recentReviews.length > 0 ? recentReviews.map(review => (
                <div key={review._id} className="flex items-start space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full">
                    <MessageSquare className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800">{review.customer.name}</p>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-bold">{review.rating.score}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 italic mt-1">"{review.rating.review}"</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No reviews with comments yet.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};