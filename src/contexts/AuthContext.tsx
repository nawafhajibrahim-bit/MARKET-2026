import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDb } from '../database/Provider';
import type { UserDocType, BranchDocType } from '../database/schema';

export type UserRole = 'admin' | 'cashier' | 'manager';

interface AuthContextType {
  currentUser: UserDocType | null;
  currentBranch: BranchDocType | null;
  availableBranches: BranchDocType[];
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchBranch: (branchId: string) => Promise<void>;
  isAdmin: boolean;
  isCashier: boolean;
  isManager: boolean;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Simple hash function (SHA-256 via Web Crypto API)
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useDb();
  const [currentUser, setCurrentUser] = useState<UserDocType | null>(null);
  const [currentBranch, setCurrentBranch] = useState<BranchDocType | null>(null);
  const [availableBranches, setAvailableBranches] = useState<BranchDocType[]>([]);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedUserId = localStorage.getItem('sm_current_user_id');
        const savedBranchId = localStorage.getItem('sm_current_branch_id');
        
        if (savedUserId) {
          const userDoc = await db.users.findOne(savedUserId).exec();
          if (userDoc && userDoc.toJSON().is_active) {
            setCurrentUser(userDoc.toJSON());
          } else {
            localStorage.removeItem('sm_current_user_id');
          }
        }

        const branchDocs = await db.branches.find({ selector: { is_active: { $eq: true } } }).exec();
        const branches = branchDocs.map(d => d.toJSON());
        setAvailableBranches(branches);

        if (savedBranchId) {
          const branch = branches.find(b => b.branch_id === savedBranchId);
          if (branch) setCurrentBranch(branch);
        }
      } catch (err) {
        console.error('Auth session load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [db]);

  // Seed default admin and branch if none exist (first run)
  useEffect(() => {
    const seedDefaults = async () => {
      try {
        const userCount = await db.users.find().exec().then(docs => docs.length);
        if (userCount === 0) {
          // Create default admin user
          const adminHash = await hashPassword('admin', 'sm_salt_2025');
          await db.users.insert({
            user_id: 'user-admin-1',
            username: 'admin',
            password_hash: adminHash,
            display_name: 'Administrator',
            role: 'admin',
            branch_id: '',
            created_at: new Date().toISOString(),
            is_active: true
          });
          console.log('Default admin user created: admin / admin');
        }

        const branchCount = await db.branches.find().exec().then(docs => docs.length);
        if (branchCount === 0) {
          await db.branches.insert({
            branch_id: 'branch-main-1',
            name: 'Main Branch / الفرع الرئيسي',
            address: '',
            phone: '',
            is_active: true,
            created_at: new Date().toISOString()
          });
          console.log('Default branch created');
          
          // Refresh branches list
          const branchDocs = await db.branches.find({ selector: { is_active: { $eq: true } } }).exec();
          setAvailableBranches(branchDocs.map(d => d.toJSON()));
        }
      } catch (err) {
        console.error('Seed defaults error:', err);
      }
    };

    if (!loading) {
      seedDefaults();
    }
  }, [db, loading]);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const userDoc = await db.users.findOne({ selector: { username: { $eq: username.toLowerCase().trim() } } }).exec();
      if (!userDoc) {
        return { success: false, error: 'Invalid username or password' };
      }

      const user = userDoc.toJSON();
      if (!user.is_active) {
        return { success: false, error: 'Account is disabled' };
      }

      const passwordHash = await hashPassword(password, 'sm_salt_2025');
      if (passwordHash !== user.password_hash) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Set current user
      setCurrentUser(user);
      localStorage.setItem('sm_current_user_id', user.user_id);

      // Set branch if user has one assigned
      if (user.branch_id) {
        const branchDoc = await db.branches.findOne(user.branch_id).exec();
        if (branchDoc) {
          const branch = branchDoc.toJSON();
          setCurrentBranch(branch);
          localStorage.setItem('sm_current_branch_id', branch.branch_id);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }, [db]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentBranch(null);
    localStorage.removeItem('sm_current_user_id');
    localStorage.removeItem('sm_current_branch_id');
  }, []);

  const switchBranch = useCallback(async (branchId: string) => {
    const branchDoc = await db.branches.findOne(branchId).exec();
    if (branchDoc) {
      const branch = branchDoc.toJSON();
      setCurrentBranch(branch);
      localStorage.setItem('sm_current_branch_id', branch.branch_id);
    }
  }, [db]);

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager' || isAdmin;
  const isCashier = currentUser?.role === 'cashier' || isManager;
  const isAuthenticated = !!currentUser;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentBranch,
        availableBranches,
        login,
        logout,
        switchBranch,
        isAdmin,
        isCashier,
        isManager,
        isAuthenticated,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
