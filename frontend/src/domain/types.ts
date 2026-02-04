export type Category = "PC" | "OC";

export interface Location {
  id: number;
  name: string;
  coords: string;
  lat: number;
  lng: number;
  ocCount: number;
  category: Category;
  ubigeo: string;
  relatedUbigeo?: string;
  isActive: boolean;
}

export interface DayLog {
  day: number;
  start_location: string;
  activity_points: string[];
  activity_oc_counts: Record<string, number>;
  travel_minutes: number;
  work_minutes: number;
  overtime_minutes: number;
  total_day_minutes: number;
  final_location: string;
  is_return: boolean;
  note?: string;
}

export interface ItineraryResult {
  num_days: number;
  num_nights: number;
  logs: DayLog[];
}

export interface CostBreakdown {
  gas: number;
  food: number;
  hotel: number;
  oc: number;
}

export interface RouteSegment {
  id: number;
  name: string;
  points: Location[];
  logs: DayLog[];
  totalCost: number;
  breakdown: CostBreakdown;
  distance: number;
  nights: number;
  days: number;
  color: string;
}

export interface MasterPlanResult {
  totalSystemCost: number;
  routes: RouteSegment[];
  totalDistance: number;
  totalNights: number;
  totalDays: number;
  pointsCovered: number;
}

export interface MatrixCell {
  value: number;
  loading: boolean;
  error?: boolean;
}
export type Matrix = MatrixCell[][];