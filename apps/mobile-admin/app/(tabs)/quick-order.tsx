import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../src/hooks/useAuth";
import {
  Sparkles,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  Truck,
  CheckCircle,
} from "lucide-react-native";

export default function QuickOrderScreen() {
  const { activeStore } = useAuth();
  const [rawText, setRawText] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryZone, setDeliveryZone] = useState<"INSIDE" | "OUTSIDE">("INSIDE");
  const [itemNote, setItemNote] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 15-second Chat Parser: Extracts phone, name, and address from raw text
  const handleParse = () => {
    if (!rawText.trim()) return;

    // 1. Phone matching
    const phoneMatch = rawText.match(/(?:(?:\+|00)88|01)?\d{9,11}/);
    if (phoneMatch) {
      setPhone(phoneMatch[0]);
    }

    // 2. Simple address heuristic
    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && !customerName) {
      setCustomerName(lines[0]);
    }
    if (lines.length > 1) {
      setAddress(lines.slice(1).join(", "));
    }

    // 3. Zone detection
    if (/chittagong|sylhet|rajshahi|khulna|barisal|rangpur|mymensingh/i.test(rawText)) {
      setDeliveryZone("OUTSIDE");
    } else if (/dhaka|mirpur|gulshan|banani|dhanmondi|uttara/i.test(rawText)) {
      setDeliveryZone("INSIDE");
    }
  };

  const deliveryCharge = deliveryZone === "INSIDE" ? 80 : 150;
  const subtotal = parseFloat(amount) || 0;
  const total = subtotal + deliveryCharge;

  const handleSubmit = async () => {
    if (!customerName || !phone || !address || subtotal <= 0) {
      Alert.alert("Missing Fields", "Please provide customer name, phone, address, and amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Mock / Submit to API
      setTimeout(() => {
        setIsSubmitting(false);
        Alert.alert("Order Created", `Quick Order successfully created for ৳${total} (COD).`);
        // Reset form
        setRawText("");
        setCustomerName("");
        setPhone("");
        setAddress("");
        setItemNote("");
        setAmount("");
      }, 700);
    } catch {
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to place quick order.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 py-3 border-b border-line bg-surface">
        <Text className="text-xl font-bold text-ink">15-Second Quick Order Desk</Text>
        <Text className="text-xs text-ink-muted">
          Fast order intake for Facebook Messenger & WhatsApp
        </Text>
      </View>

      <ScrollView contentContainerClassName="p-5 space-y-4">
        {/* Smart Chat Parser Box */}
        <View className="bg-brand/5 border border-brand/20 rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-1.5">
              <Sparkles size={16} color="#5B4FE8" />
              <Text className="text-xs font-bold text-brand ml-1">
                Paste Customer Chat Text
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleParse}
              className="bg-brand px-3 py-1 rounded-lg"
            >
              <Text className="text-[11px] font-bold text-surface">Auto-Parse</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder="e.g. Ayesha Rahman, Mirpur-10, Dhaka. 01711000000. 1pc Silk Saree"
            multiline
            numberOfLines={3}
            className="w-full bg-surface border border-brand/20 rounded-xl p-3 text-xs text-ink mt-1"
            placeholderTextColor="#9E9EB8"
          />
        </View>

        {/* Customer Information */}
        <View className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <Text className="text-xs font-bold uppercase text-ink-muted tracking-wider">
            Customer Information
          </Text>

          <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
            <User size={15} color="#6B6B8D" />
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Full Customer Name"
              className="flex-1 text-xs text-ink ml-2"
              placeholderTextColor="#9E9EB8"
            />
          </View>

          <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
            <Phone size={15} color="#6B6B8D" />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="01XXXXXXXXX"
              keyboardType="phone-pad"
              className="flex-1 text-xs text-ink ml-2"
              placeholderTextColor="#9E9EB8"
            />
          </View>

          <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
            <MapPin size={15} color="#6B6B8D" />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Full delivery address, Thana, District"
              className="flex-1 text-xs text-ink ml-2"
              placeholderTextColor="#9E9EB8"
            />
          </View>
        </View>

        {/* Delivery Zone Selector */}
        <View className="bg-surface border border-line rounded-2xl p-4">
          <Text className="text-xs font-bold uppercase text-ink-muted tracking-wider mb-2.5">
            Courier Delivery Zone
          </Text>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={() => setDeliveryZone("INSIDE")}
              className={`flex-1 p-3 rounded-xl border flex-row items-center justify-between mr-2 ${
                deliveryZone === "INSIDE"
                  ? "bg-brand/10 border-brand"
                  : "bg-surface border-line"
              }`}
            >
              <View>
                <Text
                  className={`text-xs font-bold ${
                    deliveryZone === "INSIDE" ? "text-brand" : "text-ink"
                  }`}
                >
                  Inside Dhaka
                </Text>
                <Text className="text-[11px] text-ink-muted mt-0.5">৳80 delivery</Text>
              </View>
              {deliveryZone === "INSIDE" && <CheckCircle size={16} color="#5B4FE8" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setDeliveryZone("OUTSIDE")}
              className={`flex-1 p-3 rounded-xl border flex-row items-center justify-between ${
                deliveryZone === "OUTSIDE"
                  ? "bg-brand/10 border-brand"
                  : "bg-surface border-line"
              }`}
            >
              <View>
                <Text
                  className={`text-xs font-bold ${
                    deliveryZone === "OUTSIDE" ? "text-brand" : "text-ink"
                  }`}
                >
                  Outside Dhaka
                </Text>
                <Text className="text-[11px] text-ink-muted mt-0.5">৳150 delivery</Text>
              </View>
              {deliveryZone === "OUTSIDE" && <CheckCircle size={16} color="#5B4FE8" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Product & Order Value */}
        <View className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <Text className="text-xs font-bold uppercase text-ink-muted tracking-wider">
            Order Items & Value
          </Text>

          <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
            <ShoppingBag size={15} color="#6B6B8D" />
            <TextInput
              value={itemNote}
              onChangeText={setItemNote}
              placeholder="Item name / SKU / Size (e.g. Silk Saree L)"
              className="flex-1 text-xs text-ink ml-2"
              placeholderTextColor="#9E9EB8"
            />
          </View>

          <View className="flex-row items-center bg-canvas rounded-xl px-3 py-2 border border-line">
            <Text className="text-xs font-bold text-ink mr-2">৳</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Product Subtotal (e.g. 1200)"
              keyboardType="numeric"
              className="flex-1 text-xs text-ink"
              placeholderTextColor="#9E9EB8"
            />
          </View>

          <View className="pt-2 border-t border-line/60 flex-row items-center justify-between">
            <Text className="text-xs text-ink-muted">Total Payable (COD):</Text>
            <Text className="text-base font-extrabold text-brand">
              ৳ {total.toLocaleString("en-BD")}
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-brand py-4 rounded-2xl flex-row items-center justify-center shadow-lg shadow-brand/20 mt-2"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Truck size={18} color="#FFFFFF" />
              <Text className="text-surface font-bold text-sm ml-2">
                Create & Dispatch Parcel
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
