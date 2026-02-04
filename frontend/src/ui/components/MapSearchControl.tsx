import React, { useState } from "react";
import { useMap } from "react-leaflet";

export default function MapSearchControl() {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const search = async () => {
    if (!query) return;
    setIsSearching(true);

    const coordMatch = query.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      map.flyTo([lat, lng], 15);
      setIsSearching(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        map.flyTo([parseFloat(lat), parseFloat(lon)], 15);
      } else {
        alert("Lugar no encontrado.");
      }
    } catch (e) {
      console.error("Search error", e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: "auto", zIndex: 1000 }}>
      <div className="leaflet-control m-2 flex shadow-xl rounded-lg overflow-hidden border border-sunass-blue/20">
        <input
          className="p-3 w-64 text-sm outline-none text-gray-700 bg-white"
          placeholder="Buscar ciudad o coords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={search}
          className="bg-sunass-blue text-white px-4 hover:bg-sunass-dark transition-colors flex items-center justify-center"
          disabled={isSearching}
        >
          {isSearching ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
        </button>
      </div>
    </div>
  );
}
