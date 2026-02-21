import { useState } from 'react';
import { Search, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AIClassifier() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ 
    recommended_service: string; 
    slug: string;
    confidence: number;
    expert_advice: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClassify = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('http://localhost:8001/recommend', {
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
    <div className="w-full bg-white rounded-2xl p-6 shadow-2xl">
      <h3 className="text-lg font-semibold text-gray-700 mb-3">Describe your issue, and we'll find the right service for you</h3>
      
      <div className="relative">
        <textarea
          className="w-full p-4 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 text-gray-800 placeholder-gray-400 transition-all"
          maxLength={200}
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
        <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Recommended Service</p>
              <p className="text-lg font-bold text-green-800">{result.recommended_service}</p>
            </div>
            <Link 
              to={`/services?search=${encodeURIComponent(result.slug || result.recommended_service)}`}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm"
            >
              Book Now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          {result.expert_advice && (
            <div className="bg-white p-3 rounded-lg border border-green-100 text-sm text-gray-700">
              <p className="font-semibold text-green-700 mb-1">Expert Advice:</p>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{result.expert_advice}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}