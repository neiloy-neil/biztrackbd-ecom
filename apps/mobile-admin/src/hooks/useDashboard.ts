import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuth } from "./useAuth";

export interface DashboardData {
  store: {
    id: string;
    name: string;
    subdomain: string;
  };
  counts: {
    check: number;
    newOrders: number;
    toPack: number;
    returnsPending: number;
    lowStock: number;
    items: Array<{
      kind: string;
      orderId: string;
      orderNumber: string;
      text: string;
      time: string;
    }>;
  };
  metrics: {
    revenueToday: number;
    ordersToday: number;
    netProfit: number;
    pendingVerification: number;
    toPackCount: number;
    returnsPending: number;
    courierHealth?: any[];
    funnel?: any;
  };
}

export function useDashboard() {
  const { activeStore, isAuthenticated } = useAuth();

  return useQuery<DashboardData>({
    queryKey: ["dashboard", activeStore?.tenantId],
    queryFn: () => apiClient<DashboardData>("/api/mobile/v1/dashboard"),
    enabled: isAuthenticated && !!activeStore?.tenantId,
    refetchInterval: 30_000, // Background poll every 30s
  });
}
