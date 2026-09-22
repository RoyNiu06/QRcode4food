import QrScanner from "qr-scanner";

export async function prepareImage(
  file: File,
): Promise<{ blob: Blob; url: string; decodeError: string }> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("图片不能超过 10 MB，请选择较小的图片");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("请选择 JPG、PNG 或 WebP 图片；HEIC 照片可以先截图再上传");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 24_000_000)
      throw new Error("图片尺寸过大，请先裁剪到二维码附近再上传");
    let url = "",
      decodeError = "";
    try {
      const result = await QrScanner.scanImage(image, {
        returnDetailedScanResult: true,
        alsoTryWithoutScanRegion: true,
      });
      url = result.data;
    } catch {
      decodeError =
        "没有识别到清晰二维码。可裁剪后重传，或在下方手动填写点餐网址。";
    }
    const ratio = Math.min(
      1,
      2048 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * ratio);
    canvas.height = Math.round(image.naturalHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法处理图片，请更换浏览器");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片处理失败，请重试"))),
        "image/jpeg",
        0.94,
      ),
    );
    if (blob.size > 5 * 1024 * 1024)
      throw new Error("处理后的图片过大，请先裁剪后重试");
    return { blob, url, decodeError };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
