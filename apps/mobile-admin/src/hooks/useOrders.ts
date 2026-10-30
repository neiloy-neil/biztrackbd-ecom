import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuth } from "./useAuth";

export interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  courierName?: string | null;
  trackingCode?: string | null;
  itemsCount: number;
  createdAt: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  trustScore?: number;
}

export interface OrdersResponse {
  orders: OrderItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  tabCounts: Record<string, number>;
}

export function useOrders(tab = "all", search?: string, page = 1) {
  const { activeStore, isAuthenticated } = useAuth();

  return useQuery<OrdersResponse>({
    queryKey: ["orders", activeStore?.tenantId, tab, search, page],
    queryFn: () =>
      apiClient<OrdersResponse>("/api/mobile/v1/orders", {
        params: { tab, search, page, pageSize: 20 },
      }),
    enabled: isAuthenticated && !!activeStore?.tenantId,
  });
}
