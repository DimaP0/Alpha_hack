import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { Spin, Result, Button } from "antd";
import { http, session } from "../api/http";
import type { LoginResponse, MeResponse, Role } from "../api/contract-types";
interface AuthValue {
  user: MeResponse | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<Role>;
  logout: () => void;
  retry: () => void;
}
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(!!session.get());
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeRequest = useRef<AbortController>();
  useEffect(() => {
    const logout = () => {
      setUser(null);
      setError(null);
      setLoading(false);
      client.clear();
    };
    window.addEventListener("auth-expired", logout);
    const controller = new AbortController();
    activeRequest.current = controller;
    if (session.get()) {
      setLoading(true);
      setError(null);
      http<MeResponse>("/auth/me", { signal: controller.signal })
        .then((me) => {
          if (!controller.signal.aborted) setUser(me);
        })
        .catch((e: Error) => {
          if (
            e.name !== "AbortError" &&
            session.get() &&
            !controller.signal.aborted
          )
            setError(e);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    return () => {
      controller.abort();
      window.removeEventListener("auth-expired", logout);
    };
  }, [client, attempt]);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        retry: () => setAttempt((a) => a + 1),
        logout: () => {
          activeRequest.current?.abort();
          session.clear();
          setUser(null);
          setError(null);
          setLoading(false);
          client.clear();
        },
        login: async (email, password) => {
          const result = await http<LoginResponse>("/auth/login", {
            method: "POST",
            body: { email, password },
          });
          session.set(result.accessToken);
          client.clear();
          try {
            const me = await http<MeResponse>("/auth/me");
            setUser(me);
            setError(null);
            return me.role;
          } catch (e) {
            session.clear();
            throw e;
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider required");
  return value;
};
export function AuthGate() {
  const { user, loading, error, retry, logout } = useAuth();
  if (loading)
    return (
      <div className="center">
        <Spin tip="Проверяем сессию" fullscreen />
      </div>
    );
  if (error)
    return (
      <Result
        status="warning"
        title="Не удалось проверить сессию"
        subTitle={error.message}
        extra={
          <>
            <Button onClick={retry}>Повторить</Button>
            <Button onClick={logout}>Выйти</Button>
          </>
        }
      />
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function RoleRoute({ role }: { role: Role }) {
  const { user } = useAuth();
  return user?.role === role ? (
    <Outlet />
  ) : (
    <Navigate to={user?.role === "BANK_OFFICER" ? "/bank" : "/app"} replace />
  );
}
