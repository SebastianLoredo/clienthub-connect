import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nombre: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (nombre: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, nombre: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (nombre) {
      await updateProfile(cred.user, { displayName: nombre });
      setUser({ ...cred.user });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateName = async (nombre: string) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: nombre });
    setUser({ ...auth.currentUser });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
