export type PortalRole = 'customer' | 'vendor' | 'rider' | 'admin' | 'subadmin';

export interface SystemSettings {
  id: string;
  per_km_delivery_charge: number; // e.g. 15 BDT per KM
  base_delivery_charge: number;   // e.g. 30 BDT base
  rider_match_radius_km: number;  // e.g. 1.0 KM radius
  currency: string;
  currency_symbol: string;
  is_active: boolean;
  updated_at: string;
  banner_slide_interval_seconds?: number; // e.g. 3
  banner_slide_auto_play?: boolean;       // e.g. true
}

export const DEFAULT_DELIVERY_ZONE_NAMES = [
  'Chawkbazar Zone',
  'GEC Zone',
  'Agrabad Zone',
  'Nasirabad Zone',
  'Halishahar Zone',
  'Khulshi Zone',
  'Banani & Gulshan Zone',
  'Dhanmondi Zone',
  'Uttara Zone',
  'Mirpur Zone'
] as const;

export interface DeliveryZone {
  id: string;
  name: string;
  bn_name?: string;
  description?: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  boundary_coordinates?: [number, number][]; // Polygon coordinates [[lat, lng], ...]
  color?: string; // Color badge & map overlay e.g. '#E11D48'
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DELIVERY_ZONES = DEFAULT_DELIVERY_ZONE_NAMES;
export type DeliveryZoneName = string;

export interface Vendor {
  id: string;
  unique_id?: string; // e.g. VND-1001
  name: string;
  description?: string;
  logo_url?: string;
  cover_image?: string;
  cuisine: string;
  phone: string;
  email?: string;
  address: string;
  zone: string;
  latitude: number;
  longitude: number;
  google_maps_link?: string;
  is_active: boolean;
  is_paused?: boolean; // Admin can pause/resume vendor
  is_boosted?: boolean; // Admin boost vendor to top banner carousel
  boost_banner_title?: string;
  boost_banner_subtitle?: string;
  rating: number;
  estimated_prep_time_minutes: number;
  featured_position?: number; // 1 to 5 for ranking in top serial
  is_password_set?: boolean;
  password?: string;
  vendor_type?: 'restaurant' | 'shop'; // Categorize vendor as restaurant or grocery shop
  restaurant_type?: 'restaurant' | 'cloud_kitchen' | 'home_kitchen'; // Sub-type for restaurant (Restaurant, Cloud Kitchen, Home Kitchen)
  opening_schedule?: WeeklySchedule; // 1-week opening/closing schedule
  is_permanently_closed?: boolean; // Manual permanent close toggle (until vendor manually reopens)
  created_at?: string;
}

export interface DaySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  day_label: string;
  day_label_bn: string;
  is_open: boolean;
  open_time: string; // "09:00" in 24hr format
  close_time: string; // "23:00" in 24hr format
}

export type WeeklySchedule = Record<DaySchedule['day'], DaySchedule>;

export interface FoodCategory {
  id: string;
  name: string;
  icon?: string; // emoji e.g. 🍕, 🍔 or icon name
  image_url?: string;
  is_active: boolean;
  order_index?: number;
  category_type?: 'food' | 'grocery'; // Categorize food or grocery category
}

export interface AdBanner {
  id: string;
  title: string;
  subtitle?: string;
  action_text?: string;
  image_url: string;
  video_url?: string; // YouTube or direct video URL for autoplay video banner
  target_vendor_id?: string;
  target_category?: string;
  is_active: boolean;
  order_index?: number;
  portal_type?: 'food' | 'grocery'; // Which portal page to show the banner on
  banner_position?: 'top' | 'middle';
  created_at?: string;
}

export interface MenuVariationOption {
  id: string;
  name: string; // e.g., "Full", "Half", "1:1", "1:2", "Large", "Medium", "Mild", "Spicy"
  price: number; // additional price offset or option price
}

export interface MenuVariationGroup {
  id: string;
  name: string; // e.g., "Portion / Size", "Spice Level", "Choice of Add-ons"
  type: 'single' | 'multiple'; // single choice (radio) or multiple choice (checkbox)
  required: boolean;
  min_selection?: number;
  max_selection?: number;
  options: MenuVariationOption[];
}

export interface MenuItem {
  id: string;
  vendor_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  is_available: boolean;
  variations?: MenuVariationGroup[];
}

export interface CustomerAddress {
  id: string;
  customer_id?: string;
  customer_phone: string;
  customer_name: string;
  label: 'Home' | 'Office' | 'Other' | string;
  address_line: string;
  details?: string;
  latitude: number;
  longitude: number;
  zone?: string;
  is_default: boolean;
  status: 'active' | 'inactive';
}

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  password?: string;
  email?: string;
  avatar_url?: string;
  addresses: CustomerAddress[];
  created_at: string;
}

export interface Rider {
  id: string; // Unique Rider ID
  name: string;
  phone: string;
  photo_url?: string;
  home_address?: string;
  zone: string;
  vehicle_type: 'Motorcycle' | 'Bicycle' | 'Scooter';
  is_online: boolean;
  is_paused?: boolean; // Admin can pause/resume rider
  current_latitude: number;
  current_longitude: number;
  last_location_updated_at?: string;
  cash_in_hand: number; // Floating cash held by rider
  is_approved: boolean;
  is_password_set?: boolean;
  password?: string;
  created_at?: string;
}

export interface UserAccount {
  id: string;
  role: PortalRole;
  name: string;
  phone: string;
  is_password_set: boolean;
  reference_id?: string; // vendor_id or rider_id or customer_id
  zone?: string;
  photo_url?: string;
}

export type OrderStatus = 
  | 'pending'                  // Customer placed order
  | 'vendor_accepted'          // Restaurant accepted order, waiting for customer prep time confirmation
  | 'food_preparing'           // Customer approved prep time, kitchen cooking
  | 'ready_for_pickup'         // Food cooked & packaged, searching for nearby zone riders
  | 'rider_assigned'           // Rider accepted dispatch
  | 'rider_arrived_at_vendor'  // Rider arrived at restaurant
  | 'food_picked_up'           // Rider paid cash to restaurant & picked up food
  | 'rider_on_way_to_customer' // Rider traveling to customer location
  | 'delivered'                // Food handed over, cash collected from customer
  | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id?: string;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
  selected_variations?: string[];
  special_instructions?: string;
}

export interface Order {
  id: string;
  order_code: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  vendor_id: string;
  rider_id?: string;
  zone?: string;
  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  
  food_total: number;
  delivery_distance_km: number;
  delivery_fee: number;
  total_cash_payable: number; // food_total + delivery_fee
  
  food_cash_paid_to_vendor: boolean;
  food_and_delivery_cash_collected_from_customer: boolean;
  
  status: OrderStatus;
  vendor_prep_minutes?: number;
  prep_ends_at?: string;
  customer_confirmed_prep?: boolean;
  cancellation_reason?: string;
  
  // Intelligent Single-Rider Proximity & Zone Dispatching Engine
  dispatched_rider_id?: string;
  dispatch_sent_at?: string;
  rejected_rider_ids?: string[];
  
  special_instructions?: string;
  created_at: string;
  updated_at: string;
  
  items?: OrderItem[];
  vendor?: Vendor;
  rider?: Rider;
}

export interface RiderMessage {
  id: string;
  recipient_rider_id: string; // 'ALL' or specific rider id
  sender: string; // e.g. 'FoodHub Admin'
  title: string;
  body: string;
  created_at: string;
  is_read?: boolean;
}

export interface VendorReview {
  id: string;
  vendor_id: string;
  order_id?: string;
  order_code: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  rating: number; // 1 to 5
  comment: string;
  mentioned_items?: string[]; // Menu items/dishes mentioned in review
  created_at: string;
  vendor_reply?: {
    text: string;
    replied_at: string;
    status: 'approved' | 'pending' | 'rejected';
  };
  dispute?: {
    reason: string;
    comment?: string;
    status: 'submitted' | 'under_review' | 'resolved';
    disputed_at: string;
  };
}

export interface FavoriteVendor {
  id: string;
  customer_id?: string;
  customer_phone?: string;
  vendor_id: string;
  created_at?: string;
}

export interface OtpSenderRecord {
  id: string; // Customer user UUID
  phone: string;
  phone_number?: string;
  otp?: string;
  created_at?: string;
  updated_at?: string;
}

