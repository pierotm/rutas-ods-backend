import { useState } from "react";
import type { Location } from "../../domain/types";

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [targetPoints] = useState(120);

  const addPoint = (lat: number, lng: number) => {
    if (locations.length >= targetPoints) {
      alert(`Ya has seleccionado el máximo de ${targetPoints} puntos.`);
      return;
    }

    const newId = locations.length + 1;
    const loc: Location = {
      id: newId,
      name: `Punto ${newId}`,
      coords: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng,
      ocCount: 0,
      category: "PC",
      ubigeo: `MANUAL-${newId}`,
      isActive: true,
    };

    setLocations((prev) => [...prev, loc]);
  };

  const resetPoints = () => setLocations([]);

  const toggleActive = (id: number) =>
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, isActive: !l.isActive } : l)));

  return { locations, addPoint, resetPoints, toggleActive };
}
