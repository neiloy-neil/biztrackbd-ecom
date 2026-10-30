import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from "react-native";
import { Search, Boxes, Plus, Minus, AlertCircle } from "lucide-react-native";

interface MockProduct {
  id: string;
  title: string;
  sku: string;
  stock: number;
  price: number;
  isActive: boolean;
}

const INITIAL_PRODUCTS: MockProduct[] = [
  { id: "1", title: "Kapor Silk Saree - Crimson Red", sku: "KPR-SLK-RED", stock: 12, price: 3450, isActive: true },
  { id: "2", title: "Handloom Cotton Kurti - Navy", sku: "KPR-KRT-NVY", stock: 4, price: 1850, isActive: true },
  { id: "3", title: "Embroidered Panjabi - Pearl White", sku: "KPR-PNJ-WHT", stock: 0, price: 2900, isActive: false },
  { id: "4", title: "Leather Formal Loafers - Brown", sku: "KPR-SH-BRN", stock: 8, price: 4200, isActive: true },
  { id: "5", title: "Pure Pashmina Shawl - Black", sku: "KPR-SHL-BLK", stock: 2, price: 5600, isActive: true },
];

export default function InventoryScreen() {
  const [products, setProducts] = useState<MockProduct[]>(INITIAL_PRODUCTS);
  const [search, setSearch] = useState("");

  const updateStock = (id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newStock = Math.max(0, p.stock + delta);
          return { ...p, stock: newStock, isActive: newStock > 0 ? p.isActive : false };
        }
        return p;
      })
    );
  };

  const toggleActive = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="p-4 border-b border-line bg-surface">
        <Text className="text-xl font-bold text-ink mb-3">Inventory & Godown Stock</Text>

        <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
          <Search size={16} color="#6B6B8D" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, SKU..."
            className="flex-1 text-xs text-ink ml-2"
            placeholderTextColor="#9E9EB8"
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4"
        renderItem={({ item }) => {
          const isLow = item.stock <= 4 && item.stock > 0;
          const isOut = item.stock === 0;

          return (
            <View className="bg-surface border border-line rounded-2xl p-4 mb-3.5 shadow-sm">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 mr-3">
                  <Text className="font-bold text-sm text-ink">{item.title}</Text>
                  <Text className="text-xs text-ink-muted mt-0.5">SKU: {item.sku}</Text>
                </View>

                <View className="items-end">
                  <Text className="font-extrabold text-sm text-ink">
                    ৳ {item.price.toLocaleString("en-BD")}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-[10px] text-ink-muted mr-1.5">Active</Text>
                    <Switch
                      value={item.isActive}
                      onValueChange={() => toggleActive(item.id)}
                      trackColor={{ false: "#E7E7F0", true: "#5B4FE8" }}
                      thumbColor="#FFFFFF"
                      style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                    />
                  </View>
                </View>
              </View>

              <View className="flex-row items-center justify-between pt-3 border-t border-line/60">
                <View className="flex-row items-center">
                  <View
                    className={`px-2 py-0.5 rounded flex-row items-center mr-2 ${
                      isOut
                        ? "bg-danger/10 text-danger"
                        : isLow
                        ? "bg-warning/10 text-warning"
                        : "bg-success/10 text-success"
                    }`}
                  >
                    {isOut && <AlertCircle size={10} color="#DC2626" />}
                    <Text
                      className={`text-[10px] font-bold ${
                        isOut ? "text-danger ml-1" : isLow ? "text-warning" : "text-success"
                      }`}
                    >
                      {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-ink">Qty: {item.stock}</Text>
                </View>

                {/* Quick Stock Adjust Stepper */}
                <View className="flex-row items-center bg-canvas rounded-xl p-1 border border-line">
                  <TouchableOpacity
                    onPress={() => updateStock(item.id, -1)}
                    className="w-7 h-7 bg-surface rounded-lg items-center justify-center border border-line shadow-xs"
                  >
                    <Minus size={14} color="#1A1A4E" />
                  </TouchableOpacity>

                  <Text className="font-bold text-xs text-ink px-3">{item.stock}</Text>

                  <TouchableOpacity
                    onPress={() => updateStock(item.id, 1)}
                    className="w-7 h-7 bg-brand rounded-lg items-center justify-center shadow-xs"
                  >
                    <Plus size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Boxes size={44} color="#9E9EB8" />
            <Text className="text-sm font-semibold text-ink mt-3">No inventory found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
