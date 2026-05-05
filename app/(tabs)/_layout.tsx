import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  const TAB_HEIGHT = isWeb ? 62 : 60;
  const bottomSafe = isWeb ? 0 : Math.max(insets.bottom, 16);
  const tabBarHeight = TAB_HEIGHT + bottomSafe;

  const TabIcon = ({
    name,
    label,
    color,
    focused,
  }: {
    name: React.ComponentProps<typeof Feather>["name"];
    label: string;
    color: string;
    focused: boolean;
  }) => (
    <View style={[styles.tabItem, focused && { backgroundColor: color + "18" }]}>
      <Feather name={name} size={18} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground + "99",
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card + "f5",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: bottomSafe,
          paddingTop: 4,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? "dark" : "dark"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card + "f5" }]} />
          ),
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Projetos",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="folder" label="Projetos" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: "Editor",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="code" label="Editor" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="terminal"
        options={{
          title: "Terminal",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="terminal" label="Terminal" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="plugins"
        options={{
          title: "Plugins",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="package" label="Plugins" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "IA",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="cpu" label="IA" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="pwa"
        options={{
          title: "PWA→APK",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="smartphone" label="PWA" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: "Árvore",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="git-branch" label="Árvore" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Config",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings" label="Config" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
    minWidth: 44,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
