
export interface AuthUser {
  username: string;
  email?: string;
  isAdmin?: boolean;
  role: 'field' | 'project' | 'admin';
  token?: string;
}

export interface Session {
  user: AuthUser;
  expiry: number;
}

export interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAllUsers: () => Promise<{ username: string; role: string }[]>;
  registerUser: (username: string, email: string, password: string, isAdmin: boolean) => Promise<boolean>;
}

export interface BackendImage {
  _id?: string;
  url: string;
  type?: 'slider' | 'gallery';
  title?: string;
}
