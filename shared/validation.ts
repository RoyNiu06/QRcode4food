export class InputError extends Error {}
export function textField(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
  if (!required && value == null) return "";
  if (typeof value !== "string") throw new InputError(`${label}格式不正确`);
  const result = value.trim();
  if ((required && !result) || result.length > max)
    throw new InputError(
      `${label}${required ? "不能为空，且" : ""}不能超过 ${max} 个字`,
    );
  return result;
}
export function validateUrl(input: unknown): string {
  const raw = textField(input, "点餐网址", 4096, true);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InputError("请输入完整的 http:// 或 https:// 网址");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new InputError("只支持不含登录凭据的网页网址");
  const h = url.hostname.toLowerCase();
  if (
    !h.includes(".") ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.startsWith("[") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h)
  )
    throw new InputError("请使用商家的公开域名网址");
  // Return the original string: changing encoding, query order or fragments can break signed merchant links.
  return raw;
}
export function validateRestaurant(input: Record<string, unknown>) {
  const status = input.status ?? "draft";
  if (!["draft", "published", "disabled"].includes(String(status)))
    throw new InputError("请选择有效的发布状态");
  const sort = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999)
    throw new InputError("排序应为 0 到 9999 的整数");
  const imageId =
    input.image_id == null || input.image_id === ""
      ? null
      : textField(input.image_id, "图片编号", 80, true);
  if (imageId && !/^[a-f0-9-]{36}$/.test(imageId))
    throw new InputError("图片编号不正确");
  return {
    name: textField(input.name, "餐厅名称", 80, true),
    name_zh_hant: textField(input.name_zh_hant, "繁体名称", 80),
    name_en: textField(input.name_en, "英文名称", 80),
    address: textField(input.address, "地址", 160),
    address_zh_hant: textField(input.address_zh_hant, "繁体位置", 160),
    address_en: textField(input.address_en, "英文位置", 160),
    category: textField(input.category, "分类", 20) || "其他",
    description: textField(input.description, "简介", 160),
    description_zh_hant: textField(input.description_zh_hant, "繁体简介", 160),
    description_en: textField(input.description_en, "英文简介", 160),
    opens_app: input.opens_app === true || input.opens_app === 1 ? 1 : 0,
    wechat_mini_program: input.wechat_mini_program === true || input.wechat_mini_program === 1 ? 1 : 0,
    other_note: textField(input.other_note, "其他说明", 160),
    other_note_zh_hant: textField(input.other_note_zh_hant, "繁体其他说明", 160),
    other_note_en: textField(input.other_note_en, "英文其他说明", 160),
    url:
      input.url == null ||
      input.url === "" ||
      (typeof input.url === "string" && !input.url.trim())
        ? ""
        : validateUrl(input.url),
    image_id: imageId,
    status: status as "draft" | "published" | "disabled",
    sort_order: sort,
  };
}
export function validateWindow(input: Record<string, unknown>) {
  const sort = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999)
    throw new InputError("排序应为 0 到 9999 的整数");
  const imageId = input.image_id == null || input.image_id === ""
    ? null : textField(input.image_id, "图片编号", 80, true);
  if (imageId && !/^[a-f0-9-]{36}$/.test(imageId))
    throw new InputError("图片编号不正确");
  const rawUrl = textField(input.url, "点餐网址", 4096);
  return {
    name: textField(input.name, "窗口名称", 80, true),
    url: rawUrl ? validateUrl(rawUrl) : "",
    image_id: imageId,
    sort_order: sort,
  };
}
export function validateContribution(input: Record<string, unknown>) {
  const mode = input.mode == null ? "legacy" : textField(input.mode, "投稿类型", 20, true);
  if (!["legacy", "restaurant", "update"].includes(mode)) throw new InputError("投稿类型不正确");
  const restaurantId = input.restaurant_id == null || input.restaurant_id === ""
    ? null : textField(input.restaurant_id, "餐厅编号", 80, true);
  if (restaurantId && !/^[a-f0-9-]{36}$/.test(restaurantId))
    throw new InputError("餐厅编号不正确");
  if (mode === "restaurant" && restaurantId) throw new InputError("新餐厅不能指定现有餐厅");
  if (mode === "update" && !restaurantId) throw new InputError("请选择要补充的餐厅");
  const includeMain = mode === "legacy" ? true : input.include_main === true || input.include_main === 1;
  if (mode !== "legacy" && ![true,false,0,1].includes(input.include_main as boolean))
    throw new InputError("主入口选项不正确");
  const rawUrl = textField(input.url, "点餐网址", 4096);
  return {
    mode: mode as "legacy" | "restaurant" | "update",
    include_main: includeMain,
    restaurant_id: restaurantId,
    restaurant_name: textField(input.restaurant_name, "餐厅名称", 80, true),
    window_name: textField(input.window_name, "窗口名称", 80),
    url: includeMain && rawUrl ? validateUrl(rawUrl) : "",
    name_zh_hant: textField(input.name_zh_hant, "繁体名称", 80),
    name_en: textField(input.name_en, "英文名称", 80),
    address: textField(input.address, "地址", 160),
    address_zh_hant: textField(input.address_zh_hant, "繁体位置", 160),
    address_en: textField(input.address_en, "英文位置", 160),
    category: textField(input.category, "分类", 20) || "其他",
    description: textField(input.description, "简介", 160),
    description_zh_hant: textField(input.description_zh_hant, "繁体简介", 160),
    description_en: textField(input.description_en, "英文简介", 160),
    opens_app: input.opens_app === true || input.opens_app === 1 ? 1 : 0,
    wechat_mini_program: input.wechat_mini_program === true || input.wechat_mini_program === 1 ? 1 : 0,
    other_note: textField(input.other_note, "其他说明", 160),
    other_note_zh_hant: textField(input.other_note_zh_hant, "繁体其他说明", 160),
    other_note_en: textField(input.other_note_en, "英文其他说明", 160),
  };
}

export function validateContributionWindows(input: unknown) {
  if (!Array.isArray(input) || input.length > 10) throw new InputError("每次最多补充 10 个窗口");
  return input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new InputError("窗口内容不正确");
    const item = raw as Record<string, unknown>;
    const rawUrl = textField(item.url, "点餐网址", 4096);
    return {
      id: item.id == null ? "" : textField(item.id, "窗口编号", 80),
      name: textField(item.name, "窗口名称", 80, true),
      url: rawUrl ? validateUrl(rawUrl) : "",
      included: item.included !== false && item.included !== 0,
      sort_order: index,
    };
  });
}

export function validateRaffleSettings(input: Record<string, unknown>) {
  if (typeof input.enabled !== "boolean") throw new InputError("请选择是否启用彩蛋");
  function lines(value: unknown, label: string) {
    if (!Array.isArray(value) || value.length > 12) throw new InputError(`${label}最多 12 句`);
    return value.map(item=>textField(item,label,120,true));
  }
  return {
    enabled:input.enabled,
    lines_zh_hans:lines(input.lines_zh_hans,"简体彩蛋"),
    lines_zh_hant:lines(input.lines_zh_hant,"繁体彩蛋"),
    lines_en:lines(input.lines_en,"英文彩蛋"),
  };
}
