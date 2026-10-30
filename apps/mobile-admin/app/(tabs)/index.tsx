import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { useDashboard } from "../../src/hooks/useDashboard";
import { StoreSwitcherModal } from "../../src/components/layout/StoreSwitcherModal";
import {
  ChevronDown,
  Bell,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  Truck,
  PlusCircle,
  ShieldCheck,
  Barcode,
} from "lucide-react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { activeStore } = useAuth();
  const { data, isLoading, refetch } = useDashboard();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const counts = data?.counts || {
    check: 0,
    newOrders: 0,
    toPack: 0,
    returnsPending: 0,
    lowStock: 0,
    items: [],
  };

  const metrics = data?.metrics || {
    revenueToday: 0,
    ordersToday: 0,
    netProfit: 0,
    pendingVerification: 0,
    toPackCount: 0,
    returnsPending: 0,
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Top Header */}
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-line bg-surface">
        <TouchableOpacity
          onPress={() => setSwitcherVisible(true)}
          className="flex-row items-center space-x-1.5 bg-canvas px-3 py-1.5 rounded-full"
        >
          <Text className="text-sm font-bold text-ink mr-1">
            {activeStore?.name || "Select Store"}
          </Text>
          <ChevronDown size={14} color="#1A1A4E" />
        </TouchableOpacity>

        <View className="flex-row items-center space-x-3">
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/orders")}
            className="w-9 h-9 rounded-full bg-canvas items-center justify-center relative"
          >
            <Bell size={18} color="#1A1A4E" />
            {counts.check + counts.newOrders > 0 && (
              <View className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-danger ring-2 ring-surface" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-canvas/30"
        contentContainerClassName="p-5 space-y-5"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Urgent Action Banner Cards */}
        {counts.check > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/orders")}
            className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex-row items-center justify-between shadow-sm"
          >
            <View className="flex-row items-center space-x-3 flex-1">
              <View className="w-10 h-10 rounded-xl bg-warning/20 items-center justify-center mr-3">
                <AlertTriangle size={20} color="#B45309" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-wider text-warning">
                  Payment Verification
                </Text>
                <Text className="text-sm font-semibold text-ink mt-0.5">
                  {counts.check} manual bKash/Nagad TrxID checks waiting
                </Text>
              </View>
            </View>
            <Text className="text-xs font-bold text-warning underline">Review</Text>
          </TouchableOpacity>
        )}

        {/* Today's Sales Pulse Card */}
        <View className="bg-brand rounded-3xl p-5 shadow-lg shadow-brand/20">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold tracking-wider uppercase text-surface/80">
              Today's Overview
            </Text>
            <View className="flex-row items-center bg-surface/20 px-2 py-0.5 rounded-full">
              <TrendingUp size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-bold text-surface ml-1.5">Live GMV</Text>
            </View>
          </View>

          <View className="flex-row items-baseline mb-4">
            <Text className="text-3xl font-extrabold text-surface mr-1">
              ৳ {metrics.revenueToday.toLocaleString("en-BD")}
            </Text>
            <Text className="text-xs text-surface/70">BDT</Text>
          </View>

          <View className="flex-row items-center justify-between pt-4 border-t border-surface/20">
            <View>
              <Text className="text-[11px] text-surface/75">Orders Placed</Text>
              <Text className="text-base font-bold text-surface mt-0.5">
                {metrics.ordersToday}
              </Text>
            </View>
            <View>
              <Text className="text-[11px] text-surface/75">To Pack</Text>
              <Text className="text-base font-bold text-surface mt-0.5">
                {counts.toPack}
              </Text>
            </View>
            <View>
              <Text className="text-[11px] text-surface/75">Pending Action</Text>
              <Text className="text-base font-bold text-surface mt-0.5">
                {counts.check + counts.newOrders}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Action Matrix */}
        <View className="flex-row items-center justify-between space-x-3">
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/quick-order")}
            className="flex-1 bg-surface border border-line p-4 rounded-2xl items-center justify-center mr-2 shadow-sm"
          >
            <View className="w-10 h-10 rounded-full bg-brand/10 items-center justify-center mb-2">
              <PlusCircle size={22} color="#5B4FE8" />
            </View>
            <Text className="font-semibold text-xs text-ink text-center">Quick Order</Text>
            <Text className="text-[10px] text-ink-muted text-center mt-0.5">Chat / Phone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/orders")}
            className="flex-1 bg-surface border border-line p-4 rounded-2xl items-center justify-center mr-2 shadow-sm"
          >
            <View className="w-10 h-10 rounded-full bg-success/10 items-center justify-center mb-2">
              <Barcode size={22} color="#15803D" />
            </View>
            <Text className="font-semibold text-xs text-ink text-center">Scan to Pack</Text>
            <Text className="text-[10px] text-ink-muted text-center mt-0.5">Camera Barcode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/operations")}
            className="flex-1 bg-surface border border-line p-4 rounded-2xl items-center justify-center shadow-sm"
          >
            <View className="w-10 h-10 rounded-full bg-info/10 items-center justify-center mb-2">
              <ShieldCheck size={22} color="#0369A1" />
            </View>
            <Text className="font-semibold text-xs text-ink text-center">Fraud Trust</Text>
            <Text className="text-[10px] text-ink-muted text-center mt-0.5">Phone Check</Text>
          </TouchableOpacity>
        </View>

        {/* Fulfillment Pipeline Summary */}
        <View className="bg-surface border border-line rounded-3xl p-5 shadow-sm">
          <Text className="text-sm font-bold text-ink mb-4">Fulfillment Pipeline</Text>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between py-2 border-b border-line/60">
              <View className="flex-row items-center space-x-3">
                <View className="w-8 h-8 rounded-lg bg-info/10 items-center justify-center mr-3">
                  <Package size={16} color="#0369A1" />
                </View>
                <Text className="text-xs font-semibold text-ink">New Orders Waiting Call</Text>
              </View>
              <Text className="text-xs font-bold text-ink">{counts.newOrders}</Text>
            </View>

            <View className="flex-row items-center justify-between py-2 border-b border-line/60">
              <View className="flex-row items-center space-x-3">
                <View className="w-8 h-8 rounded-lg bg-warning/10 items-center justify-center mr-3">
                  <AlertTriangle size={16} color="#B45309" />
                </View>
                <Text className="text-xs font-semibold text-ink">bKash/Nagad Verifications</Text>
              </View>
              <Text className="text-xs font-bold text-ink">{counts.check}</Text>
            </View>

            <View className="flex-row items-center justify-between py-2 border-b border-line/60">
              <View className="flex-row items-center space-x-3">
                <View className="w-8 h-8 rounded-lg bg-brand/10 items-center justify-center mr-3">
                  <Barcode size={16} color="#5B4FE8" />
                </View>
                <Text className="text-xs font-semibold text-ink">Confirmed Waiting to Pack</Text>
              </View>
              <Text className="text-xs font-bold text-ink">{counts.toPack}</Text>
            </View>

            <View className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center space-x-3">
                <View className="w-8 h-8 rounded-lg bg-danger/10 items-center justify-center mr-3">
                  <Truck size={16} color="#DC2626" />
                </View>
                <Text className="text-xs font-semibold text-ink">Returns & Cancellations</Text>
              </View>
              <Text className="text-xs font-bold text-ink">{counts.returnsPending}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Store Switcher Modal */}
      <StoreSwitcherModal visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
    </SafeAreaView>
  );
}
