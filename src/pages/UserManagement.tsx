import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Users, X, Edit, Trash2, Save, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

// --- TYPE DEFINITIONS ---
interface User {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: 'customer' | 'vendor' | 'admin';
    isVerified: boolean;
    isActive: boolean;
    createdAt: string;
}

interface UserApiResponse {
    users: User[];
    totalPages: number;
    currentPage: number;
}

// --- API CONFIGURATION ---
const API_BASE_URL = '/api/admin'; // Your backend

// --- UTILITY COMPONENTS ---

// 1. Badge Component for Status/Roles (Light Mode Only)
interface BadgeProps {
    children: React.ReactNode;
    type: 'success' | 'danger' | 'info' | 'primary';
}

const Badge: React.FC<BadgeProps> = ({ children, type }) => {
    const baseClasses = "inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium";
    let typeClasses = '';

    switch (type) {
        case 'success':
            typeClasses = 'bg-green-100 text-green-800';
            break;
        case 'danger':
            typeClasses = 'bg-red-100 text-red-800';
            break;
        case 'info':
            typeClasses = 'bg-yellow-100 text-yellow-800';
            break;
        case 'primary':
        default:
            typeClasses = 'bg-indigo-100 text-indigo-800';
            break;
    }

    return <span className={`${baseClasses} ${typeClasses}`}>{children}</span>;
};

// 2. Modal Component (Light Mode Only)
interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity duration-300">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all scale-100 duration-300">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                    aria-label="Close modal"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            {children}
        </div>
    </div>
);

// --- MAIN COMPONENT ---
const UserManagement: React.FC = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    
    // Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<{ role: User['role']; isActive: boolean }>({ role: 'customer', isActive: true });
    
    // Delete Modal
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    // New state for clearing all data
    const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
    const [isClearingData, setIsClearingData] = useState(false);

    // --- FETCH USERS ---
    const fetchUsers = useCallback(async (page: number = currentPage, search: string = searchTerm, isManualRefresh: boolean = false) => {
        if (isManualRefresh) {
            setIsRefreshing(true);
        } else if (!isManualRefresh && !isRefreshing) {
            setIsLoading(true);
        }
        setError(null);

        if (!token) {
            setError("Admin token missing. Please log in.");
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }

        try {
            const query = new URLSearchParams({
                page: String(page),
                limit: '10',
                search: search,
            });

            const response = await fetch(`${API_BASE_URL}/users?${query.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Failed to fetch users`);
            }

            const data: UserApiResponse = await response.json();
            setUsers(data.users);
            setTotalPages(data.totalPages);
            setCurrentPage(data.currentPage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to load users.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [currentPage, searchTerm, isRefreshing, token]);

    // Effect to run on mount and when page/search changes
    useEffect(() => {
        fetchUsers(currentPage, searchTerm);
    }, [currentPage, searchTerm, fetchUsers]);
    
    // Handler for search input
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page on new search
    };

    // --- EDIT USER ---
    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setEditForm({ role: user.role, isActive: user.isActive });
        setIsEditModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingUser) return;
        if (!token) return toast.error("Authentication token missing. Please log in again.");

        setIsLoading(true); // Set global loading for API call feedback
        try {
            const response = await fetch(`${API_BASE_URL}/users/${editingUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to update user.");
            }

            toast.success("User updated successfully.");
            setIsEditModalOpen(false);
            // Re-fetch users to show updated data
            fetchUsers(currentPage, searchTerm, true); 
        } catch (err: any) {
            toast.error(err.message || "Failed to update user.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- DELETE USER ---
    const handleDelete = (user: User) => {
        setUserToDelete(user);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        if (!token) return toast.error("Authentication token missing. Please log in again.");

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userToDelete._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to delete user.");
            }

            toast.success("User deleted successfully.");
            setUserToDelete(null);
            // Re-fetch users to update the list, staying on the current page
            fetchUsers(currentPage, searchTerm, true); 
        } catch (err: any) {
            toast.error(err.message || "Failed to delete user.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- CLEAR ALL DATA ---
    const handleClearAllData = async () => {
        if (!token) return toast.error("Authentication token missing.");
        setIsClearingData(true);
        try {
            const response = await fetch(`${API_BASE_URL}/clear-all-data`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to clear data.");
            }

            toast.success("All non-admin data has been cleared.");
            setIsClearDataModalOpen(false);
            // Refresh the user list, which should now only contain the admin
            fetchUsers(1, '', true);
        } catch (err: any) {
            toast.error(err.message || "An error occurred while clearing data.");
        } finally {
            setIsClearingData(false);
        }
    };
    const getRoleBadgeType = (role: User['role']) => {
        switch (role) {
            case 'admin':
                return 'danger';
            case 'vendor':
                return 'info';
            case 'customer':
            default:
                return 'primary';
        }
    };
    
    // --- JSX ---

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header and Refresh Button */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                    <h1 className="text-4xl font-extrabold text-indigo-600 flex items-center mb-4 sm:mb-0">
                        <Users className="w-8 h-8 mr-3" /> User Management
                    </h1>
                    <button 
                        onClick={() => fetchUsers(currentPage, searchTerm, true)} 
                        disabled={isRefreshing}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 text-white rounded-lg shadow-md hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
                    </button>
                </div>
                
                {/* Search Bar and Error/Loading Indicators */}
                <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative flex-grow sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                    </div>
                    
                    {(isLoading && !isRefreshing) && (
                        <div className="flex items-center text-indigo-600">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            <span className="text-sm">Loading initial data...</span>
                        </div>
                    )}
                    {error && (
                        <div className="p-3 text-sm bg-red-100 text-red-700 rounded-lg flex items-center">
                            <XCircle className="w-5 h-5 mr-2"/>
                            {error}
                        </div>
                    )}
                </div>

                {/* Users Table */}
                <div className="bg-white shadow-xl rounded-xl overflow-hidden ring-1 ring-gray-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Name', 'Email', 'Role', 'Status', 'Verified', 'Registered', 'Actions'].map(header => (
                                        <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.length > 0 ? users.map(user => (
                                    <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {user.name} <br/>
                                            <span className="text-xs text-gray-500">{user.phone}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge type={getRoleBadgeType(user.role)}>
                                                {user.role}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.isActive ? (
                                                <Badge type="success">Active</Badge>
                                            ) : (
                                                <Badge type="danger">Inactive</Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {user.isVerified ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                                            <Clock className="w-4 h-4 mr-1 text-gray-400"/>
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                                            <button 
                                                onClick={() => handleEditClick(user)} 
                                                className="p-2 rounded-full text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit className="w-5 h-5"/>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(user)} 
                                                className="p-2 rounded-full text-red-600 hover:text-red-900 hover:bg-red-50 transition-colors"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-5 h-5"/>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500 text-lg">
                                            <Search className="w-8 h-8 mx-auto mb-2 text-gray-300"/>
                                            No users match your search criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="mt-8 flex justify-between items-center bg-white p-4 rounded-xl shadow-lg ring-1 ring-gray-200">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                            disabled={currentPage === 1} 
                            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            <ChevronLeft className="w-5 h-5 mr-1" /> Previous
                        </button>
                        
                        <span className="text-lg font-medium">
                            Page <span className="font-bold text-indigo-600">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
                        </span>
                        
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                            disabled={currentPage === totalPages} 
                            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            Next <ChevronRight className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                )}

                {/* Danger Zone Section */}
                <div className="mt-12 p-6 bg-red-50 border-2 border-dashed border-red-300 rounded-xl">
                    <div className="flex items-center">
                        <AlertTriangle className="w-8 h-8 text-red-500 mr-4" />
                        <div>
                            <h3 className="text-xl font-bold text-red-800">Danger Zone</h3>
                            <p className="text-red-700 mt-1">This action is destructive and cannot be undone.</p>
                        </div>
                    </div>
                    <div className="mt-4 pl-12">
                        <button
                            onClick={() => setIsClearDataModalOpen(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                        >
                            Clear All Non-Admin Data
                        </button>
                    </div>
                </div>

                {/* Edit Modal */}
                {isEditModalOpen && editingUser && (
                    <Modal title={`Edit User: ${editingUser.name}`} onClose={() => setIsEditModalOpen(false)}>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select 
                                    id="role"
                                    value={editForm.role} 
                                    onChange={e => setEditForm({...editForm, role: e.target.value as User['role']})} 
                                    className="w-full border border-gray-300 bg-white p-3 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="vendor">Vendor</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                            <div className="flex items-center">
                                <input 
                                    id="isActive"
                                    type="checkbox" 
                                    checked={editForm.isActive} 
                                    onChange={e => setEditForm({...editForm, isActive: e.target.checked})} 
                                    className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="isActive" className="ml-3 text-sm font-medium text-gray-700">User is Active</label>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button 
                                    onClick={() => setIsEditModalOpen(false)} 
                                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave} 
                                    className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-1"
                                >
                                    <Save className="w-4 h-4"/> Save Changes
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Delete Confirmation Modal */}
                {userToDelete && (
                    <Modal title="Confirm Deletion" onClose={() => setUserToDelete(null)}>
                        <div className="space-y-4">
                            <p className="text-gray-700">
                                You are about to permanently delete the user <strong className="text-red-600">{userToDelete.name}</strong> ({userToDelete.email}). 
                                <br/> <span className="font-semibold text-red-500">This action cannot be undone.</span>
                            </p>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button 
                                    onClick={() => setUserToDelete(null)} 
                                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmDelete} 
                                    className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 className="w-4 h-4"/> Delete User
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Clear All Data Confirmation Modal */}
                {isClearDataModalOpen && (
                    <Modal title="Confirm Clear All Data" onClose={() => setIsClearDataModalOpen(false)}>
                        <div className="space-y-4">
                            <p className="text-gray-700">
                                Are you absolutely sure you want to clear all data? This will permanently delete all users (except your admin account), vendors, services, and bookings.
                                <br/><br/>
                                <strong className="font-semibold text-red-600">This action is irreversible.</strong>
                            </p>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button 
                                    onClick={() => setIsClearDataModalOpen(false)} 
                                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleClearAllData}
                                    disabled={isClearingData}
                                    className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {isClearingData ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin"/>
                                            <span>Clearing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4"/> I Understand, Clear All Data
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default UserManagement;