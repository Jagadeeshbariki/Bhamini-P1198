
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AuthUser, AuthContextType, Session } from '../types';

export const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours

const DEFAULT_USERS = [
    { username: 'Jagadeesh', password: 'Jagadeesh@P1198', isAdmin: true },
    { username: 'admin', password: 'password', isAdmin: false },
    { username: 'Manikumar', password: 'Manikumar@P1198', isAdmin: false },
    { username: 'Jeddiskung', password: 'Jeddiskung@P1198', isAdmin: false },
    { username: 'Sampath', password: 'Sampath@P1198', isAdmin: false },
    { username: 'Simhachalam', password: 'Simhachalam@P1198', isAdmin: false }
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    // Initialize users from localStorage or defaults
    const storedUsers = localStorage.getItem('bhamini_users');
    let currentUsersList = [];
    
    if (storedUsers) {
      currentUsersList = JSON.parse(storedUsers);
      
      // Migration/Enforcement: Ensure ONLY Jagadeesh is admin in the stored list
      let modified = false;
      currentUsersList = currentUsersList.map((u: any) => {
        if (u.username === 'Jagadeesh' && !u.isAdmin) {
          modified = true;
          return { ...u, isAdmin: true };
        }
        if (u.username !== 'Jagadeesh' && u.isAdmin) {
          modified = true;
          return { ...u, isAdmin: false };
        }
        return u;
      });
      
      if (modified) {
        localStorage.setItem('bhamini_users', JSON.stringify(currentUsersList));
      }
      setAllUsers(currentUsersList);
    } else {
      localStorage.setItem('bhamini_users', JSON.stringify(DEFAULT_USERS));
      setAllUsers(DEFAULT_USERS);
      currentUsersList = DEFAULT_USERS;
    }

    try {
      const sessionString = localStorage.getItem('bhamini_session');
      if (sessionString) {
        const session: Session = JSON.parse(sessionString);
        if (session.expiry > Date.now()) {
          // Re-verify admin status from the master user list in case it changed
          const masterUser = currentUsersList.find((u: any) => u.username === session.user.username);
          const verifiedUser: AuthUser = {
            ...session.user,
            isAdmin: masterUser ? masterUser.isAdmin : false
          };
          setUser(verifiedUser);
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
    const currentUsers = JSON.parse(localStorage.getItem('bhamini_users') || JSON.stringify(DEFAULT_USERS));
    const foundUser = currentUsers.find((u: any) => u.username === username && u.password === password);

    if (foundUser) {
      const authUser: AuthUser = { 
        username: foundUser.username, 
        isAdmin: foundUser.isAdmin 
      };
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

  const addUser = useCallback((username: string, password: string) => {
    const currentUsers = JSON.parse(localStorage.getItem('bhamini_users') || JSON.stringify(DEFAULT_USERS));
    if (currentUsers.some((u: any) => u.username === username)) return;
    
    // Explicitly set isAdmin: false for all new users added via the panel
    const newUserList = [...currentUsers, { username, password, isAdmin: false }];
    localStorage.setItem('bhamini_users', JSON.stringify(newUserList));
    setAllUsers(newUserList);
  }, []);

  const getAllUsers = useCallback(() => {
    return allUsers.map(u => ({ username: u.username }));
  }, [allUsers]);

  const value = { user, login, logout, addUser, getAllUsers };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
