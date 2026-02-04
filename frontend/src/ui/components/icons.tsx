import L from "leaflet";

export const createCustomIcon = (index: number, color: string = "#005596", isActive: boolean = true) => {
  const bgColor = isActive ? color : "#94a3b8";
  const opacity = isActive ? "1" : "0.5";

  return L.divIcon({
    html: `<div style="background-color: ${bgColor}; opacity: ${opacity}; color: white; border-radius: 9999px; width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); font-size: 0.7rem;">${index}</div>`,
    className: "custom-div-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};
