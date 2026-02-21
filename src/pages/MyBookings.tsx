import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Calendar,
  Clock,
  MapPin,
  Star,
  MessageSquare,
  Phone,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";

interface Booking {
  _id: string;
  service: {
    _id: string;
    title: string;
    category: string;
  } | null;
  vendor: {
    businessName: string;
    user: {
      name: string;
      phone: string;
    };
  } | null;
  customer: {
    name: string;
    phone: string;
  } | null;
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
  rating?: {
    score: number;
    review: string;
  };
  report?: {
    reason: string;
    description: string;
    status: "open" | "resolved";
  };
  dispute?: {
    raisedBy: { name: string; role: 'customer' | 'vendor' };
    reason: string;
    description: string;
    status: 'open' | 'under_review' | 'resolved';
  };
  otp?: string; // Added for real-time display
  createdAt: string;
}

export const MyBookings = () => {
  const { user, token, socket, isConnected, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  // OTP Verification State
  const [verifyingBookingId, setVerifyingBookingId] = useState<string | null>(
    null,
  );
  const [otpInput, setOtpInput] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  // Rating Modal State
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingReview, setRatingReview] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Report Issue Modal State
  const [disputingBooking, setDisputingBooking] = useState<Booking | null>(
    null,
  );
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const fetchBookings = useCallback(
    async (statusFilter: string) => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (statusFilter !== "all") {
          // The 'filter' state now maps directly to a 'view'.
          queryParams.set("view", statusFilter);
        }

        const response = await fetch(
          `/api/bookings?${queryParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!response.ok) {
          if (response.status === 401) {
            logout();
            toast.error("Session expired. Please log in again.");
            // No need to throw, just stop execution
          }
          throw new Error("Failed to fetch bookings");
        }
        const data = await response.json();

        // Replace booking list with fetched data, but preserve any live OTPs from the previous state
        // for bookings that are still pending verification. This fixes the filtering issue.
        setBookings((prevBookings) => {
          const oldBookingMap = new Map(prevBookings.map((b) => [b._id, b]));
          return data.map((newBooking: Booking) => {
            const oldBooking = oldBookingMap.get(newBooking._id);
            // Only preserve OTP if the status is still 'verification-pending'.
            // This prevents showing a stale OTP if the status changed on the backend.
            if (
              oldBooking?.otp &&
              newBooking.status === "verification-pending"
            ) {
              newBooking.otp = oldBooking.otp;
            }
            return newBooking;
          });
        });
      } catch (error) {
        console.error("Error fetching bookings:", error);
        setError("Failed to load bookings. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    },
    [token, filter, logout],
  );

  useEffect(() => {
    fetchBookings(filter);
  }, [fetchBookings, filter]);

  // Create a stable dependency for the OTP fetching effect to prevent infinite loops.
  const bookingsNeedingOtp = bookings
    .filter(
      (b) =>
        user?.role === "customer" &&
        b.status === "verification-pending" &&
        !b.otp,
    )
    .map((b) => b._id)
    .join(",");

  // Effect to fetch OTP for any booking that is pending verification
  useEffect(() => {
    const fetchOtpForBooking = async (bookingId: string) => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}/otp`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          // Securely update the specific booking with the fetched OTP
          setBookings((prev) =>
            prev.map((b) =>
              b._id === bookingId ? { ...b, otp: data.otp } : b,
            ),
          );
        }
      } catch (error) {
        console.error(`Failed to fetch OTP for booking ${bookingId}:`, error);
      }
    };

    // If there are bookings that need an OTP, fetch them.
    if (bookingsNeedingOtp && token) {
      bookingsNeedingOtp.split(",").forEach((id) => fetchOtpForBooking(id));
    }
    // This effect now correctly depends on the stable string of IDs.
  }, [bookingsNeedingOtp, token]);

  useEffect(() => {
    // Guard: Only attach listeners if the socket is connected.
    if (!socket || !isConnected) {
      // Optional: log if you want to debug connection issues from this component
      return;
    }

    const handleStatusUpdate = (data: {
      bookingId: string;
      status: string;
      updatedBy: string;
    }) => {
      console.log("Frontend: Received booking-status-update event:", data); // Log the full data object
      // Per the new architecture, simply re-fetch the current view to ensure data consistency.
      fetchBookings(filter);
    };

    socket.on("booking-status-update", handleStatusUpdate);

    return () => {
      socket.off("booking-status-update", handleStatusUpdate);
    };
  }, [socket, isConnected, filter, user]); // Dependency on isConnected ensures we re-subscribe if connection drops and comes back.

  const handleUpdateStatus = async (
    bookingId: string,
    newStatus: string,
    otp?: string,
  ) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(bookingId);

    // For optimistic UI rollback
    const originalBookings = [...bookings];

    try {
      // Optimistic UI Update: Change status locally before API call.
      setBookings((prev) =>
        prev.map((b) =>
          b._id === bookingId ? { ...b, status: newStatus } : b,
        ),
      );

      const body: any = { status: newStatus };
      if (otp) body.otp = otp;

      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      // Give user feedback that the action was successful and where to find the booking
      if (newStatus === "in-progress") {
        toast.success('Job started! You can find it in the "In Progress" tab.');
      }

      // Close modal if open
      if (verifyingBookingId === bookingId) {
        handleCloseOtpModal();
      }
    } catch (error: any) {
      // Rollback optimistic update on failure
      setBookings(originalBookings);
      toast.error(`Update failed: ${error.message}`);

      console.error("Error updating booking status:", error);
      setError(error.message || "Failed to update status");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleCloseOtpModal = () => {
    setVerifyingBookingId(null);
    setOtpInput("");
  };

  const handleRatingSubmit = async () => {
    if (!ratingBooking || ratingScore === 0) {
      toast.error("Please select a star rating.");
      return;
    }
    setIsSubmittingRating(true);
    try {
      const response = await fetch(
        `/api/bookings/${ratingBooking._id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ score: ratingScore, review: ratingReview }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit review.");
      }
      toast.success("Thank you for your review!");

      // Update the booking in the local state
      setBookings((prev) =>
        prev.map((b) =>
          b._id === ratingBooking._id
            ? { ...b, rating: { score: ratingScore, review: ratingReview } }
            : b,
        ),
      );

      // Close modal and reset state
      setRatingBooking(null);
      setRatingScore(0);
      setRatingReview("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!disputingBooking || !disputeReason || !disputeDescription) {
      toast.error("Please provide a reason and a detailed description.");
      return;
    }
    setIsSubmittingDispute(true);
    try {
      const response = await fetch(
        `/api/bookings/${disputingBooking._id}/dispute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: disputeReason,
            description: disputeDescription,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to report issue.");
      }

      const updatedBooking = await response.json();

      toast.success(
        "Dispute raised successfully. An admin will review it shortly.",
      );

      // Update the booking in the local state with the new data from the server
      setBookings((prev) =>
        prev.map((b) => (b._id === updatedBooking._id ? updatedBooking : b)),
      );

      // Close modal and reset state
      setDisputingBooking(null);
      setDisputeReason("");
      setDisputeDescription("");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "in-progress":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "rejected":
        return "bg-gray-100 text-gray-800";
      case "verification-pending":
        return "bg-orange-100 text-orange-800";
      case "reported":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">My Bookings</h1>
          <p className="text-gray-600">
            Track and manage your service appointments
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All Bookings" },
              { key: "pending", label: "Pending" },
              { key: "confirmed", label: "Confirmed" },
              { key: "in-progress", label: "In Progress" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
              { key: "reported", label: "Reported" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        {bookings.length > 0 ? (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {booking.service ? (
                        <Link
                          to={`/services/${booking.service._id}`}
                          className="block"
                        >
                          <h3 className="text-xl font-semibold text-gray-800 mb-1 hover:text-blue-600 transition-colors">
                            {booking.service.title}
                          </h3>
                        </Link>
                      ) : (
                        <h3 className="text-xl font-semibold text-gray-800 mb-1">
                          Service Unavailable
                        </h3>
                      )}
                      <p className="text-gray-600">
                        {user?.role === "customer"
                          ? `by ${booking.vendor?.businessName || "Unknown Vendor"}`
                          : user?.role === "admin"
                            ? `by ${booking.vendor?.businessName || "Unknown Vendor"} • for ${booking.customer?.name || "Unknown Customer"}`
                            : `for ${booking.customer?.name || "Unknown Customer"}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(booking.status)}`}
                      >
                        {booking.status.replace("-", " ")}
                      </span>
                      <div className="text-lg font-semibold text-gray-800 mt-2">
                        ₹{booking.price?.amount ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="h-5 w-5" />
                      <span>
                        {new Date(booking.scheduledDate).toLocaleDateString(
                          "en-GB",
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Clock className="h-5 w-5" />
                      <span>
                        {new Date(booking.scheduledDate).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="h-5 w-5" />
                      <span>{booking.address?.city || "N/A"}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {booking.status === "completed" &&
                        user?.role === "customer" &&
                        !booking.rating && (
                          <button
                            onClick={() => setRatingBooking(booking)}
                            className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                          >
                            <Star className="h-4 w-4" />
                            <span>Rate Service</span>
                          </button>
                        )}

                      {booking.rating && (
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < booking.rating!.score
                                    ? "text-yellow-400 fill-current"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">
                            Your Rating
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/bookings/${booking._id}`}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Details</span>
                      </Link>

                      {/* Generic Report Button - for cases without a specific action button */}
                      {// For customers, show on these statuses
                      ((user?.role === "customer" &&
                        [
                          "in-progress",
                          "completed",
                          "verification-pending",
                        ].includes(booking.status)) ||
                        // For vendors, only show on completed bookings
                        (user?.role === "vendor" &&
                          booking.status === "completed")) &&
                        booking.dispute?.status !== "open" && (
                          <button
                            onClick={() => setDisputingBooking(booking)}
                            className="flex items-center space-x-2 px-4 py-2 border border-yellow-400 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                            title="Raise a dispute for this booking"
                          >
                            <AlertCircle className="h-4 w-4" />
                            <span>Raise Dispute</span>
                          </button>
                        )}

                      {["confirmed", "in-progress"].includes(
                        booking.status,
                      ) && (
                        <>
                          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                            <MessageSquare className="h-4 w-4" />
                            <span>Message</span>
                          </button>
                          {/* Show call button with number if available */}
                          {user?.role === "customer" &&
                            booking.vendor?.user?.phone && (
                              <a
                                href={`tel:${booking.vendor?.user?.phone}`}
                                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <Phone className="h-4 w-4" />
                                <span>Call Vendor</span>
                              </a>
                            )}
                          {user?.role === "vendor" &&
                            booking.customer?.phone && (
                              <a
                                href={`tel:${booking.customer?.phone}`}
                                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <Phone className="h-4 w-4" />
                                <span>Call Customer</span>
                              </a>
                            )}
                          {user?.role === "admin" && (
                            <>
                              {booking.vendor?.user?.phone && (
                                <a
                                  href={`tel:${booking.vendor?.user?.phone}`}
                                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                  title="Call Vendor"
                                >
                                  <Phone className="h-4 w-4" />
                                </a>
                              )}
                              {booking.customer?.phone && (
                                <a
                                  href={`tel:${booking.customer?.phone}`}
                                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                  title="Call Customer"
                                >
                                  <Phone className="h-4 w-4" />
                                </a>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* Add "Start Job" for vendor and "Cancel" for customer on confirmed bookings */}
                      {booking.status === "confirmed" &&
                        user?.role === "vendor" && (
                          <button
                            disabled={isUpdatingStatus === booking._id}
                            onClick={() =>
                              handleUpdateStatus(booking._id, "in-progress")
                            }
                            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                          >
                            <span>Start Job</span>
                          </button>
                        )}

                      {booking.status === "confirmed" &&
                        user?.role === "customer" && (
                          <button
                            disabled={isUpdatingStatus === booking._id}
                            onClick={() =>
                              handleUpdateStatus(booking._id, "cancelled")
                            }
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                            <span>Cancel Booking</span>
                          </button>
                        )}

                      {booking.status === "pending" &&
                        user?.role === "vendor" && (
                          <div className="flex space-x-2">
                            <button
                              disabled={isUpdatingStatus === booking._id}
                              onClick={() =>
                                handleUpdateStatus(booking._id, "confirmed")
                              }
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              disabled={isUpdatingStatus === booking._id}
                              onClick={() =>
                                handleUpdateStatus(booking._id, "rejected")
                              }
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        )}

                      {booking.status === "in-progress" &&
                        user?.role === "vendor" && (
                          <div className="flex space-x-2">
                            <button
                              disabled={isUpdatingStatus === booking._id}
                              onClick={() =>
                                handleUpdateStatus(
                                  booking._id,
                                  "verification-pending",
                                )
                              }
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                              <span>Request Completion</span>
                            </button>

                            <button
                              disabled={isUpdatingStatus === booking._id}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to cancel this job? This may affect your vendor rating.",
                                  )
                                )
                                  handleUpdateStatus(booking._id, "cancelled");
                              }}
                              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                              <span>Cancel Job</span>
                            </button>

                            {/* Report button for in-progress issues */}
                            {booking.dispute?.status !== "open" && (
                              <button
                                onClick={() => setDisputingBooking(booking)}
                                className="flex items-center space-x-2 px-4 py-2 border border-yellow-400 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                                title="Raise a dispute for this booking (e.g., customer unresponsive)."
                              >
                                <AlertCircle className="h-4 w-4" />
                                <span>Raise Dispute</span>
                              </button>
                            )}
                          </div>
                        )}

                      {/* Vendor now sees the button to enter the OTP */}
                      {booking.status === "verification-pending" &&
                        user?.role === "vendor" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setVerifyingBookingId(booking._id)}
                              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle className="h-4 w-4" />
                              <span>Enter OTP & Complete</span>
                            </button>
                            {/* Specific Report Button for the OTP refusal scenario, only if no report is open */}
                            {booking.dispute?.status !== "open" && (
                              <button
                                onClick={() => setDisputingBooking(booking)}
                                className="flex items-center space-x-2 px-4 py-2 border border-yellow-400 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                                title="Customer not providing OTP? Raise a dispute."
                              >
                                <AlertCircle className="h-4 w-4" />
                                <span>Raise Dispute</span>
                              </button>
                            )}
                          </div>
                        )}

                      {/* Customer now sees the OTP directly in the app */}
                      {booking.status === "verification-pending" &&
                        user?.role === "customer" &&
                        (booking.otp ? ( // Check booking.otp directly
                          <div className="text-center p-3 bg-green-50 border-2 border-green-300 rounded-lg animate-pulse">
                            <p className="text-sm font-medium text-green-800">
                              Share this code with your vendor to complete the
                              job:
                            </p>
                            <p className="text-3xl font-bold tracking-widest text-green-900 mt-1">
                              {booking.otp}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center text-blue-600 font-medium p-2 bg-blue-50 rounded-lg">
                            <Clock className="h-5 w-5 mr-2 animate-spin" />
                            <span>
                              Vendor has requested completion. Generating
                              code...
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {booking.rating?.review && (
                  <div className="px-6 pb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 italic">
                        "{booking.rating.review}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {filter === "all" ? "No bookings yet" : `No ${filter} bookings`}
            </h3>
            <p className="text-gray-600 mb-6">
              {user?.role === "customer"
                ? "Start by browsing our services and booking your first appointment."
                : user?.role === "admin"
                  ? "No bookings found in the system."
                  : "Customers will start booking your services soon."}
            </p>
            {user?.role === "customer" && (
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Browse Services
              </button>
            )}
          </div>
        )}
      </div>

      {/* OTP Verification Modal */}
      {verifyingBookingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Verify Completion
              </h3>
              <button
                onClick={handleCloseOtpModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Please get the 6-digit OTP from the customer to confirm the
              service completion.
            </p>

            <div className="mb-4">
              <input
                type="text"
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCloseOtpModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdateStatus(verifyingBookingId, "completed", otpInput)
                }
                disabled={otpInput.length !== 6 || !isConnected}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Rate Your Service
              </h3>
              <button
                onClick={() => setRatingBooking(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              How was your experience with "{ratingBooking.service?.title}"?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Rating
              </label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRatingScore(star)}>
                    <Star
                      className={`h-8 w-8 transition-colors ${ratingScore >= star ? "text-yellow-400 fill-current" : "text-gray-300 hover:text-yellow-300"}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="review-text"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Your Review (Optional)
              </label>
              <textarea
                id="review-text"
                rows={4}
                value={ratingReview}
                onChange={(e) => setRatingReview(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setRatingBooking(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRatingSubmit}
                disabled={isSubmittingRating || ratingScore === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingRating ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {disputingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Raise a Dispute
              </h3>
              <button
                onClick={() => setDisputingBooking(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Please describe the issue with the booking for "{' '}
              {disputingBooking.service?.title}"
            </p>

            <div className="mb-4">
              <label
                htmlFor="report-reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for Dispute
              </label>
              <input
                id="report-reason"
                type="text"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g., Service not as described, Item damaged"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="report-description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Detailed Description
              </label>
              <textarea
                id="report-description"
                rows={5}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                placeholder="Please provide as much detail as possible, including what happened and what resolution you are seeking."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setDisputingBooking(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisputeSubmit}
                disabled={
                  isSubmittingDispute || !disputeReason || !disputeDescription
                }
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingDispute ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
