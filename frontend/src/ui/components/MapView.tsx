import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Location } from "../../domain/types";
import MapSearchControl from "./MapSearchControl";

function createCustomIcon(index: number, color: string, isActive: boolean) {
  const bgColor = isActive ? color : "#94a3b8";
  const opacity = isActive ? "1" : "0.5";

  return L.divIcon({
    html: `<div style="background-color:${bgColor};opacity:${opacity};color:white;border-radius:9999px;width:1.75rem;height:1.75rem;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);font-size:.7rem;">${index}</div>`,
    className: "custom-div-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  locations,
  onAddPoint,
}: {
  locations: Location[];
  onAddPoint: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer center={[-12.0464, -77.0428]} zoom={12} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler onClick={onAddPoint} />
      <MapSearchControl />

      {locations.map((loc, i) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={createCustomIcon(i + 1, "#005596", loc.isActive)}
        >
          <Popup>
            <div>
              <b>{loc.name}</b>
              <div>{loc.coords}</div>
              <div>Cat: {loc.category}</div>
              <div>OC extra: {loc.ocCount}</div>
              <div>Ubigeo: {loc.ubigeo}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
