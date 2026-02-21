import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, Star, User, Briefcase, Edit, Save, X, AlertCircle, Phone, Mail, IndianRupee, ShieldCheck, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Booking {
  _id: string;
  service: {
    _id: string;
    title: string;
    category: string;
  };
  vendor: {
    _id: string;
    businessName: string;
    user: {
      _id: string;
      name: string;
      phone: string;
      email: string;
    };
  };
  customer: {
    _id: string;
    name: string;
    phone: string;
    email: string;
  };
  scheduledDate: string;
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
  status: string;
  price: {
    amount: number;
  };
  payment?: {
    status: string;
    notes?: string;
  };
  notes: {
    customerNotes?: string;
    vendorNotes?: string;
  };
  timeline: {
    status: string;
    note: string;
    timestamp: string;
  }[];
  report?: {
    reason: string;
    description: string;
    status: 'open' | 'resolved';
    raisedBy?: {
      name: string;
      role: string;
    };
  };
  otp?: string; // Added for consistency
  createdAt: string;
}

export const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    date: '',
    time: '',
    address: { street: '', city: '', zipCode: '' },
    notes: ''
  });
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // State for OTP verification modal
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);


  const fetchBooking = useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Booking not found or you do not have permission to view it.');
      }
      const data: Booking = await response.json();
      setBooking(data);
      // Initialize edit form data
      const scheduled = new Date(data.scheduledDate);
      setEditData({
        date: scheduled.toISOString().split('T')[0],
        time: scheduled.toTimeString().split(' ')[0].substring(0, 5),
        address: data.address,
        notes: data.notes?.customerNotes || ''
      });
    } catch (error: any) {
      toast.error(error.message);
      navigate('/my-bookings');
    } finally {
      setIsLoading(false);
    }
  }, [id, token, navigate]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Effect to fetch OTP for the customer if the booking is pending verification
  useEffect(() => {
    const fetchOtp = async () => {
      if (booking && user?.role === 'customer' && booking.status === 'verification-pending' && !booking.otp && token) {
        try {
          const response = await fetch(`/api/bookings/${booking._id}/otp`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            // Use a functional update to avoid stale state issues
            setBooking(prev => prev ? { ...prev, otp: data.otp } : null);
          }
        } catch (error) {
          console.error(`Failed to fetch OTP for booking ${booking._id}:`, error);
        }
      }
    };

    fetchOtp();
  }, [booking, user, token]);

  const handleSaveChanges = async () => {
    if (!booking) return;

    const scheduledDate = new Date(`${editData.date}T${editData.time}`);
    if (isNaN(scheduledDate.getTime())) {
      toast.error('Invalid date or time.');
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${booking._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduledDate: scheduledDate.toISOString(),
          address: editData.address,
          notes: editData.notes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes.');
      }

      toast.success('Booking updated successfully!');
      setIsEditing(false);
      fetchBooking(); // Refetch to show updated data
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReportSubmit = async () => {
    if (!booking || !reportReason || !reportDescription) {
        toast.error('Please provide a reason and a detailed description.');
        return;
    }
    setIsSubmittingReport(true);
    try {
        const response = await fetch(`/api/bookings/${booking._id}/report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason: reportReason, description: reportDescription })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to report issue.');
        }

        toast.success('Issue reported successfully. An admin will review it shortly.');
        setIsReporting(false);
        setReportReason('');
        setReportDescription('');
        fetchBooking(); // Refetch to show updated status

    } catch (error: any) {
        toast.error(`Error: ${error.message}`);
    } finally {
        setIsSubmittingReport(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string, otp?: string) => {
    if (!booking || isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    try {
      const body: any = { status: newStatus };
      if (otp) body.otp = otp;

      const response = await fetch(`/api/bookings/${booking._id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      toast.success('Booking status updated!');
      
      if (isVerifying) {
        setIsVerifying(false);
        setOtpInput('');
      }
      
      fetchBooking(); // Refetch to show updated data
    } catch (error: any) {
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const canEdit = user && booking && (user.role === 'customer' && user.id === booking.customer._id) && ['pending', 'confirmed'].includes(booking.status);

  if (isLoading) return <div className="p-8 text-center">Loading booking details...</div>;
  if (!booking) return <div className="p-8 text-center">Booking not found.</div>;

  const renderField = (label: string, value: React.ReactNode, icon: React.ReactNode, isEditable: boolean, fieldName: string, subFields?: string[]) => {
    if (isEditing && isEditable) {
      if (fieldName === 'scheduledDate') {
        return (
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} className="w-full p-2 border rounded" />
            <input type="time" value={editData.time} onChange={e => setEditData(p => ({ ...p, time: e.target.value }))} className="w-full p-2 border rounded" />
          </div>
        );
      }
      if (fieldName === 'address' && subFields) {
        return (
          <div className="space-y-2">
            <input type="text" placeholder="Street" value={editData.address.street} onChange={e => setEditData(p => ({ ...p, address: { ...p.address, street: e.target.value } }))} className="w-full p-2 border rounded" />
            <input type="text" placeholder="City" value={editData.address.city} onChange={e => setEditData(p => ({ ...p, address: { ...p.address, city: e.target.value } }))} className="w-full p-2 border rounded" />
            <input type="text" placeholder="ZIP Code" value={editData.address.zipCode} onChange={e => setEditData(p => ({ ...p, address: { ...p.address, zipCode: e.target.value } }))} className="w-full p-2 border rounded" />
          </div>
        );
      }
    }
    return <>{value}</>;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Reported Issue Banner - shows only if a report exists, is open, and has a reason */}
          {booking.report && booking.report.status === 'open' && booking.report.reason && (
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-bold text-yellow-800">
                    This booking is under review.
                    {booking.report.raisedBy && ` (Reported by ${booking.report.raisedBy.name})`}
                  </p>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="font-semibold">Reason: {booking.report.reason}</p>
                    <p className="mt-1 italic">"{booking.report.description}"</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <Link to={`/services/${booking.service._id}`} className="text-2xl font-bold text-gray-800 hover:text-blue-600">{booking.service.title}</Link>
              <p className="text-gray-500">Booking ID: #{booking._id.slice(-8)}</p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full text-sm font-medium capitalize bg-blue-100 text-blue-800">{booking.status.replace('-', ' ')}</span>
              <p className="text-2xl font-bold text-gray-800 mt-1">₹{booking.price.amount}</p>
            </div>
          </div>

          {/* Payment Status Banner */}
          {booking.payment && ['paid_to_platform', 'payout_pending'].includes(booking.payment.status) && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <ShieldCheck className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">Payment Secured</p>
                  <p className="text-sm text-gray-600">
                    Your payment of ₹{booking.price.amount.toLocaleString('en-IN')} is held securely by us. It will only be released to the vendor after the service is successfully completed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isEditing && <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg flex items-center"><AlertCircle size={16} className="mr-2"/><span>You are in edit mode.</span></div>}

          {/* Details Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Schedule & Location</h3>
              <div className="flex items-start space-x-4">
                <Calendar className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium">Date & Time</p>
                  {renderField('', new Date(booking.scheduledDate).toLocaleString('en-GB'), null, true, 'scheduledDate')}
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium">Address</p>
                  {renderField('', `${booking.address.street}, ${booking.address.city}, ${booking.address.zipCode}`, null, true, 'address', ['street', 'city', 'zipCode'])}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">People Involved</h3>
              <div className="flex items-start space-x-4">
                <User className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium">Customer</p>
                  <p>{booking.customer.name}</p>
                  <a href={`mailto:${booking.customer.email}`} className="text-sm text-blue-600 flex items-center gap-1"><Mail size={14}/>{booking.customer.email}</a>
                  <a href={`tel:${booking.customer.phone}`} className="text-sm text-blue-600 flex items-center gap-1"><Phone size={14}/>{booking.customer.phone}</a>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Briefcase className="h-5 w-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium">Vendor</p>
                  <p>{booking.vendor.businessName}</p>
                  <p className="text-sm text-gray-500">{booking.vendor.user.name}</p>
                  <a href={`mailto:${booking.vendor.user.email}`} className="text-sm text-blue-600 flex items-center gap-1"><Mail size={14}/>{booking.vendor.user.email}</a>
                  <a href={`tel:${booking.vendor.user.phone}`} className="text-sm text-blue-600 flex items-center gap-1"><Phone size={14}/>{booking.vendor.user.phone}</a>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Payment Section - REMOVED */}
          {/* This section is no longer needed as payments are now handled by the platform. */}

          {/* Notes Section */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Notes</h3>
            {isEditing ? (
              <textarea
                value={editData.notes}
                onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                className="w-full p-2 border rounded"
                rows={3}
                placeholder="Add any notes for the vendor..."
              />
            ) : (
              <p className="text-gray-600 italic bg-gray-50 p-3 rounded-lg">
                {booking.notes?.customerNotes || 'No notes provided.'}
              </p>
            )}
          </div>

          {/* Timeline Section */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Booking History</h3>
            <ul className="space-y-4">
              {booking.timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((item, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1.5">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </div>
                  <div>
                    <p className="font-medium capitalize">{item.status.replace('-', ' ')}</p>
                    <p className="text-sm text-gray-600">{item.note}</p>
                    <p className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Report Issue Modal */}
      {isReporting && booking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Report an Issue</h3>
                    <button onClick={() => setIsReporting(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                
                <p className="text-gray-600 mb-4">
                    Please describe the issue with the booking for "{booking.service?.title}"
                </p>

                <div className="mb-4">
                    <label htmlFor="report-reason" className="block text-sm font-medium text-gray-700 mb-2">Reason for Report</label>
                    <input
                        id="report-reason"
                        type="text"
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                        placeholder="e.g., Service not completed, Item damaged"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="report-description" className="block text-sm font-medium text-gray-700 mb-2">
                        Detailed Description
                    </label>
                    <textarea
                        id="report-description"
                        rows={5}
                        value={reportDescription}
                        onChange={e => setReportDescription(e.target.value)}
                        placeholder="Please provide as much detail as possible, including what happened and what resolution you are seeking."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsReporting(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleReportSubmit}
                        disabled={isSubmittingReport || !reportReason || !reportDescription}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {isVerifying && booking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Verify Completion</h3>
              <button onClick={() => setIsVerifying(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Please get the 6-digit OTP from the customer to confirm the service completion.
            </p>

            <div className="mb-4">
              <input
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setIsVerifying(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus('completed', otpInput)}
                disabled={otpInput.length !== 6 || isUpdatingStatus}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingStatus ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};