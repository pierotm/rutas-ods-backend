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

export const createOdsIcon = () => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="
          background-color: #EF4444;
          color: white;
          border-radius: 9999px;
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          border: 3px solid white;
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5);
          font-size: 1rem;
          z-index: 10;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          background: rgba(239, 68, 68, 0.95);
          color: white;
          font-size: 9px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          margin-top: 3px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        ">ODS — Origen</div>
      </div>
    `,
    className: "custom-div-icon",
    iconSize: [60, 60],
    iconAnchor: [20, 40],
    popupAnchor: [0, -44],
  });
};
