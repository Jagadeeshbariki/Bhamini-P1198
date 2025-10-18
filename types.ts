
export interface AuthUser {
  username: string;
}

export interface Session {
  user: AuthUser;
  expiry: number;
}

export interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}
