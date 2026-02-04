export const parseCoords = (input: string): { lat: number; lng: number } | null => {
  if (!input) return null;
  const parts = input.split(",").map((p) => parseFloat(p.replace(/[^\d.,-]/g, "")));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
};
