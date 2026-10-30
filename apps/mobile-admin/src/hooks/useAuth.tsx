import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { apiClient, setAuthCredentials } from "../api/client";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ActiveStore {
  tenantId: string;
  subdomain: string;
  name: string;
  role: string;
  accessState?: string;
}

export interface BusinessStore {
  userId: string;
  tenantId: string;
  subdomain: string;
  storeName: string;
  role: string;
  name: string;
  isActive: boolean;
  tenantStatus: string;
  isCurrent?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  activeStore: ActiveStore | null;
  stores: BusinessStore[];
  permissions: Record<string, "none" | "view" | "edit">;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchStore: (tenantId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeStore, setActiveStore] = useState<ActiveStore | null>(null);
  const [stores, setStores] = useState<BusinessStore[]>([]);
  const [permissions, setPermissions] = useState<Record<string, "none" | "view" | "edit">>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync("bt_access_token");
      const tenantId = await SecureStore.getItemAsync("bt_active_tenant_id");

      if (!token) {
        setIsLoading(false);
        return;
      }

      setAuthCredentials(token, tenantId);

      const res = await apiClient<{
        user: UserProfile;
        activeStore: ActiveStore;
        stores: BusinessStore[];
        permissions: Record<string, "none" | "view" | "edit">;
      }>("/api/mobile/v1/auth/me");

      setUser(res.user);
      setActiveStore(res.activeStore);
      setStores(res.stores);
      setPermissions(res.permissions);

      // Persist active tenant ID if changed
      if (res.activeStore?.tenantId) {
        await SecureStore.setItemAsync("bt_active_tenant_id", res.activeStore.tenantId);
        setAuthCredentials(token, res.activeStore.tenantId);
      }
    } catch (err) {
      console.warn("[Auth] Failed to restore session:", err);
      // Clean up invalid credentials
      await SecureStore.deleteItemAsync("bt_access_token");
      await SecureStore.deleteItemAsync("bt_active_tenant_id");
      setAuthCredentials(null, null);
      setUser(null);
      setActiveStore(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (email: string, password = "") => {
    setIsLoading(true);
    try {
      const res = await apiClient<{
        accessToken: string;
        refreshToken: string;
        user: UserProfile;
        activeStore: ActiveStore;
        stores: BusinessStore[];
        permissions: Record<string, "none" | "view" | "edit">;
      }>("/api/mobile/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      await SecureStore.setItemAsync("bt_access_token", res.accessToken);
      if (res.activeStore?.tenantId) {
        await SecureStore.setItemAsync("bt_active_tenant_id", res.activeStore.tenantId);
      }

      setAuthCredentials(res.accessToken, res.activeStore?.tenantId || null);

      setUser(res.user);
      setActiveStore(res.activeStore);
      setStores(res.stores);
      setPermissions(res.permissions);
    } finally {
      setIsLoading(false);
    }
  };

  const switchStore = async (newTenantId: string) => {
    const target = stores.find((s) => s.tenantId === newTenantId);
    if (!target) return;

    await SecureStore.setItemAsync("bt_active_tenant_id", newTenantId);
    const token = await SecureStore.getItemAsync("bt_access_token");
    setAuthCredentials(token, newTenantId);

    setActiveStore({
      tenantId: target.tenantId,
      subdomain: target.subdomain,
      name: target.storeName,
      role: target.role,
    });

    // Refresh profile and permissions with new tenant context
    await loadSession();
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("bt_access_token");
    await SecureStore.deleteItemAsync("bt_active_tenant_id");
    setAuthCredentials(null, null);
    setUser(null);
    setActiveStore(null);
    setStores([]);
    setPermissions({});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeStore,
        stores,
        permissions,
        isLoading,
        isAuthenticated: !!user && !!activeStore,
        login,
        logout,
        switchStore,
        refreshProfile: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
