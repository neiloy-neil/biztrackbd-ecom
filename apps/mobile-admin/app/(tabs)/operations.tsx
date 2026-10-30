import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Truck,
  Globe,
  Fingerprint,
  LogOut,
  UserCheck,
} from "lucide-react-native";

export default function OperationsScreen() {
  const router = useRouter();
  const { user, activeStore, logout } = useAuth();
  const [phoneQuery, setPhoneQuery] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [fraudResult, setFraudResult] = useState<{
    phone: string;
    trustScore: number;
    totalOrders: number;
    deliveredCount: number;
    returnedCount: number;
    riskLevel: string;
  } | null>(null);

  const [isBangla, setIsBangla] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);

  const handlePhoneCheck = () => {
    if (!phoneQuery.trim()) return;
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      // Realistic Bangladesh delivery trust check result
      const isRisky = phoneQuery.endsWith("99") || phoneQuery.endsWith("00");
      setFraudResult({
        phone: phoneQuery,
        trustScore: isRisky ? 42 : 91,
        totalOrders: isRisky ? 12 : 24,
        deliveredCount: isRisky ? 5 : 22,
        returnedCount: isRisky ? 7 : 2,
        riskLevel: isRisky ? "HIGH" : "LOW",
      });
    }, 600);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 py-3 border-b border-line bg-surface">
        <Text className="text-xl font-bold text-ink">Operations & Settings</Text>
        <Text className="text-xs text-ink-muted">
          Fraud radar, courier balance & security
        </Text>
      </View>

      <ScrollView contentContainerClassName="p-5 space-y-5">
        {/* Fraud Radar Phone Lookup Tool */}
        <View className="bg-surface border border-line rounded-3xl p-5 shadow-sm">
          <View className="flex-row items-center space-x-2 mb-2">
            <ShieldAlert size={18} color="#5B4FE8" />
            <Text className="font-bold text-sm text-ink ml-1.5">
              Customer Delivery Trust Radar
            </Text>
          </View>
          <Text className="text-xs text-ink-muted mb-3">
            Check any customer phone number across Steadfast and platform parcel histories.
          </Text>

          <View className="flex-row items-center space-x-2 mb-3">
            <View className="flex-1 flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line mr-2">
              <Search size={15} color="#6B6B8D" />
              <TextInput
                value={phoneQuery}
                onChangeText={setPhoneQuery}
                placeholder="017XXXXXXXX"
                keyboardType="phone-pad"
                className="flex-1 text-xs text-ink ml-2"
                placeholderTextColor="#9E9EB8"
              />
            </View>
            <TouchableOpacity
              onPress={handlePhoneCheck}
              disabled={isChecking || !phoneQuery}
              className={`px-4 py-2.5 rounded-xl ${
                isChecking || !phoneQuery ? "bg-brand/50" : "bg-brand"
              }`}
            >
              {isChecking ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-xs font-bold text-surface">Lookup</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Lookup Results */}
          {fraudResult && (
            <View
              className={`p-4 rounded-2xl border ${
                fraudResult.riskLevel === "LOW"
                  ? "bg-success/5 border-success/30"
                  : "bg-danger/5 border-danger/30"
              }`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center space-x-1.5">
                  {fraudResult.riskLevel === "LOW" ? (
                    <ShieldCheck size={18} color="#15803D" />
                  ) : (
                    <ShieldAlert size={18} color="#DC2626" />
                  )}
                  <Text
                    className={`font-bold text-sm ml-1.5 ${
                      fraudResult.riskLevel === "LOW" ? "text-success" : "text-danger"
                    }`}
                  >
                    {fraudResult.riskLevel === "LOW" ? "Low Risk / Safe" : "High Return Risk"}
                  </Text>
                </View>
                <Text
                  className={`text-base font-extrabold ${
                    fraudResult.riskLevel === "LOW" ? "text-success" : "text-danger"
                  }`}
                >
                  {fraudResult.trustScore}% Score
                </Text>
              </View>

              <View className="flex-row items-center justify-between pt-2 border-t border-line/40">
                <Text className="text-[11px] text-ink-muted">Total Parcels: {fraudResult.totalOrders}</Text>
                <Text className="text-[11px] text-success font-medium">Delivered: {fraudResult.deliveredCount}</Text>
                <Text className="text-[11px] text-danger font-medium">Returned: {fraudResult.returnedCount}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Courier Balance & Cashflow Summary */}
        <View className="bg-surface border border-line rounded-3xl p-5 shadow-sm">
          <View className="flex-row items-center space-x-2 mb-3">
            <Truck size={18} color="#0369A1" />
            <Text className="font-bold text-sm text-ink ml-1.5">
              Courier Receivables (COD)
            </Text>
          </View>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between py-2 border-b border-line/60">
              <Text className="text-xs font-semibold text-ink">Steadfast Courier</Text>
              <Text className="text-xs font-bold text-ink">৳ 38,400 pending</Text>
            </View>
            <View className="flex-row items-center justify-between py-2 border-b border-line/60">
              <Text className="text-xs font-semibold text-ink">Pathao Logistics</Text>
              <Text className="text-xs font-bold text-ink">৳ 14,250 pending</Text>
            </View>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-xs font-semibold text-ink">RedX Delivery</Text>
              <Text className="text-xs font-bold text-ink">৳ 6,800 pending</Text>
            </View>
          </View>
        </View>

        {/* Preferences & Security */}
        <View className="bg-surface border border-line rounded-3xl p-5 shadow-sm space-y-4">
          <Text className="font-bold text-sm text-ink mb-1">Preferences & Security</Text>

          <View className="flex-row items-center justify-between py-2 border-b border-line/60">
            <View className="flex-row items-center space-x-2.5">
              <Globe size={18} color="#6B6B8D" />
              <View className="ml-2">
                <Text className="text-xs font-semibold text-ink">Language (বাংলা)</Text>
                <Text className="text-[10px] text-ink-muted">Switch interface to Bengali</Text>
              </View>
            </View>
            <Switch
              value={isBangla}
              onValueChange={setIsBangla}
              trackColor={{ false: "#E7E7F0", true: "#5B4FE8" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View className="flex-row items-center justify-between py-2 border-b border-line/60">
            <View className="flex-row items-center space-x-2.5">
              <Fingerprint size={18} color="#6B6B8D" />
              <View className="ml-2">
                <Text className="text-xs font-semibold text-ink">Biometric App Lock</Text>
                <Text className="text-[10px] text-ink-muted">Require Face ID / Fingerprint on resume</Text>
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
              trackColor={{ false: "#E7E7F0", true: "#5B4FE8" }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Account Details */}
          <View className="pt-2">
            <View className="flex-row items-center space-x-2 mb-2">
              <UserCheck size={16} color="#6B6B8D" />
              <Text className="text-xs text-ink-muted ml-1.5">
                Signed in as <Text className="font-bold text-ink">{user?.email}</Text>
              </Text>
            </View>
            <Text className="text-[11px] text-ink-muted">
              Role: <Text className="font-bold text-brand uppercase">{user?.role}</Text> • Store:{" "}
              <Text className="font-bold text-ink">{activeStore?.name}</Text>
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-danger/5 border border-danger/20 py-3.5 rounded-2xl flex-row items-center justify-center mt-2"
        >
          <LogOut size={16} color="#DC2626" />
          <Text className="text-danger font-bold text-xs ml-2">Sign Out of Store</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
