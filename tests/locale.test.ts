import { test } from "node:test";
import assert from "node:assert/strict";
import type { Restaurant } from "../shared/types";
import { localizedPlace, localizedRestaurant, translate } from "../src/locale";

test("three languages use admin translations and preserve original content as fallback", () => {
  const restaurant = {
    name: "测试餐厅",
    name_zh_hant: "測試餐廳",
    name_en: "Test Restaurant",
    address: "香港城市大学",
    address_zh_hant: "",
    address_en: "CityUHK",
    description: "好吃",
    description_zh_hant: "",
    description_en: "Tasty",
  } as Restaurant;
  assert.equal(localizedRestaurant(restaurant, "name", "zh-Hans"), "测试餐厅");
  assert.equal(localizedRestaurant(restaurant, "name", "zh-Hant"), "測試餐廳");
  assert.equal(
    localizedRestaurant(restaurant, "name", "en"),
    "Test Restaurant",
  );
  assert.equal(
    localizedRestaurant(restaurant, "description", "zh-Hant"),
    "好吃",
  );
  assert.equal(localizedRestaurant(restaurant, "address", "en"), "CityUHK");
  assert.equal(
    localizedPlace("香港城市大学", "en"),
    "City University of Hong Kong",
  );
  assert.equal(translate("zh-Hant", "今天吃什么"), "今天吃什麼");
  assert.equal(translate("en", "开始抽签"), "Start the draw");
});
