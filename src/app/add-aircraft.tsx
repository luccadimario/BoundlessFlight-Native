import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { Button, Field, Screen, SectionTitle } from "@/components/ui";

export default function AddAircraft() {
  const createAircraft = useMutation(api.aircraft.create);
  const { setAircraftId } = useAircraft();

  const [tailNumber, setTailNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [serial, setSerial] = useState("");
  const [engineMake, setEngineMake] = useState("");
  const [engineModel, setEngineModel] = useState("");
  const [propModel, setPropModel] = useState("");
  const [tach, setTach] = useState("");
  const [hobbs, setHobbs] = useState("");
  const [airframeTT, setAirframeTT] = useState("");
  const [smoh, setSmoh] = useState("");
  const [tbo, setTbo] = useState("");
  const [saving, setSaving] = useState(false);

  const num = (s: string) => (s.trim() === "" ? undefined : parseFloat(s));

  async function save() {
    if (!tailNumber.trim() || !make.trim() || !model.trim()) {
      Alert.alert("Missing info", "Tail number, make, and model are required.");
      return;
    }
    if (tach.trim() === "" || Number.isNaN(parseFloat(tach))) {
      Alert.alert("Missing tach", "Enter the current tach time (used to compute hour-based due items).");
      return;
    }
    setSaving(true);
    try {
      const id = await createAircraft({
        tailNumber: tailNumber.trim().toUpperCase(),
        make: make.trim(),
        model: model.trim(),
        serial: serial.trim() || undefined,
        year: num(year),
        engineMake: engineMake.trim() || undefined,
        engineModel: engineModel.trim() || undefined,
        propModel: propModel.trim() || undefined,
        currentTach: parseFloat(tach),
        currentHobbs: num(hobbs),
        airframeTotalTime: num(airframeTT),
        engineTimeSinceOverhaul: num(smoh),
        engineTBO: num(tbo),
      });
      setAircraftId(id);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <SectionTitle>Aircraft</SectionTitle>
      <Field label="Tail number *" value={tailNumber} onChangeText={setTailNumber} placeholder="N12345" autoCapitalize="characters" />
      <Field label="Make *" value={make} onChangeText={setMake} placeholder="Cessna" />
      <Field label="Model *" value={model} onChangeText={setModel} placeholder="172S" />
      <Field label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" placeholder="2004" />
      <Field label="Serial number" value={serial} onChangeText={setSerial} placeholder="172S9587" />

      <SectionTitle>Powerplant</SectionTitle>
      <Field label="Engine make" value={engineMake} onChangeText={setEngineMake} placeholder="Lycoming" />
      <Field label="Engine model" value={engineModel} onChangeText={setEngineModel} placeholder="IO-360-L2A" />
      <Field label="Propeller" value={propModel} onChangeText={setPropModel} placeholder="McCauley 1A170E" />

      <SectionTitle>Times</SectionTitle>
      <Field label="Current tach *" value={tach} onChangeText={setTach} keyboardType="decimal-pad" placeholder="2410.6" />
      <Field label="Current Hobbs" value={hobbs} onChangeText={setHobbs} keyboardType="decimal-pad" />
      <Field label="Airframe total time" value={airframeTT} onChangeText={setAirframeTT} keyboardType="decimal-pad" />
      <Field label="Engine time since overhaul (SMOH)" value={smoh} onChangeText={setSmoh} keyboardType="decimal-pad" />
      <Field label="Engine TBO" value={tbo} onChangeText={setTbo} keyboardType="decimal-pad" placeholder="2000" />

      <Button label="Add Aircraft" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}
