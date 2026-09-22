export class InputError extends Error {}
export function textField(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
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
  const status = input.status;
  if (!["draft", "published", "disabled"].includes(String(status)))
    throw new InputError("请选择有效的发布状态");
  const sort = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999)
    throw new InputError("排序应为 0 到 9999 的整数");
  if (status === "published" && input.verified !== true)
    throw new InputError("发布前请确认已打开网址并核对餐厅");
  const imageId =
    input.image_id == null || input.image_id === ""
      ? null
      : textField(input.image_id, "图片编号", 80, true);
  if (imageId && !/^[a-f0-9-]{36}$/.test(imageId))
    throw new InputError("图片编号不正确");
  return {
    name: textField(input.name, "餐厅名称", 80, true),
    address: textField(input.address, "地址", 160),
    category: textField(input.category, "分类", 20, true),
    description: textField(input.description, "简介", 160),
    url: validateUrl(input.url),
    image_id: imageId,
    status: status as "draft" | "published" | "disabled",
    sort_order: sort,
  };
}
