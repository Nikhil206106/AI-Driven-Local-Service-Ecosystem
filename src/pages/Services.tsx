import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, Star, Filter, LocateFixed, Loader2 } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";


interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Ratings {
  average: number;
  count: number;
}

interface User {
  name: string;
  ratings?: Ratings;
}

interface Vendor {
  _id: string;
  businessName: string;
  verificationStatus: string;
  user: User;
}

interface Pricing {
  type: string;
  amount: number;
  unit: string;
}

interface Service {
  _id: string;
  title: string;
  category: string;
  description: string;
  pricing: Pricing;
  images?: string[];
  vendor?: Vendor;
}

interface Filters {
  search: string;
  category: string;
  location: string;
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

export const Services: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    location: searchParams.get("location") || "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const { socket, isConnected } = useAuth();

  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `/${path.replace(/\\/g, '/')}`;
  };

  // ------------------- Fetch categories -------------------
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/services/categories/list");
        const data: Category[] = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // ------------------- Fetch services (debounced) -------------------
  const fetchServices = useCallback(async (currentFilters: Filters, coords: { lat: number; lng: number } | null) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (currentFilters.search) queryParams.set("search", currentFilters.search);
      if (currentFilters.category) queryParams.set("category", currentFilters.category);

      // Prioritize coordinates over text location
      if (coords) {
        queryParams.set("lat", coords.lat.toString());
        queryParams.set("lng", coords.lng.toString());
      } else if (currentFilters.location) {
        queryParams.set("city", currentFilters.location);
      }

      const res = await fetch(`/api/services?${queryParams}`);
      if (!res.ok) {
        // If the response is not OK, log the error details from the server
        const errorText = await res.text();
        console.error(`Server responded with ${res.status}:`, errorText);
        throw new Error(`HTTP error ${res.status}`);
      }

      const data: Service[] = await res.json();
      setServices(data);
    } catch (err) {
      // This will now catch the thrown error from the !res.ok check
      console.error("An error occurred while fetching services:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch services on initial load
    fetchServices(filters, coordinates);
  }, []); // Note: This now only runs once on mount.

  // This effect now only handles updating the URL.
  useEffect(() => {
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    // Also add lat/lng to URL if they exist
    if (coordinates) {
      params.set('lat', coordinates.lat.toString());
      params.set('lng', coordinates.lng.toString());
      // We can remove the text 'location' if we have coordinates
      params.delete('location');
    }
    setSearchParams(params);
  }, [filters, coordinates, setSearchParams]);

  // ------------------- WebSocket for real-time updates -------------------
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleServicesUpdated = (data: { vendorId: string; services: Service[] }) => {
      const { services: newServices } = data;

      setServices((prev) => {
        const updated = [...prev];
        newServices.forEach((svc) => {
          const index = updated.findIndex((s) => s._id === svc._id);
          if (index !== -1) {
            updated[index] = svc; // update existing
          } else {
            updated.unshift(svc); // add new
          }
        });
        return updated;
      });

      // ✅ Show visual alert for new services
      toast.success(`${newServices.length} new service(s) added!`, {
        duration: 4000,
        style: {
          background: "#1e3a8a", // deep blue
          color: "#fff",
          fontWeight: "500",
          borderRadius: "8px",
          padding: "10px 16px",
        },
        icon: "⚡",
      });

      console.log("✅ Realtime: New services received", newServices);
    };

    socket.on("servicesUpdated", handleServicesUpdated);

    return () => {
      socket.off("servicesUpdated", handleServicesUpdated);
    };
  }, [socket, isConnected]);



  // ------------------- Handle filter change -------------------
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // If user types a location, we should stop using the lat/lng from geolocation
    if (key === 'location') {
      setCoordinates(null);
    }
  };

  // ------------------- Handle Search Button Click -------------------
  const handleSearchClick = () => {
    fetchServices(filters, coordinates);
  };

  // ------------------- Handle "Use My Location" -------------------
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    toast.loading("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        toast.dismiss();
        toast.loading("Finding your city...");

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch location data");
          }
          const data = await response.json();
          // console.log("Reverse geocoding response:", data);
          // Extract city, town, or village from the address
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village;

          toast.dismiss();
          if (city) {
            toast.success(`Location set to ${city}`);
            handleFilterChange("location", city);
          } else {
            toast.error("Could not determine your city from your location.");
          }
        } catch (error) {
          toast.dismiss();
          toast.error("Could not determine your city. Please enter it manually.");
          console.error("Reverse geocoding error:", error);
        }
      },
      (error) => {
        toast.dismiss();
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location access denied. Please enable it in your browser settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            toast.error("The request to get your location timed out.");
            break;
          default:
            toast.error("An unknown error occurred while fetching location.");
            break;
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-20 w-20 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
            Find Services
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Discover trusted local service providers
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search services..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-1 gap-2">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="City or Area"
                  value={filters.location}
                  onChange={(e) => handleFilterChange("location", e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={handleUseMyLocation} title="Use my current location" className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0">
                <LocateFixed className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 lg:flex-none gap-2">
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSearchClick}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Service Grid */}
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {services.length > 0 ? (
            services.map((service) => (
              <div
                key={service._id}
                className="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition-shadow group"
              >
                <div className="relative h-48 sm:h-40 md:h-48 bg-gray-200">
                  <img
                    src={service.images?.[0] ? getImageUrl(service.images[0]) : (CATEGORY_IMAGES[service.category] || FALLBACK_IMAGE)}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null; // Prevent infinite loop
                      // Try category image first, then generic fallback
                      const categoryImage = CATEGORY_IMAGES[service.category];
                      if (categoryImage && target.src !== categoryImage) {
                          target.src = categoryImage;
                      } else {
                          target.src = FALLBACK_IMAGE;
                      }
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium capitalize">
                    {service.category?.replace('-', ' ') || 'Service'}
                  </div>
                </div>
                <div className="p-3 sm:p-4 md:p-6">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 text-xs sm:text-sm md:text-sm mb-3 line-clamp-2">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">
                        {service.vendor?.businessName || service.vendor?.user?.name || "Unnamed Vendor"}
                      </span>
                      {service.vendor?.verificationStatus === "verified" && (
                        <span className="text-green-600 text-xs font-medium bg-green-50 px-1 py-0.5 rounded ml-1">
                          ✅ Verified
                        </span>
                      )}
                    </div>
                    {service.vendor?.user?.ratings && service.vendor.user.ratings.count > 0 ? (
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-700">
                          {service.vendor.user.ratings.average.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({service.vendor.user.ratings.count})
                        </span>
                      </div>
                    ) : (
                      <span className="text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded">
                        New
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm sm:text-base font-semibold text-gray-800">
                        ₹{service.pricing.amount}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {service.pricing.unit}
                      </span>
                    </div>
                    <Link
                      to={`/services/${service._id}`}
                      className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="text-5xl mb-3">🔍</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">No services found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or browse all categories</p>
              <button
                onClick={() => setFilters({ search: "", category: "", location: "" })}
                className="bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Show All Services
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
