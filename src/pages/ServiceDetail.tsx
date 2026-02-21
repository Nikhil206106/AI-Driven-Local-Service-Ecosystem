import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, MapPin, Clock, IndianRupee, User, Phone, Mail, Calendar, Flag, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface Service {
  _id: string;
  title: string;
  category: string;
  description: string;
  pricing: {
    type: string;
    amount: number;
    unit: string;
  };
  duration: {
    estimated: number;
    unit: string;
  };
  images: string[];
  included: string[];
  excluded: string[];
  requirements: string[];
  vendor: {
    _id: string;
    businessName: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    experience: number;
    user: {
      name: string;
      ratings: {
        average: number;
        count: number;
      };
      address: {
        city: string;
        state: string;
      };
    };
  };
}

const CATEGORY_IMAGES: Record<string, string> = {
  plumbing: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800',
  electrical: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800',
  cleaning: 'https://images.unsplash.com/photo-1584622050111-993a426fbf0a?auto=format&fit=crop&q=80&w=800',
  painting: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=800',
  carpentry: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=800',
  'appliance-repair': 'https://images.unsplash.com/photo-1581092921461-eab62e97a782?auto=format&fit=crop&q=80&w=800',
  hvac: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=800',
  landscaping: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&q=80&w=800',
  moving: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&q=80&w=800',
  'pest-control': 'https://images.unsplash.com/photo-1587574293340-e0011c4e8ecf?auto=format&fit=crop&q=80&w=800',
  handyman: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800',
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800";

export const ServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading: authLoading, logout } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `/${path.replace(/\\/g, '/')}`;
  };

  const fetchService = useCallback(async () => {
    try {
      const response = await fetch(`/api/services/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          logout();
          toast.error("Session expired. Please log in again.");
          return; // Stop further execution
        }
        if (response.status === 404) {
          throw new Error('Service not found.');
        }
        throw new Error('Failed to fetch service details. Please try again.');
      }
      const data = await response.json();
      setService(data);
    } catch (error) {
      console.error('Error fetching service:', error);
      toast.error(error instanceof Error ? error.message : 'Could not load service.');
    } finally {
      setIsLoading(false);
    }
  }, [id, token, logout]);

  useEffect(() => {
    if (token) fetchService();
  }, [token, fetchService]);

  // 1. Check if Auth is loading first
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 2. If not logged in, show Lock Screen
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Login Required</h2>
          <p className="text-gray-600 mb-8">
            Please sign in to view full service details, pricing, and provider information.
          </p>
          <div className="space-y-3">
            <Link to="/login" state={{ from: { pathname: `/services/${id}` } }} className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. If logged in but service loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Service not found</h2>
          <Link to="/services" className="text-blue-600 hover:text-blue-700">
            Browse all services
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Service Images */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className="h-96 bg-gray-200">
                <img
                  src={service.images?.[0] ? getImageUrl(service.images[0]) : (CATEGORY_IMAGES[service.category] || FALLBACK_IMAGE)}
                  alt={service.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    const categoryImage = CATEGORY_IMAGES[service.category];
                    if (categoryImage && target.src !== categoryImage) {
                        target.src = categoryImage;
                    } else {
                        target.src = FALLBACK_IMAGE;
                    }
                  }}
                />
              </div>
            </div>

            {/* Service Details */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <div className="mb-6">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium capitalize">
                  {service.category?.replace('-', ' ') || 'Service'}
                </span>
              </div>

              <h1 className="text-3xl font-bold text-gray-800 mb-4">{service.title}</h1>
              
              <div className="flex items-center space-x-6 mb-6 text-gray-600">
                <div className="flex items-center space-x-1">
                  <Clock className="h-5 w-5" />
                  <span>{service.duration?.estimated ?? 'N/A'} {service.duration?.unit}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <IndianRupee className="h-5 w-5" />
                  <span>₹{service.pricing?.amount ?? 'N/A'} {service.pricing?.unit}</span>
                </div>
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-8">
                {service.description}
              </p>

              {/* Call to Action Button */}
              <div className="my-8 text-center lg:text-left">
                <Link
                  to={`/book/${service._id}`}
                  className="inline-flex items-center justify-center bg-blue-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Calendar className="mr-3 h-5 w-5" />
                  Book This Service
                </Link>
              </div>

              {/* What's Included */}
              {service.included && service.included.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">What's Included</h3>
                  <ul className="space-y-2">
                    {service.included.map((item, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {service.requirements && service.requirements.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Customer Requirements</h3>
                  <ul className="space-y-2">
                    {service.requirements.map((item, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What's Not Included */}
              {service.excluded && service.excluded.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Not Included</h3>
                  <ul className="space-y-2">
                    {service.excluded.map((item, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Booking Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-800 mb-2">
                  ₹{service.pricing.amount}
                </div>
                <p className="text-gray-600">{service.pricing.unit}</p>
              </div>

              <Link
                to={`/book/${service._id}`}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center block mb-4"
              >
                Book Now
              </Link>

              <div className="text-center text-sm text-gray-500">
                Free cancellation up to 24 hours before service
              </div>
            </div>

            {/* Vendor Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Service Provider</h3>
              
              <div className="flex items-center space-x-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-800">{service.vendor?.businessName ?? 'Unnamed Vendor'}</h4>
                    {service.vendor?.verificationStatus === 'verified' && (
                      <span title="Verified Provider" className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={12} />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm">{service.vendor?.user?.name}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-yellow-400 fill-current" />
                    <span className="font-medium text-gray-800">
                      {service.vendor?.user?.ratings?.average?.toFixed(1) ?? '0.0'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    ({service.vendor?.user?.ratings?.count ?? 0} reviews)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600 text-sm">
                    {service.vendor?.user?.address?.city ?? 'Unknown'}, {service.vendor?.user?.address?.state}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600 text-sm">
                    {service.vendor?.experience ?? 0}+ years experience
                  </span>
                </div>
              </div>
            </div>

            {/* Trust & Safety */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-200">
              <h3 className="font-semibold text-green-800 mb-3">Trust &amp; Safety</h3>
              <div className="space-y-2 text-sm text-green-700">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Background checked</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Licensed & insured</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Customer satisfaction guaranteed</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-green-200">
                <a
                  href={`mailto:bapvesupp@gmail.com?subject=Report Vendor: ${service.vendor?.businessName}&body=I would like to report an issue with vendor ${service.vendor?.businessName} (ID: ${service.vendor?._id}) regarding service ${service.title}.`}
                  className="flex items-center justify-center w-full space-x-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Flag className="h-4 w-4" />
                  <span>Report Vendor</span>
                </a>
                <p className="text-xs text-center text-green-700 mt-3">
                  Need help? Contact <a href="mailto:bapvesupp@gmail.com" className="underline font-medium">bapvesupp@gmail.com</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating booking bar for mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
            <div>
                <p className="text-lg font-bold text-gray-800">₹{service.pricing?.amount ?? 'N/A'}</p>
                <p className="text-xs text-gray-500">{service.pricing?.unit}</p>
            </div>
            <Link
                to={`/book/${service._id}`}
                className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
            >
                Book Now
            </Link>
        </div>
      </div>
    </div>
  );
};