
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AuthUser, AuthContextType, Session } from '../types';
import { GOOGLE_SHEET_USERS_URL } from '../config';

export const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_DURATION = 12 * 60 * 60 * 1000;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionString = localStorage.getItem('bhamini_session');
    if (sessionString) {
      try {
        const session: Session = JSON.parse(sessionString);
        if (session.expiry > Date.now()) {
          setUser(session.user);
        } else {
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

  const parseCSV = (csv: string) => {
    if (!csv || !csv.trim()) return [];
    
    // Split lines and filter out empty ones
    const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 1) return [];
    
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      // Clean quotes from the beginning and end of values
      return result.map(v => v.replace(/^"|"$/g, '').trim());
    };

    const headers = parseLine(lines[0]).map(h => h.toUpperCase().replace(/\s+/g, ''));
    
    return lines.slice(1).map(line => {
      const vals = parseLine(line);
      const obj: any = {};
      headers.forEach((h, i) => {
        if (h) {
          obj[h] = vals[i] || '';
        }
      });
      return obj;
    });
  };

  const login = useCallback(async (usernameInput: string, passwordInput: string): Promise<boolean> => {
    try {
      const response = await fetch(`${GOOGLE_SHEET_USERS_URL}&t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`Sheet access failed: ${response.status}`);
      }

      const csvText = await response.text();
      const users = parseCSV(csvText);

      // Diagnostic search with trimmed, case-exact username and password
      const targetUser = usernameInput.trim();
      const targetPass = passwordInput.trim();

      const foundUser = users.find(u => 
        u.USERNAME === targetUser && 
        u.PASSWORD === targetPass
      );

      if (foundUser) {
        const rawRole = (foundUser.ROLE || 'field').toLowerCase().trim();
        const role = (['admin', 'project', 'field'].includes(rawRole) ? rawRole : 'field') as 'field' | 'project' | 'admin';
        
        const authUser: AuthUser = {
          username: foundUser.USERNAME,
          role: role,
          isAdmin: role === 'admin'
        };

        const session: Session = { 
          user: authUser, 
          expiry: Date.now() + SESSION_DURATION 
        };

        localStorage.setItem('bhamini_session', JSON.stringify(session));
        setUser(authUser);
        console.log(`✅ Authentication successful for ${authUser.username} as ${authUser.role}`);
        return true;
      }
      
      console.warn("❌ Auth: No matching user found. Ensure USERNAME and PASSWORD match the spreadsheet exactly.");
      return false;
    } catch (err) {
      console.error("❌ Auth: Connection error:", err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bhamini_session');
    setUser(null);
  }, []);

  const registerUser = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  const getAllUsers = useCallback(async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEET_USERS_URL}&t=${Date.now()}`, {
        cache: 'no-cache'
      });
      if (!response.ok) return [];
      const csvText = await response.text();
      const users = parseCSV(csvText);
      return users.map(u => ({ 
        username: u.USERNAME, 
        role: (u.ROLE || 'field').toLowerCase().trim() 
      }));
    } catch {
      return [];
    }
  }, []);

  const value = { user, login, logout, getAllUsers, registerUser };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
