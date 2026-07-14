import { useEffect, useState } from "react";
import { FlatList, Linking, Pressable, Text, View } from "react-native";
import { useAction, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { Button, Card, EmptyState, Field, Screen } from "@/components/ui";

type FrResult = {
  title: string;
  publicationDate: string;
  documentNumber: string;
  htmlUrl: string;
  rawTextUrl: string;
  abstract: string | null;
};

export default function ImportAds() {
  const { current } = useAircraft();
  const search = useAction(api.adSearch.search);
  const importAd = useAction(api.adSearch.importFromFederalRegister);
  const existing = useQuery(
    api.ads.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );

  const [query, setQuery] = useState(
    current ? `${current.make} ${current.model}` : "",
  );
  const [results, setResults] = useState<FrResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Record<string, string>>({});

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await search({ query: q.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  // Search on open with the aircraft's make/model
  useEffect(() => {
    if (current && results === null && !searching) void runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  async function runImport(item: FrResult) {
    if (!current) return;
    setImporting(item.documentNumber);
    try {
      const { adNumber } = await importAd({
        aircraftId: current._id,
        title: item.title,
        publicationDate: item.publicationDate,
        documentNumber: item.documentNumber,
        htmlUrl: item.htmlUrl,
        rawTextUrl: item.rawTextUrl,
      });
      setImported((prev) => ({ ...prev, [item.documentNumber]: adNumber }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(null);
    }
  }

  const existingNumbers = new Set((existing ?? []).map((ad) => ad.adNumber));

  return (
    <Screen scroll={false}>
      <View className="gap-3 pb-3">
        <Text className="text-xs leading-4 text-flight-400">
          Searches FAA final rules in the Federal Register. Imported ADs arrive as{" "}
          <Text className="text-flight-200">open</Text> — confirm applicability by serial number,
          then record compliance or mark N/A.
        </Text>
        <Field
          label="Search (make, model, engine…)"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          onSubmitEditing={() => void runSearch(query)}
          returnKeyType="search"
        />
        <Button label="Search" onPress={() => void runSearch(query)} loading={searching} />
        {error && <Text className="text-sm text-warning">{error}</Text>}
      </View>

      <FlatList
        data={results ?? []}
        keyExtractor={(item) => item.documentNumber}
        contentContainerClassName="gap-3 pb-28"
        ListEmptyComponent={
          results !== null && !searching ? (
            <EmptyState title="No ADs found" hint="Try different terms — e.g. engine model (IO-360) or the airframe manufacturer." />
          ) : null
        }
        renderItem={({ item }) => {
          const done = imported[item.documentNumber];
          const already = done !== undefined && existingNumbers.has(done);
          return (
            <Card>
              <Text className="font-semibold text-white">{item.title}</Text>
              <Text className="mt-1 text-xs text-flight-400">
                Published {item.publicationDate} · {item.documentNumber}
              </Text>
              {item.abstract && (
                <Text className="mt-2 text-xs leading-4 text-flight-300" numberOfLines={4}>
                  {item.abstract}
                </Text>
              )}
              <View className="mt-3 flex-row items-center gap-4">
                {done ? (
                  <Text className="text-sm font-semibold text-ok">
                    ✓ Imported as AD {done}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => void runImport(item)}
                    disabled={importing !== null}
                    className="active:opacity-60">
                    <Text className="text-sm font-semibold text-instrument">
                      {importing === item.documentNumber ? "Importing…" : "Import"}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={() => void Linking.openURL(item.htmlUrl)} className="active:opacity-60">
                  <Text className="text-sm text-flight-300">Read full text</Text>
                </Pressable>
                {already && <Text className="text-xs text-flight-400">(already tracked)</Text>}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
