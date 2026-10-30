import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export type Role = "owner" | "mechanic" | "viewer";
export type FleetAircraft = Doc<"aircraft"> & { role: Role };

type AircraftContextValue = {
  fleet: FleetAircraft[] | undefined;
  current: FleetAircraft | null;
  isOwner: boolean;
  canWrite: boolean;
  setAircraftId: (id: Id<"aircraft">) => void;
  isLoading: boolean;
};

const AircraftContext = createContext<AircraftContextValue>({
  fleet: undefined,
  current: null,
  isOwner: false,
  canWrite: false,
  setAircraftId: () => {},
  isLoading: true,
});

export function AircraftProvider({ children }: { children: ReactNode }) {
  const fleet = useQuery(api.aircraft.list);
  const [selectedId, setSelectedId] = useState<Id<"aircraft"> | null>(null);

  const current =
    fleet?.find((a) => a._id === selectedId) ?? fleet?.[0] ?? null;

  return (
    <AircraftContext.Provider
      value={{
        fleet,
        current,
        isOwner: current?.role === "owner",
        canWrite: current?.role === "owner" || current?.role === "mechanic",
        setAircraftId: setSelectedId,
        isLoading: fleet === undefined,
      }}>
      {children}
    </AircraftContext.Provider>
  );
}

export function useAircraft() {
  return useContext(AircraftContext);
}
