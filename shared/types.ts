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
  opens_app: number;
  wechat_mini_program: number;
  other_note: string;
  other_note_zh_hant: string;
  other_note_en: string;
  url: string;
  image_id: string | null;
  status: RestaurantStatus;
  sort_order: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  windows: RestaurantWindow[];
};
export type RaffleSettings = { enabled: boolean; lines_zh_hans: string[]; lines_zh_hant: string[]; lines_en: string[] };
export type Catalog = { place: Place; restaurants: Restaurant[]; raffle: RaffleSettings };
export type AdminSession = { authenticated: boolean; mustChange?: boolean };
export type Contribution = {
  id: string;
  browser_hash: string;
  restaurant_id: string | null;
  restaurant_name: string;
  window_name: string;
  url: string;
  image_id: string | null;
  mode: "legacy" | "restaurant" | "update";
  include_main: number;
  name_zh_hant: string;
  name_en: string;
  address: string;
  address_zh_hant: string;
  address_en: string;
  category: string;
  description: string;
  description_zh_hant: string;
  description_en: string;
  opens_app: number;
  wechat_mini_program: number;
  other_note: string;
  other_note_zh_hant: string;
  other_note_en: string;
  windows: ContributionWindow[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  published_id: string | null;
};
export type ContributionWindow = {
  id: string;
  contribution_id: string;
  name: string;
  url: string;
  image_id: string | null;
  sort_order: number;
  included: number;
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
