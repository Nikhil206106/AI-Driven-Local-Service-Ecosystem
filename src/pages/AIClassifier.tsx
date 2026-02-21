import { useState } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AIClassifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ recommended_service: string; slug: string; confidence: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClassify = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/ai-api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to AI service');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Could not connect to AI service. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl transition-colors duration-300">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Describe your issue, and we'll find the right service for you</h3>
      
      <div className="relative">
        <textarea
          className="w-full p-4 pr-12 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          rows={2}
          placeholder="e.g., 'My kitchen sink is leaking water everywhere'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleClassify();
            }
          }}
        />
        <button
          onClick={handleClassify}
          disabled={loading || !query.trim()}
          className="absolute right-3 top-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div>
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Recommended Service</p>
            <p className="text-lg font-bold text-green-800 dark:text-green-200">{result.recommended_service}</p>
          </div>
          <Link 
            to={`/services?category=${encodeURIComponent(result.slug)}`}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm"
          >
            Book Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}