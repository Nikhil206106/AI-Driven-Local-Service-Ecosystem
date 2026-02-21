import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, Star, Shield, Clock, Users, Sparkles, LocateFixed } from 'lucide-react';
import AIClassifier from '../components/AIClassifier';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [manualQuery, setManualQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const categories = [
    { id: 'plumbing', name: 'Plumbing', icon: '🔧', color: 'bg-blue-100 text-blue-600' },
    { id: 'electrical', name: 'Electrical', icon: '⚡', color: 'bg-yellow-100 text-yellow-600' },
    { id: 'carpentry', name: 'Carpentry', icon: '🔨', color: 'bg-orange-100 text-orange-600' },
    { id: 'cleaning', name: 'Cleaning', icon: '🧽', color: 'bg-green-100 text-green-600' },
    { id: 'painting', name: 'Painting', icon: '🎨', color: 'bg-purple-100 text-purple-600' },
    { id: 'appliance-repair', name: 'Appliance Repair', icon: '🔌', color: 'bg-red-100 text-red-600' },
  ];

  const features = [
    {
      icon: <Search className="h-8 w-8" />,
      title: 'Easy Search',
      description: 'Find the perfect service provider in your area with our smart search feature.'
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: 'Verified Providers',
      description: 'All our service providers are thoroughly verified for your safety and peace of mind.'
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: 'Quick Booking',
      description: 'Book services instantly with our streamlined booking process and flexible scheduling.'
    },
    {
      icon: <Star className="h-8 w-8" />,
      title: 'Quality Assured',
      description: 'Read reviews and ratings from real customers to make informed decisions.'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Happy Customers' },
    { number: '2,500+', label: 'Verified Providers' },
    { number: '50+', label: 'Cities Covered' },
    { number: '4.8/5', label: 'Average Rating' }
  ];

  useEffect(() => {
    if (location.state?.aiQuery) {
      setActiveTab('ai');
    }
  }, [location.state]);

  const handleManualSearch = () => {
    const params = new URLSearchParams();
    if (manualQuery) params.set('search', manualQuery);

    // Prioritize coordinates over text location
    if (coordinates) {
      params.set('lat', coordinates.lat.toString());
      params.set('lng', coordinates.lng.toString());
    } else if (locationQuery) {
      params.set('location', locationQuery);
    }

    const queryString = params.toString();

    if (!user) {
      // Pass the full intended destination to the login page
      navigate('/login', { state: { from: { pathname: `/services?${queryString}` } } });
      return;
    }
    navigate(`/services?${queryString}`);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    toast.loading("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        toast.dismiss(); // Dismiss initial loading toast
        toast.loading("Finding your city...");

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch location data");
          }
          const data = await response.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village;

          toast.dismiss();
          if (city) {
            toast.success(`Location set to ${city}`);
            setLocationQuery(city);
            // Clear coordinates to ensure the search uses the city name, as requested.
            setCoordinates(null);
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
            toast.error("Location information is unavailable at the moment.");
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

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationQuery(e.target.value);
    setCoordinates(null);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1581578731117-104f8a746950?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-400/20 backdrop-blur-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-sm font-medium text-blue-100">Trusted by over 10,000+ homeowners</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              Expert Home Services
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-200 to-white">at Your Doorstep</span>
            </h1>
            <p className="text-xl md:text-2xl mb-12 text-blue-100/80 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              Connect with verified professionals for plumbing, electrical, cleaning, and more. Quality service, guaranteed.
            </p>
            
            {/* Search Tabs */}
            <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
                <div className="bg-white/10 backdrop-blur-md p-1 rounded-xl inline-flex border border-white/20">
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${
                      activeTab === 'manual'
                        ? 'bg-white text-blue-600 shadow-lg'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Manual Search
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      activeTab === 'ai'
                        ? 'bg-white text-blue-600 shadow-lg'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Assistant
                  </button>
                </div>
              </div>

            {/* Search Content */}
            {activeTab === 'manual' ? (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 max-w-4xl mx-auto shadow-2xl mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-white/10">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="What service do you need?"
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 text-gray-800 bg-gray-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 relative">
                      <MapPin className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter your location"
                        value={locationQuery}
                        onChange={handleLocationChange}
                        className="w-full pl-12 pr-4 py-3 text-gray-800 bg-gray-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                    <button onClick={handleUseMyLocation} title="Use my current location" className="p-3 bg-gray-100 border-0 rounded-lg hover:bg-gray-200 text-gray-600 flex-shrink-0">
                      <LocateFixed className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleManualSearch}
                    disabled={!manualQuery && !locationQuery}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Search
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AIClassifier />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Explore Services
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From emergency repairs to home improvements, find the right expert for every job.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/services?category=${category.id}`}
                className="group bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-blue-100 transition-all duration-300 text-center transform hover:-translate-y-1"
              >
                <div className={`w-14 h-14 ${category.color.replace('text-', 'bg-').replace('100', '50')} rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                  <span className="filter drop-shadow-sm">{category.icon}</span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {category.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Homeowners Trust Swayam
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We're committed to providing a safe, reliable, and seamless experience for all your home service needs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 p-8 rounded-3xl hover:bg-white hover:shadow-xl transition-all duration-300 group border border-transparent hover:border-gray-100">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-blue-600/20">
                  {React.cloneElement(feature.icon as React.ReactElement, { className: "h-7 w-7" })}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-indigo-900"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-300">
                  {stat.number}
                </div>
                <div className="text-blue-200 text-lg font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[2.5rem] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
            
            <div className="relative p-12 md:p-20 text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Ready to Transform Your Home?
              </h2>
              <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                Join thousands of satisfied customers who have found their perfect service match on Swayam.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/services"
                  className="bg-white text-blue-600 px-10 py-4 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                >
                  Find Services
                </Link>
                <Link
                  to="/register?role=vendor"
                  className="bg-blue-700/30 backdrop-blur-sm border border-white/30 text-white px-10 py-4 rounded-xl font-bold hover:bg-white/10 transition-all hover:-translate-y-1"
                >
                  Become a Provider
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};