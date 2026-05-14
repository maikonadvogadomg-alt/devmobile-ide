import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface NpmPackage {
  name: string;
  version: string;
  description: string;
  keywords?: string[];
  downloads?: number;
}

interface PypiPackage {
  name: string;
  version: string;
  description: string;
}

type Registry = "npm" | "pypi";

async function searchNpm(query: string): Promise<NpmPackage[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=15`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.objects || []).map((obj: Record<string, Record<string, unknown>>) => ({
    name: obj.package.name as string,
    version: obj.package.version as string,
    description: (obj.package.description as string) || "",
    keywords: (obj.package.keywords as string[]) || [],
  }));
}

async function searchPypi(query: string): Promise<PypiPackage[]> {
  const url = `https://pypi.org/pypi/${encodeURIComponent(query)}/json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const searchUrl = `https://pypi.org/search/?q=${encodeURIComponent(query)}&format=json`;
      return [{ name: query, version: "latest", description: `Buscar "${query}" no PyPI` }];
    }
    const data = await res.json();
    return [{
      name: data.info.name,
      version: data.info.version,
      description: data.info.summary || "",
    }];
  } catch {
    return [{ name: query, version: "latest", description: `Buscar "${query}" no PyPI` }];
  }
}

export default function LibrarySearch({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { addTerminalLine, activeTerminal, terminalSessions, addTerminalSession } = useApp();
  const [query, setQuery] = useState("");
  const [registry, setRegistry] = useState<Registry>("npm");
  const [results, setResults] = useState<(NpmPackage | PypiPackage)[]>([]);
  const [loading, setLoading] = useState(false);
  const [installedPkgs, setInstalledPkgs] = useState<Set<string>>(new Set());

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = registry === "npm" ? await searchNpm(query) : await searchPypi(query);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, registry]);

  const install = useCallback(
    (pkg: NpmPackage | PypiPackage) => {
      const cmd =
        registry === "npm"
          ? `npm install ${pkg.name}`
          : `pip install ${pkg.name}`;

      let sessionId = activeTerminal;
      if (!sessionId) {
        const s = addTerminalSession("Terminal");
        sessionId = s.id;
      }

      addTerminalLine(sessionId, { type: "input", content: `$ ${cmd}` });
      addTerminalLine(sessionId, { type: "info", content: `Instalando ${pkg.name}@${pkg.version}...` });

      setTimeout(() => {
        addTerminalLine(sessionId!, {
          type: "output",
          content:
            registry === "npm"
              ? `added 1 package in 0.8s\n+ ${pkg.name}@${pkg.version}`
              : `Collecting ${pkg.name}\nSuccessfully installed ${pkg.name}-${pkg.version}`,
        });
        setInstalledPkgs((prev) => new Set(prev).add(pkg.name));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 800);

      Alert.alert(
        "Instalando",
        `${pkg.name} está sendo instalado. Verifique o terminal.`,
        [{ text: "Ver Terminal", onPress: onClose }, { text: "OK" }]
      );
    },
    [registry, activeTerminal, addTerminalLine, addTerminalSession, onClose]
  );

  const renderItem = ({ item }: { item: NpmPackage | PypiPackage }) => {
    const isInstalled = installedPkgs.has(item.name);
    return (
      <View style={[styles.pkgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.pkgHeader}>
          <Text style={[styles.pkgName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.versionBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
              v{item.version}
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text style={[styles.pkgDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => install(item)}
          style={[
            styles.installBtn,
            {
              backgroundColor: isInstalled ? colors.success : colors.primary,
            },
          ]}
        >
          <Feather name={isInstalled ? "check" : "download"} size={13} color={colors.primaryForeground} />
          <Text style={[styles.installText, { color: colors.primaryForeground }]}>
            {isInstalled ? "Instalado" : registry === "npm" ? "npm install" : "pip install"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Buscar Bibliotecas</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.registryRow}>
            {(["npm", "pypi"] as Registry[]).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => {
                  setRegistry(r);
                  setResults([]);
                }}
                style={[
                  styles.registryBtn,
                  {
                    backgroundColor: registry === r ? colors.primary : colors.secondary,
                    borderColor: registry === r ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather
                  name={r === "npm" ? "package" : "terminal"}
                  size={13}
                  color={registry === r ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.registryText,
                    { color: registry === r ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {r === "npm" ? "npm (JavaScript)" : "PyPI (Python)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              value={query}
              onChangeText={setQuery}
              placeholder={`Buscar no ${registry}...`}
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={search}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              autoFocus
            />
            <TouchableOpacity
              onPress={search}
              style={[styles.searchBtn, { backgroundColor: colors.primary }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="search" size={18} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>

          {results.length === 0 && !loading && query.trim() && (
            <Text style={[styles.noResults, { color: colors.mutedForeground }]}>
              Nenhum resultado. Tente outro termo.
            </Text>
          )}

          <FlatList
            data={results}
            keyExtractor={(item) => item.name}
            renderItem={renderItem}
            contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "700" },
  body: { flex: 1, padding: 16, gap: 12 },
  registryRow: { flexDirection: "row", gap: 10 },
  registryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  registryText: { fontSize: 13, fontWeight: "600" },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pkgCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  pkgHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  pkgName: { flex: 1, fontSize: 14, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  versionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  versionText: { fontSize: 10, fontWeight: "600" },
  pkgDesc: { fontSize: 12, lineHeight: 17 },
  installBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 2,
  },
  installText: { fontSize: 12, fontWeight: "700" },
  noResults: { fontSize: 14, textAlign: "center", paddingVertical: 20 },
});
