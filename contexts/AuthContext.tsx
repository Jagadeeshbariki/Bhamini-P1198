import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AuthUser, AuthContextType, Session } from '../types';

export const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_DURATION = 12 * 60 * 60 * 1000;

// Authorized staff accounts
const HARDCODED_ACCOUNTS: Record<string, string> = {
  'Jagadeesh': 'Jagadeesh@P1198',
  'Manikumar': 'Manikumar@P1198',
  'Jeddiskung': 'Jeddiskung@P1198',
  'Simhachalam': 'Simhachalam@P1198',
  'Sampath': 'Sampath@P1198',
  'sampanth': 'sampanth@P1198',
  'Ganapathi': 'Ganapathi@P1198'
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionString = localStorage.getItem('bhamini_session');
    if (sessionString) {
      try {
        const session: Session = JSON.parse(sessionString);
        // Verify session is not expired AND the user still exists in our current code list
        if (session.expiry > Date.now() && HARDCODED_ACCOUNTS[session.user.username]) {
          setUser(session.user);
        } else {
          // Clear stale or invalid sessions
          localStorage.removeItem('bhamini_session');
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem('bhamini_session');
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Purely client-side authentication
    if (HARDCODED_ACCOUNTS[trimmedEmail] && HARDCODED_ACCOUNTS[trimmedEmail] === trimmedPassword) {
      const authUser: AuthUser = {
        username: trimmedEmail,
        // Only Jagadeesh has Admin privileges
        isAdmin: trimmedEmail === 'Jagadeesh',
        token: undefined
      };
      const session: Session = { user: authUser, expiry: Date.now() + SESSION_DURATION };
      localStorage.setItem('bhamini_session', JSON.stringify(session));
      setUser(authUser);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bhamini_session');
    setUser(null);
  }, []);

  const registerUser = useCallback(async (): Promise<boolean> => {
    console.warn("User registration is disabled in frontend-only mode.");
    return false;
  }, []);

  const getAllUsers = useCallback(async () => {
    // Returns the current list of users from the code
    return Object.keys(HARDCODED_ACCOUNTS).map(u => ({ username: u }));
  }, []);

  const value = { user, login, logout, getAllUsers, registerUser };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};