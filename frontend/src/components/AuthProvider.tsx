'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  isLoggedIn: boolean;
  userEmail: string | null;
  userRole: string | null;
  sessionToken: string | null;
  login: (email: string, token: string, role: string) => void;
  logout: (shouldRedirect?: boolean) => void;
  isAuthChecking: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isAdminRoute = pathname?.startsWith('/admin');

    let storedStatus = false;
    let storedEmail: string | null = null;
    let storedToken: string | null = null;
    let storedRole: string | null = null;

    if (isAdminRoute) {
      // Prioritize sessionStorage (admins)
      storedStatus = sessionStorage.getItem('isLoggedIn') === 'true';
      storedEmail = sessionStorage.getItem('userEmail');
      storedToken = sessionStorage.getItem('sessionToken');
      storedRole = sessionStorage.getItem('userRole');

      // Fallback to localStorage (merchants)
      if (!storedStatus) {
        storedStatus = localStorage.getItem('isLoggedIn') === 'true';
        storedEmail = localStorage.getItem('userEmail');
        storedToken = localStorage.getItem('sessionToken');
        storedRole = localStorage.getItem('userRole');
      }
    } else {
      // Prioritize localStorage (merchants)
      storedStatus = localStorage.getItem('isLoggedIn') === 'true';
      storedEmail = localStorage.getItem('userEmail');
      storedToken = localStorage.getItem('sessionToken');
      storedRole = localStorage.getItem('userRole');

      // Fallback to sessionStorage (admins)
      if (!storedStatus) {
        storedStatus = sessionStorage.getItem('isLoggedIn') === 'true';
        storedEmail = sessionStorage.getItem('userEmail');
        storedToken = sessionStorage.getItem('sessionToken');
        storedRole = sessionStorage.getItem('userRole');
      }
    }

    setIsLoggedIn(storedStatus);
    setUserEmail(storedEmail);
    setSessionToken(storedToken);
    setUserRole(storedRole);
    setIsAuthChecking(false);

    // Route Protection
    const isMerchantRoute = pathname?.startsWith('/merchant');
    
    // Don't redirect if already on a login page
    const isLoginPage = pathname === '/login' || pathname === '/admin/login';

    if (!storedStatus && !isLoginPage) {
      if (isAdminRoute) {
        router.push('/admin/login');
      } else if (isMerchantRoute) {
        router.push('/login');
      }
    } else if (storedStatus && !isLoginPage) {
      // Role enforcement
      if (isAdminRoute && storedRole !== 'admin') {
        router.push('/admin/login');
      } else if (isMerchantRoute && storedRole !== 'merchant') {
        router.push('/login');
      }
    }
  }, [pathname, router]);

  const login = (email: string, token: string, role: string) => {
    // Admins use sessionStorage (expires on tab close)
    // Merchants use localStorage (persists)
    const storage = role === 'admin' ? sessionStorage : localStorage;

    storage.setItem('isLoggedIn', 'true');
    storage.setItem('userEmail', email);
    storage.setItem('sessionToken', token);
    storage.setItem('userRole', role);
    
    setIsLoggedIn(true);
    setUserEmail(email);
    setSessionToken(token);
    setUserRole(role);

    if (role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/merchant');
    }
  };

  const logout = (shouldRedirect = true) => {
    // Clear everything from both storage types
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userRole');

    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('userRole');
    
    setIsLoggedIn(false);
    setUserEmail(null);
    setSessionToken(null);
    setUserRole(null);
    if (shouldRedirect) {
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userEmail, userRole, sessionToken, login, logout, isAuthChecking }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
