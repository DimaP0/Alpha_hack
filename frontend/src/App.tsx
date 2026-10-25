import { ConfigProvider, Result } from "antd";
import ruRU from "antd/locale/ru_RU";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthGate, AuthProvider, RoleRoute } from "./features/auth";
import { AppShell } from "./components/AppShell";
import { Login } from "./pages/Login";
import { BankDashboard, Dashboard, ProductsPage } from "./pages/Dashboard";
import { CompanyPage } from "./pages/Company";
import { TwinPage } from "./pages/Twin";
import { ApplicationPage, ApplicationsPage } from "./pages/Applications";
import { ApiError } from "./api/http";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && count < 1,
    },
    mutations: { retry: false },
  },
});
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AuthGate />}>
        <Route element={<AppShell />}>
          <Route element={<RoleRoute role="ENTREPRENEUR" />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/company" element={<CompanyPage />} />
            <Route path="/app/products" element={<ProductsPage />} />
            <Route path="/app/twin" element={<TwinPage />} />
            <Route path="/app/applications" element={<ApplicationsPage />} />
            <Route path="/app/applications/:id" element={<ApplicationPage />} />
          </Route>
          <Route element={<RoleRoute role="BANK_OFFICER" />}>
            <Route path="/bank" element={<BankDashboard />} />
            <Route path="/bank/applications" element={<ApplicationsPage />} />
            <Route
              path="/bank/applications/:id"
              element={<ApplicationPage />}
            />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route
        path="*"
        element={
          <Result
            status="404"
            title="Страница не найдена"
            extra={<Link to="/app">На главную</Link>}
          />
        }
      />
    </Routes>
  );
}
export default function App() {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: "#e32636",
          colorInfo: "#26766a",
          borderRadius: 12,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          colorBgLayout: "#f5f6f8",
          colorText: "#24282d",
        },
        components: {
          Button: { primaryShadow: "none" },
          Card: { paddingLG: 24 },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
