import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001");

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: any,
    message?: string
  ) {
    super(message || data?.error || `API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

let cachedToken: string | null = null;
let cachedTenantId: string | null = null;

export function setAuthCredentials(token: string | null, tenantId: string | null) {
  cachedToken = token;
  cachedTenantId = tenantId;
}

export async function getStoredToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync("bt_access_token");
    return cachedToken;
  } catch {
    return null;
  }
}

export async function getStoredTenantId(): Promise<string | null> {
  if (cachedTenantId) return cachedTenantId;
  try {
    cachedTenantId = await SecureStore.getItemAsync("bt_active_tenant_id");
    return cachedTenantId;
  } catch {
    return null;
  }
}

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token = await getStoredToken();
  const tenantId = await getStoredTenantId();

  const url = new URL(`${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}
