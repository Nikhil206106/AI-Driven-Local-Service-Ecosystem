import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {Calendar, User, Briefcase, ExternalLink, ShieldAlert, MessageSquare, X } from 'lucide-react';

interface DisputedBooking {
  _id: string;
  service: {
    _id: string;
    title: string;
  };
  customer: {
    _id: string;
    name: string;
    email: string;
  };
  vendor: {
    _id: string;
    businessName: string;
    user: {
      _id: string;
      name: string;
      email: string;
    };
  };
  dispute?: {
    raisedBy: {
      _id: string;
      name: string;
      role: 'customer' | 'vendor';
    };
    reason: string;
    description: string;
    createdAt: string;
  };
  scheduledDate: string;
  status: string;
}

export const AdminDisputes = () => {
  const { token, logout } = useAuth();
  const [disputes, setDisputes] = useState<DisputedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution Modal State
  const [resolvingBooking, setResolvingBooking] = useState<DisputedBooking | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [finalStatus, setFinalStatus] = useState<'completed' | 'cancelled'>('completed');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  const fetchDisputes = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/disputes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        toast.error("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch disputes.');
      }

      const data = await response.json();
      setDisputes(data);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching disputes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleResolveDispute = async () => {
    if (!resolvingBooking || !resolutionNotes) {
      toast.error('Please provide resolution notes.');
      return;
    }
    setIsSubmittingResolution(true);
    try {
      const response = await fetch(`/api/admin/disputes/${resolvingBooking._id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resolution: resolutionNotes, finalStatus })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resolve dispute.');
      }

      toast.success('Dispute resolved successfully.');
      handleCloseModal();
      fetchDisputes(); // Refresh the list
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const handleOpenModal = (booking: DisputedBooking) => {
    setResolvingBooking(booking);
  };

  const handleCloseModal = () => {
    setResolvingBooking(null);
    setResolutionNotes('');
    setFinalStatus('completed');
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading disputes...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Dispute Management</h1>
            <p className="text-gray-600">Review and resolve issues raised by customers and vendors.</p>
          </div>

          {disputes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Open Disputes</h3>
              <p className="text-gray-600">There are no bookings with a 'reported' status.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {disputes.map((booking) => (
                <div key={booking._id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Booking ID: {booking._id}</p>
                        <h3 className="text-xl font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                          <Link to={`/services/${booking.service._id}`}>{booking.service.title}</Link>
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-pink-100 text-pink-800 capitalize">
                          {booking.status.replace('-', ' ')}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">
                          <Calendar className="inline h-4 w-4 mr-1" />
                          {new Date(booking.scheduledDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg mb-6">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ShieldAlert className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-bold text-red-900">{booking.dispute?.reason || 'No reason provided'}</p>
                          <p className="mt-1 text-sm text-red-800">{booking.dispute?.description || 'No description provided.'}</p>
                          {booking.dispute?.raisedBy && (
                            <p className="mt-2 text-xs text-gray-500">
                              Raised by {booking.dispute.raisedBy.role} ({booking.dispute.raisedBy.name}) on {new Date(booking.dispute.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm mb-6">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-semibold text-gray-700 flex items-center"><User className="h-4 w-4 mr-2" />Customer</p>
                        <p>{booking.customer.name}</p>
                        <p className="text-gray-500">{booking.customer.email}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-semibold text-gray-700 flex items-center"><Briefcase className="h-4 w-4 mr-2" />Vendor</p>
                        <p>{booking.vendor.businessName}</p>
                        <p className="text-gray-500">{booking.vendor.user.email}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-end space-x-3">
                      <Link to={`/bookings/${booking._id}`} className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                        <ExternalLink className="h-4 w-4" />
                        <span>View Booking</span>
                      </Link>
                      <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                        <MessageSquare className="h-4 w-4" />
                        <span>Message Parties</span>
                      </button>
                      <button
                        onClick={() => handleOpenModal(booking)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Resolve Dispute
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resolution Modal */}
      {resolvingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Resolve Dispute</h2>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-3 mb-3">
                    <ShieldAlert className="h-6 w-6 text-yellow-600" />
                    <div>
                      <p className="font-semibold text-yellow-800">{resolvingBooking.dispute?.reason || 'No reason provided'}</p>
                      {resolvingBooking.dispute?.raisedBy && (
                        <p className="text-sm text-yellow-700">
                          Raised by {resolvingBooking.dispute.raisedBy.name} ({resolvingBooking.dispute.raisedBy.role})
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-700 italic">"{resolvingBooking.dispute?.description || 'No description provided'}"</p>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-800 mb-2">Admin Action</h3>
                  <div>
                    <label htmlFor="resolutionNotes" className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                    <textarea
                      id="resolutionNotes"
                      rows={4}
                      value={resolutionNotes}
                      onChange={e => setResolutionNotes(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe the decision and any actions taken (e.g., refund issued, payment released)."
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Set Final Booking Status</label>
                    <select
                      value={finalStatus}
                      onChange={e => setFinalStatus(e.target.value as 'completed' | 'cancelled')}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="completed">Completed (Release payment to vendor)</option>
                      <option value="cancelled">Cancelled (Refund customer)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3"><button onClick={handleCloseModal} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100">Cancel</button><button onClick={handleResolveDispute} disabled={isSubmittingResolution} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmittingResolution ? 'Saving...' : 'Save Resolution'}</button></div>
          </div>
        </div>
      )}
    </>
  );
}