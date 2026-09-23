export type RestaurantStatus = "draft" | "published" | "disabled";
export type Place = { name: string; address: string; description: string };
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
};
export type Catalog = { place: Place; restaurants: Restaurant[] };
export type AdminSession = { authenticated: boolean; mustChange?: boolean };

// Future adapter boundary only. No menu endpoint, data fetching, or UI is enabled in v1.
export interface MenuProvider {
  getMenu(restaurantId: string): Promise<{
    sections: {
      name: string;
      items: { name: string; description?: string; price?: string }[];
    }[];
  }>;
}
