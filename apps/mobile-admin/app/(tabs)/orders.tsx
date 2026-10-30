import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Linking,
} from "react-native";
import { useOrders, OrderItem } from "../../src/hooks/useOrders";
import {
  Search,
  Phone,
  MessageCircle,
  Truck,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Package,
} from "lucide-react-native";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "Unconfirmed" },
  { id: "check", label: "bKash Verify" },
  { id: "to_pack", label: "To Pack" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "returns", label: "Returns" },
];

export default function OrdersScreen() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useOrders(activeTab, search || undefined);

  const orders = data?.orders || [];
  const tabCounts = data?.tabCounts || {};

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  };

  const handleWhatsApp = (phone: string, orderNumber: string, total: number) => {
    const cleanPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "880");
    const msg = encodeURIComponent(
      `আসসালামু আলাইকুম, BizTrackBD শপ থেকে আপনার অর্ডার #${orderNumber} সংক্রান্ত মেসেজ। মোট প্রদেয়: ৳${total}।`
    );
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${msg}`);
  };

  const renderOrderItem = ({ item }: { item: OrderItem }) => {
    const isCod = item.paymentMethod === "COD" || !item.paymentMethod;
    const isUnverified = item.paymentStatus === "UNPAID" && item.paymentMethod === "BKASH";

    return (
      <View className="bg-surface border border-line rounded-2xl p-4 mb-3.5 shadow-sm">
        {/* Card Header */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center space-x-2">
            <Text className="font-bold text-sm text-ink">{item.orderNumber}</Text>
            <View className="bg-canvas px-2 py-0.5 rounded ml-1.5">
              <Text className="text-[10px] font-semibold text-ink-muted">
                {isCod ? "Cash On Delivery" : item.paymentMethod}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center space-x-1.5">
            {item.trustScore !== undefined && (
              <View
                className={`flex-row items-center px-1.5 py-0.5 rounded ${
                  item.trustScore >= 80
                    ? "bg-success/10 text-success"
                    : item.trustScore >= 50
                    ? "bg-warning/10 text-warning"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {item.trustScore >= 80 ? (
                  <ShieldCheck size={11} color="#15803D" />
                ) : (
                  <ShieldAlert size={11} color="#B45309" />
                )}
                <Text
                  className={`text-[10px] font-bold ml-1 ${
                    item.trustScore >= 80
                      ? "text-success"
                      : item.trustScore >= 50
                      ? "text-warning"
                      : "text-danger"
                  }`}
                >
                  {item.trustScore}% Trust
                </Text>
              </View>
            )}

            <View className="bg-brand/10 px-2 py-0.5 rounded ml-1">
              <Text className="text-[10px] font-bold uppercase text-brand">
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer & Location */}
        <View className="mb-3">
          <Text className="font-semibold text-xs text-ink">{item.customerName}</Text>
          <Text className="text-xs text-ink-muted mt-0.5">
            {item.customerPhone} • {item.city || "Dhaka"}
          </Text>
        </View>

        {/* Items and Price */}
        <View className="flex-row items-center justify-between pt-2.5 border-t border-line/60">
          <View>
            <Text className="text-[11px] text-ink-muted">
              {item.itemsCount} item{item.itemsCount > 1 ? "s" : ""}
            </Text>
            <Text className="text-sm font-bold text-ink mt-0.5">
              ৳ {item.total.toLocaleString("en-BD")}
            </Text>
          </View>

          {/* 1-Tap Communication Bar */}
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={() => handleCall(item.customerPhone)}
              className="flex-row items-center bg-canvas px-3 py-1.5 rounded-xl border border-line mr-2"
            >
              <Phone size={13} color="#1A1A4E" />
              <Text className="text-xs font-semibold text-ink ml-1.5">Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleWhatsApp(item.customerPhone, item.orderNumber, item.total)}
              className="flex-row items-center bg-success/10 px-3 py-1.5 rounded-xl border border-success/20"
            >
              <MessageCircle size={13} color="#15803D" />
              <Text className="text-xs font-semibold text-success ml-1.5">WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header & Search */}
      <View className="p-4 border-b border-line bg-surface">
        <Text className="text-xl font-bold text-ink mb-3">Orders Command Center</Text>

        <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
          <Search size={16} color="#6B6B8D" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search order #, phone, customer..."
            className="flex-1 text-xs text-ink ml-2"
            placeholderTextColor="#9E9EB8"
          />
        </View>

        {/* Horizontal Status Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 -mx-4 px-4 flex-row"
        >
          {STATUS_TABS.map((tab) => {
            const count = tabCounts[tab.id];
            const isSelected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`mr-2 px-3 py-1.5 rounded-full flex-row items-center border ${
                  isSelected
                    ? "bg-brand border-brand"
                    : "bg-surface border-line"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? "text-surface" : "text-ink-muted"
                  }`}
                >
                  {tab.label}
                </Text>
                {count !== undefined && count > 0 && (
                  <View
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full ${
                      isSelected ? "bg-surface/20" : "bg-canvas"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        isSelected ? "text-surface" : "text-ink"
                      }`}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders Feed */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Package size={44} color="#9E9EB8" />
            <Text className="text-sm font-semibold text-ink mt-3">No orders found</Text>
            <Text className="text-xs text-ink-muted mt-1 text-center px-8">
              Orders matching this filter will appear here in real time.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
