import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Calendar, MapPin, Star, Clock, IndianRupee } from 'lucide-react';

interface UpcomingBooking {
  _id: string;
  service: {
    title: string;
  };
  vendor: {
    businessName: string;
  };
  scheduledDate: string;
  status: string;
}

const getStatusColor = (status: string) => {
  if (status === 'confirmed') return 'bg-blue-600 text-white';
  if (status === 'pending') return 'bg-yellow-500 text-white';
  return 'bg-gray-500 text-white';
};

export const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeBookings: 0,
    completedServices: 0,
    totalSpent: 0,
    avgRating: 0
  });
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);

  const quickActions = [
    {
      title: 'Find Services',
      description: 'Browse local service providers',
      icon: <MapPin className="h-6 w-6" />,
      link: '/services',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'My Bookings',
      description: 'View your service bookings',
      icon: <Calendar className="h-6 w-6" />,
      link: '/my-bookings',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Browse Categories',
      description: 'Explore service categories',
      icon: <Star className="h-6 w-6" />,
      link: '/services',
      color: 'bg-purple-600 hover:bg-purple-700'
    }
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, bookingsRes] = await Promise.all([
          fetch('/api/dashboard/customer', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/bookings?view=upcoming', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (statsRes.status === 401 || bookingsRes.status === 401) {
          logout();
          toast.error("Session expired. Please log in again.");
          return;
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats);
        }

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          // The backend now returns only upcoming bookings. We just need to sort and slice.
          const upcoming: UpcomingBooking[] = bookingsData
            .sort((a: UpcomingBooking, b: UpcomingBooking) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
            .slice(0, 2); // Take top 2
          setUpcomingBookings(upcoming);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token, logout]);

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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600">
            Find local service providers and manage your bookings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Bookings</p>
                <p className="text-3xl font-bold text-gray-800">{stats.activeBookings}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed Services</p>
                <p className="text-3xl font-bold text-gray-800">{stats.completedServices}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Star className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-3xl font-bold text-gray-800">₹{Number(stats.totalSpent).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <IndianRupee className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Rating</p>
                <p className="text-3xl font-bold text-gray-800">{stats.avgRating || '-'}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
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

            {/* Upcoming Bookings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Upcoming Bookings</h2>
                <Link
                  to="/my-bookings"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View All
                </Link>
              </div>
              
              <div className="space-y-4">
                {upcomingBookings.length > 0 ? (
                  upcomingBookings.map(booking => (
                    <div key={booking._id} className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
                      <div className="bg-blue-600 p-3 rounded-full">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">{booking.service.title}</h3>
                        <p className="text-sm text-gray-600">{new Date(booking.scheduledDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        <p className="text-sm text-gray-500">{booking.vendor.businessName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`${getStatusColor(booking.status)} px-3 py-1 rounded-full text-sm capitalize`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No upcoming bookings.</p>
                    <Link to="/services" className="text-blue-600 font-medium">Book a service</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Need Help?</h2>
            <div className="space-y-4 text-center">
              <p className="text-gray-600">Visit our help center or contact support for any questions.</p>
              <button className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium">Help Center</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};