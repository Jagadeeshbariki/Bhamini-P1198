
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AuthUser, AuthContextType, Session } from '../types';

export const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours

const users = [
    { username: 'user', password: 'password' },
    { username: 'Jagadeesh', password: 'Jagadeesh@P1198' },
    { username: 'Manikumar', password: 'Manikumar@P1198' },
    { username: 'Jeddiskung', password: 'Jeddiskung@P1198' },
    { username: 'Sampath', password: 'Sampath@P1198' },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const sessionString = localStorage.getItem('bhamini_session');
      if (sessionString) {
        const session: Session = JSON.parse(sessionString);
        if (session.expiry > Date.now()) {
          setUser(session.user);
        } else {
          localStorage.removeItem('bhamini_session');
        }
      }
    } catch (error) {
      console.error('Failed to parse session from localStorage', error);
      localStorage.removeItem('bhamini_session');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const foundUser = users.find(u => u.username === username && u.password === password);

    if (foundUser) {
      const authUser: AuthUser = { username: foundUser.username };
      const session: Session = {
        user: authUser,
        expiry: Date.now() + SESSION_DURATION,
      };
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

  const value = { user, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
