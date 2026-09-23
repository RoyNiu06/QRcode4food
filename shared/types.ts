export type RestaurantStatus = "draft" | "published" | "disabled";
export type Place = { name: string; address: string; description: string };
export type RestaurantWindow = {
  id: string;
  restaurant_id: string;
  name: string;
  url: string;
  image_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type Restaurant = {
  id: string;
  name: string;
  name_zh_hant: string;
  name_en: string;
  address: string;
  address_zh_hant: string;
  address_en: string;
  category: string;
  description: string;
  description_zh_hant: string;
  description_en: string;
  url: string;
  image_id: string | null;
  status: RestaurantStatus;
  sort_order: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  windows: RestaurantWindow[];
};
export type Catalog = { place: Place; restaurants: Restaurant[] };
export type AdminSession = { authenticated: boolean; mustChange?: boolean };
export type Contribution = {
  id: string;
  browser_hash: string;
  restaurant_id: string | null;
  restaurant_name: string;
  window_name: string;
  url: string;
  image_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  published_id: string | null;
};
export type ContributionQuota = { used: number; limit: number; resets_at: number };
export type QuotaActivity = { browser_hash: string; attempts: number; started_at: number; expires_at: number };

// Future adapter boundary only. No menu endpoint, data fetching, or UI is enabled in v1.
export interface MenuProvider {
  getMenu(restaurantId: string): Promise<{
    sections: {
      name: string;
      items: { name: string; description?: string; price?: string }[];
    }[];
  }>;
}
