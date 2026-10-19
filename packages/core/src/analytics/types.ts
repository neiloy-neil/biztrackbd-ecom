export interface HourlyVelocityPoint {
  hour: number; // 0 to 23
  label: string; // "12 AM", "1 AM", ... "11 PM"
  todayOrders: number;
  todaySales: number;
  yesterdayOrders: number;
  yesterdaySales: number;
}

export type FunnelStageType = "VIEWS" | "CART" | "CHECKOUT" | "ORDERED" | "DELIVERED";

export interface FunnelStageMetric {
  stage: FunnelStageType;
  label: string;
  count: number;
  dropOffRatePercent: number; // e.g. 42.5% drop from previous step
  conversionRatePercent: number; // percentage of initial views
}

export interface CohortRow {
  cohortMonth: string; // "YYYY-MM", e.g. "2026-08"
  cohortSize: number; // total new customers acquired in that month
  retentionM0: number; // 100%
  retentionM1: number; // % who purchased again in month + 1
  retentionM2: number; // % who purchased again in month + 2
  retentionM3: number; // % who purchased again in month + 3
  totalLtvBDT: number; // cumulative sales from this cohort
}

export interface DistrictShare {
  district: string;
  orders: number;
  sales: number;
  percentage: number;
}

export interface PaymentMethodShare {
  method: string;
  label: string;
  count: number;
  sales: number;
  percentage: number;
}

export interface HistoricalTrendPoint {
  date: string; // "YYYY-MM-DD"
  sales: number;
  orders: number;
  aov: number;
}

export interface RealtimeStudioPayload {
  kpis: {
    todaySales: number;
    yesterdaySales: number;
    salesChangePercent: number;
    todayOrders: number;
    yesterdayOrders: number;
    ordersChangePercent: number;
    todayAov: number;
    conversionRate: number;
    activeCartCount: number;
    abandonedCheckoutCount: number;
  };
  hourlyVelocity: HourlyVelocityPoint[];
  conversionFunnel: FunnelStageMetric[];
  cohorts: CohortRow[];
  districtBreakdown: DistrictShare[];
  paymentBreakdown: PaymentMethodShare[];
  historicalTrend: HistoricalTrendPoint[];
  lastUpdatedIso: string;
}

export interface DailyMetricsSummary {
  date: string; // "YYYY-MM-DD"
  grossSalesBDT: number;
  netSalesBDT: number;
  discountsTotalBDT: number;
  shippingTotalBDT: number;
  refundsTotalBDT: number;
  totalOrders: number;
  paidOrders: number;
  codOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  averageOrderValue: number;
  newCustomersCount: number;
  repeatOrdersCount: number;
}
