

export interface Cost {
  amount: number;
  currency: string;
}

export interface Destination {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface TravelDetails {
  type: string; // Car, Plane, Train, etc.
  company?: string;
  details?: string; // Reservation number, times
  cost: Cost;
}

export interface Stop {
  id: string;
  seq: number;
  place: string;
  lat: number;
  lng: number;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  notes?: string;
  accommodation?: string;
  boardType?: 'None' | 'Breakfast' | 'Half' | 'Full';
  hotelCost: Cost;
  dailyBudget?: Cost;
  travelToThisStop?: TravelDetails;
}

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  fromIata?: string;
  toIata?: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  departure: string; // ISO String
  arrival?: string;
  cost: Cost;
  notes?: string;
  logo?: string; // URL to airline logo
}

export interface Activity {
  id: string;
  name: string;
  time?: string;
  timeBlock: 'morning' | 'afternoon' | 'evening' | 'unplanned';
  cost: Cost;
  category?: 'sightseeing' | 'food' | 'adventure' | 'relax' | 'culture' | 'shopping' | 'transport';
  status: 'idea' | 'booked' | 'paid';
  lat?: number;
  lng?: number;
  notes?: string;
  address?: string;
  url?: string;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  stopId: string;
  status: 'default' | 'complete' | 'rest';
  activities: Activity[];
}

export interface PackingItem {
  id: string;
  text: string;
  category: string;
  packed: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  isPaid: boolean;
  sourcePlannedId?: string; // If linked to a planned item
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
}

export interface AgencyProfile {
  name: string;
  logoUrl: string;
  email: string;
  phone: string;
  website: string;
  primaryColor: string;
}

export interface AgencyTask {
  id: string;
  text: string;
  completed: boolean;
}

export type TripStatus = 'inquiry' | 'drafting' | 'proposal' | 'booked' | 'completed';

export interface AppState {
  // Trip Specific Data
  id: string; // Unique Trip ID
  clientName: string;
  tripName: string; 
  lastModified: number;
  status: TripStatus; // Added for Kanban
  
  // CRM Specific Data (Private to Agent)
  agencyNotes?: string;
  agencyTasks?: AgencyTask[];

  step: number;
  destinations: Destination[];
  stops: Stop[];
  flights: Flight[];
  dayPlans: Record<string, DayPlan>; // Keyed by YYYY-MM-DD
  packingList: PackingItem[];
  expenses: Expense[];
  links: LinkItem[];
  homeCurrency: string;
  totalBudget: number;
  travelers: number;
  paidItemIds: string[]; // IDs of planned items (flights/stops) marked as paid
}

export const CURRENCIES: Record<string, string> = {
  EUR: 'Euro',
  USD: 'US Dollar',
  GBP: 'British Pound',
  ZAR: 'South African Rand',
  LKR: 'Sri Lankan Rupee',
  JPY: 'Japanese Yen',
  AUD: 'Australian Dollar',
};

export const DEFAULT_AGENCY: AgencyProfile = {
  name: "TravelFlow Agency",
  logoUrl: "",
  email: "contact@travelflow.com",
  phone: "+1 (555) 0123-456",
  website: "www.travelflow.com",
  primaryColor: "#4f46e5"
};