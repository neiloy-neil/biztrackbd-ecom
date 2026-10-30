import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { Store, ShieldCheck, ArrowRight, Sparkles } from "lucide-react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (targetEmail: string, targetPassword = "") => {
    setError(null);
    try {
      await login(targetEmail, targetPassword);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message || "Sign-in failed. Please check credentials.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-surface"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-brand/10 items-center justify-center mb-4">
            <Store size={34} color="#5B4FE8" />
          </View>
          <Text className="text-2xl font-bold text-ink">BizTrackBD</Text>
          <Text className="text-sm text-ink-muted mt-1">Store Manager Command Center</Text>
        </View>

        {error && (
          <View className="bg-danger/10 border border-danger/20 rounded-xl p-3.5 mb-5">
            <Text className="text-xs text-danger font-medium text-center">{error}</Text>
          </View>
        )}

        <View className="space-y-4">
          <View>
            <Text className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Email Address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="owner@yourstore.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="w-full bg-canvas/60 border border-line rounded-xl px-4 py-3.5 text-ink text-sm"
              placeholderTextColor="#9E9EB8"
            />
          </View>

          <View className="mt-3">
            <Text className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              secureTextEntry
              autoCapitalize="none"
              className="w-full bg-canvas/60 border border-line rounded-xl px-4 py-3.5 text-ink text-sm"
              placeholderTextColor="#9E9EB8"
            />
          </View>

          <TouchableOpacity
            onPress={() => handleLogin(email, password)}
            disabled={isLoading || !email}
            className={`w-full py-3.5 rounded-xl flex-row items-center justify-center mt-6 ${
              isLoading || !email ? "bg-brand/50" : "bg-brand"
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text className="text-surface font-semibold text-sm mr-2">Sign In to Store</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View className="relative my-6 items-center justify-center">
            <View className="absolute w-full h-[1px] bg-line" />
            <Text className="bg-surface px-3 text-xs text-ink-soft uppercase tracking-wider font-medium">
              Or Local Pilot Demo
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => handleLogin("owner@example.com", "dev-pass")}
            disabled={isLoading}
            className="w-full bg-brand/5 border border-brand/20 py-3 rounded-xl flex-row items-center justify-center"
          >
            <Sparkles size={16} color="#5B4FE8" />
            <Text className="text-brand font-semibold text-sm ml-2">
              Quick Fill Demo Store (Rongdhonu)
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-center mt-12 space-x-1">
          <ShieldCheck size={14} color="#6B6B8D" />
          <Text className="text-xs text-ink-muted ml-1">
            Protected by Supabase Auth & Tenant RLS
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
