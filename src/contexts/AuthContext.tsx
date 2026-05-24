import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { logAudit } from "@/lib/audit";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "towa123";
const ADMIN_BOOTSTRAP_FLAG = "totum_admin_bootstrap_v1";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nombre: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (nombre: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function ensureUserDoc(u: User): Promise<string> {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as { role?: string };
    return data.role ?? "user";
  }
  const role = u.email === ADMIN_EMAIL ? "admin" : "user";
  await setDoc(ref, {
    email: u.email,
    displayName: u.displayName ?? null,
    role,
    createdAt: serverTimestamp(),
  });
  return role;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);

  // Auto-bootstrap usuario admin una sola vez por navegador.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(ADMIN_BOOTSTRAP_FLAG)) return;
    (async () => {
      try {
        const hadUser = !!auth.currentUser;
        const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        await updateProfile(cred.user, { displayName: "Administrador" });
        await setDoc(doc(db, "users", cred.user.uid), {
          email: ADMIN_EMAIL,
          displayName: "Administrador",
          role: "admin",
          createdAt: serverTimestamp(),
        });
        if (!hadUser) await signOut(auth);
        localStorage.setItem(ADMIN_BOOTSTRAP_FLAG, "1");
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === "auth/email-already-in-use") {
          localStorage.setItem(ADMIN_BOOTSTRAP_FLAG, "1");
        }
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const r = await ensureUserDoc(u);
          setRole(r);
        } catch {
          setRole("user");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    void logAudit("login", { email });
  };

  const register = async (email: string, password: string, nombre: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (nombre) {
      await updateProfile(cred.user, { displayName: nombre });
      setUser({ ...cred.user });
    }
    void logAudit("register", { email, nombre });
  };

  const logout = async () => {
    void logAudit("logout", { email: auth.currentUser?.email });
    await signOut(auth);
  };

  const updateName = async (nombre: string) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: nombre });
    setUser({ ...auth.currentUser });
    void logAudit("update_profile", { nombre });
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, role, isAdmin: role === "admin", login, register, logout, updateName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
