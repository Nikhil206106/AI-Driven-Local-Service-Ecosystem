import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Save, RefreshCw, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Category {
  _id: string;
  name: string;
  slug: string;
  image: string;
}

const CategoryManagement: React.FC = () => {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const getFullImageUrl = (path: string) => {
    if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
    return `/${path.replace(/\\/g, '/')}`;
  };

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      const processedData = data.map((cat: Category) => ({
        ...cat,
        image: getFullImageUrl(cat.image)
      }));
      setCategories(processedData);
    } catch (error) {
      console.error(error);
      toast.error('Could not load categories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  const handleEdit = (category: Category) => {
    setEditingId(category._id);
    setEditValue(category.image);
    setImageFile(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setImageFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      // Show a local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditValue(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (id: string) => {
    const formData = new FormData();
    if (imageFile) {
      formData.append('imageFile', imageFile);
    } else {
      formData.append('image', editValue);
    }

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update');
      }
      
      const updatedCategory: Category = await res.json();
      setCategories(prev => prev.map(c => c._id === id ? { ...updatedCategory, image: getFullImageUrl(updatedCategory.image) } : c));
      handleCancel();
      toast.success('Category image updated');
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading categories...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Category Management</h1>
        <button onClick={fetchCategories} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
          <RefreshCw className="h-5 w-5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default Image URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category) => (
                <tr key={category._id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{category.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{category.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {editingId === category._id ? (
                      <div className="space-y-2 w-64">
                        <input
                          type="text"
                          value={editValue.startsWith('data:') ? 'New file selected for preview' : editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            if (imageFile) setImageFile(null);
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1"
                          placeholder="Enter image URL"
                          disabled={!!imageFile}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="w-full text-sm text-gray-600 file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    ) : (
                      <span className="truncate block max-w-xs" title={category.image}>{category.image}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-12 w-20 bg-gray-100 rounded overflow-hidden">
                      <img 
                        src={editingId === category._id ? editValue : category.image} 
                        alt={category.name} 
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=Error'; }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editingId === category._id ? (
                      <div className="flex space-x-2">
                        <button onClick={() => handleSave(category._id)} className="text-green-600 hover:text-green-900">
                          <Save className="h-5 w-5" />
                        </button>
                        <button onClick={handleCancel} className="text-gray-600 hover:text-gray-900">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(category)} className="text-blue-600 hover:text-blue-900">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagement;