export async function geocode(query: string, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { signal });

  if (!res.ok) throw new Error("No se pudo buscar el lugar");
  const data = await res.json();

  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}
