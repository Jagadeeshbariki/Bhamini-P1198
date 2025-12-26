
export interface AuthUser {
  username: string;
  isAdmin?: boolean;
}

export interface Session {
  user: AuthUser;
  expiry: number;
}

export interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (username: string, password: string) => void;
  getAllUsers: () => { username: string }[];
}
