import React from "react";
import { Tabs } from "expo-router";
import { View, Text, Platform } from "react-native";
import { Home, Package, PlusCircle, Boxes, Sliders } from "lucide-react-native";
import { useDashboard } from "../../src/hooks/useDashboard";

export default function TabsLayout() {
  const { data } = useDashboard();
  const pendingCount = (data?.counts.check || 0) + (data?.counts.newOrders || 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#5B4FE8",
        tabBarInactiveTintColor: "#6B6B8D",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E7E7F0",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Package size={size} color={color} />
              {pendingCount > 0 && (
                <View className="absolute -top-1.5 -right-2.5 bg-danger rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-[10px] font-bold text-surface">{pendingCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="quick-order"
        options={{
          title: "Quick Order",
          tabBarIcon: ({ color }) => (
            <View className="bg-brand w-11 h-11 rounded-full items-center justify-center -mt-4 shadow-lg shadow-brand/30">
              <PlusCircle size={26} color="#FFFFFF" />
            </View>
          ),
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 11, fontWeight: "700" }}>Quick Order</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => <Boxes size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: "Operations",
          tabBarIcon: ({ color, size }) => <Sliders size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
