import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Filter, 
  Eye, 
  XCircle, 
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Booking {
  _id: string;
  service: {
    title: string;
    category: string;
  } | null;
  vendor: {
    businessName: string;
    user: {
      name: string;
      email: string;
      phone: string;
    };
  } | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  } | null;
  scheduledDate: string;
  status: string;
  price: {
    amount: number;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
  createdAt: string;
}

interface BookingResponse {
  bookings: Booking[];
  totalPages: number;
  currentPage: number;
}

export const AdminBookings = () => {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal/Details state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        status: statusFilter
      });

      const response = await fetch(`/api/admin/bookings?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');

      const data: BookingResponse = await response.json();
      setBookings(data.bookings);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Error loading bookings');
    } finally {
      setIsLoading(false);
    }
  }, [token, currentPage, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }
      
      toast.success(`Booking status updated to ${newStatus}.`);
      // Refresh list
      fetchBookings();
      if (selectedBooking?._id === bookingId) {
        setSelectedBooking(null); // Close modal if open
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in-progress': return 'bg-purple-100 text-purple-800';
      case 'verification-pending': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Booking Management</h1>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center space-x-4">
          <Filter className="text-gray-400 h-5 w-5" />
          <select 
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in-progress">In Progress</option>
            <option value="verification-pending">Verification Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {isLoading ? (
             <div className="p-8 text-center">Loading...</div>
          ) : error ? (
             <div className="p-8 text-center text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID / Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{booking._id?.slice(-6)}</div>
                        <div className="text-sm text-gray-500">{new Date(booking.scheduledDate).toLocaleDateString('en-GB')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{booking.service?.title || 'Service Unavailable'}</div>
                        <div className="text-xs text-gray-500 capitalize">{booking.service?.category || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{booking.customer?.name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{booking.customer?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{booking.vendor?.businessName || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{booking.vendor?.user?.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₹{booking.price?.amount ?? 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => setSelectedBooking(booking)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-4 flex justify-between items-center">
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border rounded-md disabled:opacity-50"
            >
                Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border rounded-md disabled:opacity-50"
            >
                Next
            </button>
        </div>

        {/* Detail Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
                <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Service Info</h3>
                  <p className="text-lg font-medium">{selectedBooking.service?.title || 'Service Unavailable'}</p>
                  <p className="text-gray-600 capitalize">{selectedBooking.service?.category || 'N/A'}</p>
                  <p className="text-blue-600 font-bold mt-1">₹{selectedBooking.price?.amount ?? 0}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Schedule</h3>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(selectedBooking.scheduledDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600 mt-1">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(selectedBooking.scheduledDate).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Customer</h3>
                  <p className="font-medium">{selectedBooking.customer?.name}</p>
                  <div className="flex items-center space-x-2 text-gray-600 text-sm mt-1">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${selectedBooking.customer?.email}`}>{selectedBooking.customer?.email}</a>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600 text-sm mt-1">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${selectedBooking.customer?.phone}`}>{selectedBooking.customer?.phone}</a>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Vendor</h3>
                  <p className="font-medium">{selectedBooking.vendor?.businessName}</p>
                  <p className="text-sm text-gray-500">{selectedBooking.vendor?.user?.name}</p>
                  <div className="flex items-center space-x-2 text-gray-600 text-sm mt-1">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${selectedBooking.vendor?.user?.phone}`}>{selectedBooking.vendor?.user?.phone}</a>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <h3 className="font-semibold text-gray-700 mb-2">Location</h3>
                  <div className="flex items-start space-x-2 text-gray-600">
                    <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>
                      {selectedBooking.address?.street}, {selectedBooking.address?.city}, {selectedBooking.address?.zipCode}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-700 mb-4">Manage Status</h3>
                <div className="flex flex-wrap gap-3">
                  {selectedBooking.status === 'pending' && (
                    <button 
                      onClick={() => {
                        if (window.confirm('Confirm this booking? The customer and vendor will be notified.')) {
                          handleStatusUpdate(selectedBooking._id, 'confirmed');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Confirm Booking
                    </button>
                  )}
                  {selectedBooking.status === 'confirmed' && (
                    <button 
                      onClick={() => handleStatusUpdate(selectedBooking._id, 'in-progress')}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Mark as In Progress
                    </button>
                  )}
                  {selectedBooking.status === 'in-progress' && (
                    <button 
                      onClick={() => handleStatusUpdate(selectedBooking._id, 'verification-pending')}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      Mark as Awaiting OTP
                    </button>
                  )}
                  {selectedBooking.status === 'verification-pending' && (
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to force complete this booking? This will bypass OTP verification and release payment to the vendor.')) {
                          handleStatusUpdate(selectedBooking._id, 'completed');
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Force Complete (Skip OTP)
                    </button>
                  )}
                  {/* Generic Admin Cancel Action */}
                  {!['completed', 'cancelled', 'rejected'].includes(selectedBooking.status) && (
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to force cancel this booking? This will refund the customer.')) {
                          handleStatusUpdate(selectedBooking._id, 'cancelled');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle size={16} />
                      Force Cancel
                    </button>
                  )}
                  {['completed', 'cancelled', 'rejected'].includes(selectedBooking.status) && (
                    <span className="text-gray-500 italic">No actions available for {selectedBooking.status} bookings.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};