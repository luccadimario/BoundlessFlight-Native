import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { DueStatus } from "@/lib/currency";

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-28 pt-2 gap-3"
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-4 pt-2">{children}</View>
  );
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-flight-950">
      {body}
    </SafeAreaView>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-2xl bg-flight-900 p-4 ${className ?? ""}`}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text className="text-[34px] font-bold tracking-tight text-white">{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-flight-300">
      {children}
    </Text>
  );
}

export function Button({
  label,
  icon,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
}) {
  const base = "flex-row items-center justify-center gap-1.5 rounded-xl px-4 py-3.5 active:opacity-70";
  const styles = {
    primary: "bg-instrument",
    secondary: "bg-flight-800",
    danger: "bg-warning/15",
    ghost: "",
  }[variant];
  const textStyles = {
    primary: "text-white font-semibold",
    secondary: "text-white font-semibold",
    danger: "text-warning font-semibold",
    ghost: "text-instrument font-semibold",
  }[variant];
  const iconColor = {
    primary: "#ffffff",
    secondary: "#ffffff",
    danger: "#ff453a",
    ghost: "#0a84ff",
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${base} ${styles} ${disabled || loading ? "opacity-40" : ""}`}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === "secondary" || variant === "primary" ? "#ffffff" : iconColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={iconColor} />}
          <Text className={textStyles}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-flight-300">
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#8e8e93"
        className="rounded-lg bg-flight-800 px-3 py-3 text-base text-white"
        {...props}
      />
    </View>
  );
}

// Horizontal chip selector for enum fields
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          className={`rounded-lg px-3 py-1.5 ${value === opt ? "bg-instrument/15" : "bg-flight-800"}`}>
          <Text
            className={`text-sm capitalize ${
              value === opt ? "font-semibold text-instrument" : "text-flight-300"
            }`}>
            {labels?.[opt] ?? opt.replaceAll("_", " ")}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const STATUS_STYLES: Record<DueStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-ok", text: "text-ok", label: "OK" },
  due_soon: { dot: "bg-caution", text: "text-caution", label: "Due soon" },
  overdue: { dot: "bg-warning", text: "text-warning", label: "Overdue" },
  no_record: { dot: "bg-flight-400", text: "text-flight-300", label: "No record" },
  untracked: { dot: "bg-flight-700", text: "text-flight-400", label: "Off" },
};

export function StatusBadge({ status, detail }: { status: DueStatus; detail?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`h-2 w-2 rounded-full ${s.dot}`} />
      <Text className={`text-xs font-semibold ${s.text}`}>{detail ?? s.label}</Text>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="items-center py-8">
      <Text className="text-base font-semibold text-flight-200">{title}</Text>
      {hint ? <Text className="mt-1 text-center text-sm text-flight-400">{hint}</Text> : null}
    </Card>
  );
}

export function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
      <ActivityIndicator size="large" color="#0a84ff" />
    </View>
  );
}
