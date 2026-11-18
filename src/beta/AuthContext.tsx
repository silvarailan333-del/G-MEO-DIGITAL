import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  DEFAULT_USER_PREFERENCES,
  saveUserPreferences,
  subscribeUserPreferences,
  type UserPreferences,
} from '../lib/firestoreStore';

export interface BetaCompanySummary {
  id: number;
  name: string;
  legalName: string;
  tradeName: string;
  segment: string;
  city: string;
  state: string;
  logoUrl: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  loading: boolean;
  companies: BetaCompanySummary[];
  activeCompanyId: number | null;
  setActiveCompanyId: (id: number | null) => void;
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  refreshProfile: () => Promise<BetaCompanySummary[]>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<BetaCompanySummary[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);

  const apiFetch = useCallback(
    async <T = unknown,>(url: string, init: RequestInit = {}): Promise<T> => {
      const current = auth.currentUser;
      if (!current) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      const token = await current.getIdToken();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || `Erro HTTP ${res.status}`);
      }
      return data as T;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setCompanies([]);
      setActiveCompanyId(null);
      return [];
    }
    const res = await apiFetch<{ companies: BetaCompanySummary[] }>('/api/beta/me');
    setCompanies(res.companies);
    setActiveCompanyId((prev) => {
      if (prev && res.companies.some((c) => c.id === prev)) return prev;
      return res.companies.length > 0 ? res.companies[0].id : null;
    });
    return res.companies;
  }, [apiFetch]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await refreshProfile();
        } catch (err) {
          console.error('Failed to sync profile:', err);
        }
      } else {
        setCompanies([]);
        setActiveCompanyId(null);
        setPreferences(DEFAULT_USER_PREFERENCES);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [refreshProfile]);

  useEffect(() => {
    if (!firebaseUser) {
      setPreferences(DEFAULT_USER_PREFERENCES);
      return;
    }
    const unsubPrefs = subscribeUserPreferences(firebaseUser.uid, (next) => {
      setPreferences(next);
    });
    return () => unsubPrefs();
  }, [firebaseUser]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (preferences.theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [preferences.theme]);

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const next: UserPreferences = {
        ...preferences,
        ...patch,
      };
      setPreferences(next);
      if (firebaseUser) {
        await saveUserPreferences(firebaseUser.uid, next);
      }
    },
    [firebaseUser, preferences]
  );

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleAuthProvider);
    await refreshProfile();
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await refreshProfile();
  };

  const registerWithEmail = async (fullName: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (fullName.trim()) {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    }
    await refreshProfile();
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    setCompanies([]);
    setActiveCompanyId(null);
    setPreferences(DEFAULT_USER_PREFERENCES);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        loading,
        companies,
        activeCompanyId,
        setActiveCompanyId,
        preferences,
        updatePreferences,
        refreshProfile,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useBetaAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useBetaAuth must be used inside AuthProvider');
  return ctx;
}
