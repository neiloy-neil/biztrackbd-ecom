import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, TouchableWithoutFeedback } from "react-native";
import { useAuth, BusinessStore } from "../../hooks/useAuth";
import { Store, Check, X, ShieldAlert } from "lucide-react-native";

interface StoreSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function StoreSwitcherModal({ visible, onClose }: StoreSwitcherModalProps) {
  const { stores, activeStore, switchStore } = useAuth();

  const handleSelect = async (tenantId: string) => {
    await switchStore(tenantId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback>
            <View className="bg-surface rounded-t-3xl p-6 max-h-[75%] border-t border-line">
              <View className="flex-row items-center justify-between mb-5">
                <View>
                  <Text className="text-lg font-bold text-ink">Switch Store</Text>
                  <Text className="text-xs text-ink-muted">Select a shop to manage</Text>
                </View>
                <TouchableOpacity onPress={onClose} className="p-1 rounded-full bg-canvas">
                  <X size={20} color="#6B6B8D" />
                </TouchableOpacity>
              </View>

              <ScrollView className="space-y-3">
                {stores.map((s: BusinessStore) => {
                  const isSelected = s.tenantId === activeStore?.tenantId;
                  return (
                    <TouchableOpacity
                      key={s.tenantId}
                      onPress={() => handleSelect(s.tenantId)}
                      className={`flex-row items-center justify-between p-4 rounded-2xl border ${
                        isSelected
                          ? "bg-brand/5 border-brand"
                          : "bg-surface border-line"
                      }`}
                    >
                      <View className="flex-row items-center space-x-3 flex-1">
                        <View
                          className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                            isSelected ? "bg-brand text-surface" : "bg-canvas"
                          }`}
                        >
                          <Store size={20} color={isSelected ? "#FFFFFF" : "#6B6B8D"} />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-sm text-ink">{s.storeName}</Text>
                          <Text className="text-xs text-ink-muted">{s.subdomain}.biztrack.bd</Text>
                          <View className="flex-row items-center mt-1 space-x-2">
                            <Text className="text-[10px] uppercase font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                              {s.role}
                            </Text>
                            {s.tenantStatus !== "ACTIVE" && s.tenantStatus !== "TRIAL" && (
                              <View className="flex-row items-center bg-danger/10 px-1.5 py-0.5 rounded ml-1">
                                <ShieldAlert size={10} color="#DC2626" />
                                <Text className="text-[10px] font-bold text-danger ml-1">
                                  {s.tenantStatus}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {isSelected && (
                        <View className="w-6 h-6 rounded-full bg-brand items-center justify-center">
                          <Check size={14} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
