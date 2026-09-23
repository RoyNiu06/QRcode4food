import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Restaurant } from "../shared/types";

export type Locale = "zh-Hans" | "zh-Hant" | "en";
const translations: Record<string, [string, string]> = {
  "正在打开…": ["正在開啟…", "Opening…"],
  这里暂时没有内容: ["這裡暫時沒有內容", "Nothing here yet"],
  返回餐厅目录: ["返回餐廳目錄", "Back to restaurants"],
  首页: ["首頁", "home"],
  选择语言: ["選擇語言", "Choose language"],
  附近餐厅: ["附近餐廳", "Nearby restaurants"],
  地点待设置: ["地點待設定", "Location pending"],
  香港城市大学: ["香港城市大學", "City University of Hong Kong"],
  "下一餐，": ["下一餐，", "Where to eat"],
  "吃什么？": ["吃什麼？", " next?"],
  "是啊，吃什么？": ["是啊，吃什麼？", "Yes, what should we eat?"],
  附近好味: ["附近好味", "Good food nearby"],
  家餐厅: ["家餐廳", "restaurants"],
  搜索餐厅: ["搜尋餐廳", "Search restaurants"],
  "想吃什么？搜搜店名或美食": [
    "想吃什麼？搜尋店名或美食",
    "Search a restaurant or dish",
  ],
  清空搜索: ["清除搜尋", "Clear search"],
  餐厅分类: ["餐廳分類", "Restaurant categories"],
  全部: ["全部", "All"],
  中餐: ["中餐", "Chinese"],
  西餐: ["西餐", "Western"],
  日韩料理: ["日韓料理", "Japanese & Korean"],
  快餐小吃: ["快餐小吃", "Quick bites"],
  咖啡茶饮: ["咖啡茶飲", "Coffee & tea"],
  甜品烘焙: ["甜品烘焙", "Desserts & bakery"],
  其他: ["其他", "Other"],
  "选一家，直接点餐": ["選一家，直接點餐", "Pick one and order"],
  正在加载餐厅: ["正在載入餐廳", "Loading restaurants"],
  这次没能加载出来: ["這次未能載入", "Couldn't load restaurants"],
  重新加载: ["重新載入", "Try again"],
  "把喜欢的味道，安排进今天。": [
    "把喜歡的味道，安排進今天。",
    "Find something good today.",
  ],
  开始点餐: ["開始點餐", "Order now"],
  点餐入口待补充: ["點餐入口待補充", "Ordering link coming soon"],
  查看二维码: ["查看二維碼", "View QR code"],
  还没找到这个味道: ["還沒找到這個味道", "No matching restaurants"],
  "换个关键词，或者看看全部餐厅。": [
    "換個關鍵字，或看看全部餐廳。",
    "Try another search or view all restaurants.",
  ],
  查看全部餐厅: ["查看全部餐廳", "View all restaurants"],
  "这里的好味道，正在集合。": [
    "這裡的好味道，正在集合。",
    "Good food is on its way.",
  ],
  "餐厅上线后，你可以在这里一键打开点餐。": [
    "餐廳上線後，你可以在這裡一鍵打開點餐。",
    "When restaurants arrive, order with one tap.",
  ],
  "不用扫码，不用登录。": ["不用掃碼，不用登入。", "No scanning. No sign-in."],
  "好好吃饭，慢慢生活。": ["好好吃飯，慢慢生活。", "Eat well. Take your time."],
  "也可以直接点餐，无需再次扫码。": [
    "也可以直接點餐，無需再次掃碼。",
    "You can also open the ordering page directly.",
  ],
  复制点餐链接: ["複製點餐連結", "Copy ordering link"],
  链接已复制: ["連結已複製", "Link copied"],
  "点餐链接待补充，可先查看或保存二维码。": [
    "點餐連結待補充，可先查看或儲存二維碼。",
    "Ordering link coming soon. You can view the QR code.",
  ],
  "复制未成功，请长按下方网址复制": [
    "複製未成功，請長按下方網址複製",
    "Copy failed. Press and hold the URL below.",
  ],
  "附近好味，一点即达。": ["附近好味，一點即達。", "Good food, one tap away."],
  跳到餐厅列表: ["跳到餐廳列表", "Skip to restaurant list"],
  餐厅目录: ["餐廳目錄", "Restaurants"],
  管理导航: ["管理導覽", "Admin navigation"],
  管理空间: ["管理空間", "Admin"],
  查看网站: ["查看網站", "View site"],
  退出登录: ["登出", "Log out"],
  地点设置: ["地點設定", "Location"],
  账户安全: ["帳戶安全", "Security"],
  "小小目录，大大满足。": [
    "小小目錄，大大滿足。",
    "A little directory, a lot to enjoy.",
  ],
  "把点餐入口整理好，让每一餐都简单一点。": [
    "把點餐入口整理好，讓每一餐都簡單一點。",
    "Keep ordering links in one easy place.",
  ],
  "整理好味道，让大家一点就开餐。": [
    "整理好味道，讓大家一點就開餐。",
    "A simple way to find your next meal.",
  ],
  添加餐厅: ["新增餐廳", "Add restaurant"],
  全部餐厅: ["全部餐廳", "All restaurants"],
  正在展示: ["正在展示", "On the site"],
  已发布: ["已發佈", "Published"],
  草稿: ["草稿", "Draft"],
  已停用: ["已停用", "Hidden"],
  当前地点: ["目前地點", "Current location"],
  还未设置: ["尚未設定", "Not set"],
  为目录添加一个地点: ["為目錄新增一個地點", "Add a location"],
  "选填，不影响添加和发布餐厅。": [
    "選填，不影響新增和發佈餐廳。",
    "Optional; restaurants can be published without it.",
  ],
  设置地点: ["設定地點", "Set location"],
  "餐厅 / 点餐入口": ["餐廳 / 點餐入口", "Restaurant / ordering link"],
  状态与操作: ["狀態與操作", "Status & actions"],
  编辑: ["編輯", "Edit"],
  删除: ["刪除", "Delete"],
  从第一张二维码开始: ["從第一張二維碼開始", "Start with a QR code"],
  "上传餐厅的点餐码，自动识别成可以点击的网址。": [
    "上傳餐廳的點餐碼，自動識別成可以點擊的網址。",
    "Upload an ordering QR code to extract its link.",
  ],
  添加第一家餐厅: ["新增第一家餐廳", "Add the first restaurant"],
  "所有餐厅都会展示在这个地点的目录下。": [
    "所有餐廳都會顯示在這個地點的目錄下。",
    "Restaurants appear under this location.",
  ],
  "修改密码后，所有已登录的设备都会退出。": [
    "修改密碼後，所有已登入的裝置都會登出。",
    "Changing the password signs out all devices.",
  ],
  修改管理员密码: ["修改管理員密碼", "Change admin password"],
  "餐厅已保存，已发布内容会显示在首页": [
    "餐廳已儲存，已發佈內容會顯示在首頁",
    "Restaurant saved. Published entries appear on the home page.",
  ],
  "地点设置已保存，首页已更新": [
    "地點設定已儲存，首頁已更新",
    "Location saved. The home page is updated.",
  ],
  餐厅已删除: ["餐廳已刪除", "Restaurant deleted"],
  关闭提示: ["關閉提示", "Dismiss message"],
  "删除这家餐厅？": ["刪除這家餐廳？", "Delete this restaurant?"],
  取消: ["取消", "Cancel"],
  确认删除: ["確認刪除", "Delete restaurant"],
  删除说明前: ["「", "“"],
  删除说明后: [
    "」將從目錄中移除，無法還原。若只想隱藏，可在編輯中選擇停用。",
    "” will be removed permanently. To hide it, choose Hidden in the editor.",
  ],
  今天吃什么: ["今天吃什麼", "What to eat today"],
  抽签结果: ["抽籤結果", "Draw result"],
  今天就吃这家: ["今天就吃這家", "This is the one"],
  正在寻找好味道: ["正在尋找好味道", "Finding something good"],
  交给运气决定: ["交給運氣決定", "Leave it to chance"],
  去这家点餐: ["去這家點餐", "Order from this restaurant"],
  "正在抽签…": ["正在抽籤…", "Drawing…"],
  "勾选想参与的餐厅，然后开始抽签": [
    "勾選想參與的餐廳，然後開始抽籤",
    "Choose restaurants, then start the draw.",
  ],
  抽签范围: ["抽籤範圍", "Draw pool"],
  选择范围: ["選擇範圍", "Choose your pool"],
  家候选: ["家候選", "in the pool"],
  "默认包含全部餐厅，也可以按分类筛选或手动勾选。": [
    "預設包含全部餐廳，也可以按分類篩選或手動勾選。",
    "All restaurants are included by default. Filter by category or choose your own.",
  ],
  按分类筛选: ["按分類篩選", "Filter by category"],
  参与抽签的餐厅: ["參與抽籤的餐廳", "Restaurants in the draw"],
  全选: ["全選", "Select all"],
  清空: ["清空", "Clear"],
  还没有可抽签的餐厅: ["還沒有可抽籤的餐廳", "No restaurants to draw yet"],
  再抽一次: ["再抽一次", "Draw again"],
  开始抽签: ["開始抽籤", "Start the draw"],
  繁体中文与英文名称: [
    "繁體中文與英文名稱",
    "Traditional Chinese & English names",
  ],
  "可选，未填写时显示简体名称": [
    "選填；留空時顯示簡體名稱",
    "Optional; falls back to the original name",
  ],
  繁体中文名称: ["繁體中文名稱", "Traditional Chinese name"],
  英文名称: ["英文名稱", "English name"],
  繁体中文位置: ["繁體中文位置", "Traditional Chinese location"],
  英文位置: ["英文位置", "English location"],
  繁体中文介绍: ["繁體中文介紹", "Traditional Chinese description"],
  英文介绍: ["英文介紹", "English description"],
  "正在删除…": ["正在刪除…", "Deleting…"],
  关闭: ["關閉", "Close"],
  "正在打开管理空间…": ["正在開啟管理空間…", "Opening admin…"],
  重试: ["重試", "Retry"],
  先设置一个新密码: ["先設定一個新密碼", "Set a new password"],
  "完成设置后，就可以开始收集附近的好味道。": [
    "完成設定後，就可以開始收集附近的好味道。",
    "Then you can start adding nearby restaurants.",
  ],
  "密码已更新，请使用新密码登录": [
    "密碼已更新，請使用新密碼登入",
    "Password updated. Sign in with the new password.",
  ],
  "密码已更新，请重新登录": [
    "密碼已更新，請重新登入",
    "Password updated. Please sign in again.",
  ],
  返回目录: ["返回目錄", "Back to restaurants"],
  "欢迎回来。": ["歡迎回來。", "Welcome back."],
  "登录管理空间，收集附近的好味道。": [
    "登入管理空間，收集附近的好味道。",
    "Sign in to manage nearby restaurants.",
  ],
  管理员密码: ["管理員密碼", "Admin password"],
  输入你的密码: ["輸入你的密碼", "Enter your password"],
  进入管理空间: ["進入管理空間", "Sign in"],
  仅管理员可以上传与发布餐厅: [
    "只有管理員可以上傳及發佈餐廳",
    "Only admins can upload and publish restaurants",
  ],
  初始密码: ["初始密碼", "Initial password"],
  当前密码: ["目前密碼", "Current password"],
  新密码: ["新密碼", "New password"],
  确认新密码: ["確認新密碼", "Confirm password"],
  再次输入新密码: ["再次輸入新密碼", "Confirm new password"],
  两次新密码不一致: ["兩次新密碼不一致", "Passwords do not match"],
  "至少 6 位，支持纯数字": [
    "至少 6 位，支援純數字",
    "At least 6 characters; numbers are fine",
  ],
  保存新密码: ["儲存新密碼", "Save password"],
  "正在更新…": ["正在更新…", "Updating…"],
  目录所在地点: ["目錄所在地點", "Directory location"],
  地点名称: ["地點名稱", "Location name"],
  "例如：校园生活区 / 某某商场": [
    "例如：香港城市大學",
    "e.g. City University of Hong Kong",
  ],
  详细地址: ["詳細地址", "Address"],
  选填: ["選填", "Optional"],
  "填写城市、街道与具体位置": [
    "填寫城市、街道與具體位置",
    "City, street or building",
  ],
  地点说明: ["地點說明", "Location note"],
  "例如：集合附近可以直接在线点餐的餐厅": [
    "例如：集合附近可以直接網上點餐的餐廳",
    "A collection of nearby ordering links",
  ],
  保存地点: ["儲存地點", "Save location"],
  "正在保存…": ["正在儲存…", "Saving…"],
  编辑餐厅: ["編輯餐廳", "Edit restaurant"],
  "只需填写店名。上传点餐码，网址自动填好。": [
    "只需填寫店名。上傳點餐碼，網址自動填好。",
    "Only the restaurant name is required. Upload a QR code to fill the link.",
  ],
  餐厅名称: ["餐廳名稱", "Restaurant name"],
  必填: ["必填", "Required"],
  "这家好味道叫什么？": ["這家好味道叫什麼？", "What's this place called?"],
  上传二维码照片: ["上傳二維碼照片", "Upload QR image"],
  上传的二维码预览: ["上傳的二維碼預覽", "QR image preview"],
  更换二维码: ["更換二維碼", "Replace QR code"],
  上传点餐二维码: ["上傳點餐二維碼", "Upload ordering QR code"],
  "从相册选择，自动识别网址": [
    "從相簿選擇，自動識別網址",
    "Choose a photo to extract its link",
  ],
  "选填 · JPG / PNG / WebP · 10 MB 内": [
    "選填 · JPG / PNG / WebP · 10 MB 內",
    "Optional · JPG / PNG / WebP · up to 10 MB",
  ],
  点餐链接: ["點餐連結", "Ordering link"],
  "自动识别 / 选填": ["自動識別 / 選填", "Auto-filled / optional"],
  "上传二维码自动填入，也可直接粘贴网址": [
    "上傳二維碼自動填入，也可直接貼上網址",
    "Auto-filled from QR, or paste a URL",
  ],
  "没有链接也能发布，之后随时补充。": [
    "沒有連結也能發佈，之後隨時補充。",
    "You can publish now and add a link later.",
  ],
  "网址已自动填入，可以直接发布。": [
    "網址已自動填入，可以直接發佈。",
    "Link detected. Ready to publish.",
  ],
  试打开链接: ["試開啟連結", "Open link to check"],
  "该链接使用 HTTP，请留意商家页面。": [
    "此連結使用 HTTP，請留意商家頁面。",
    "This link uses HTTP. Check the merchant page.",
  ],
  更多信息: ["更多資訊", "More details"],
  "位置、分类、介绍等，均可不填": [
    "位置、分類、介紹等，均可不填",
    "Location, category and description are optional",
  ],
  "位置 / 分店": ["位置 / 分店", "Location / branch"],
  "例如：商场 2 楼": ["例如：商場 2 樓", "e.g. 2nd floor"],
  分类: ["分類", "Category"],
  排序: ["排序", "Order"],
  一句话介绍: ["一句話介紹", "Short description"],
  "招牌菜、口味，或者一句推荐": [
    "招牌菜、口味，或一句推薦",
    "Specialties or a quick recommendation",
  ],
  展示状态: ["展示狀態", "Visibility"],
  发布到首页: ["發佈到首頁", "Publish on home page"],
  暂时停用: ["暫時停用", "Hide for now"],
  存为草稿: ["儲存為草稿", "Save draft"],
  保存并发布: ["儲存並發佈", "Save & publish"],
  保存修改: ["儲存修改", "Save changes"],
  "正在读取图片并识别二维码…": [
    "正在讀取圖片並識別二維碼…",
    "Reading image and scanning QR code…",
  ],
  "识别出的内容不是可用的网页网址，请提供通用网页点餐链接。": [
    "識別出的內容不是可用的網頁網址，請提供一般網頁點餐連結。",
    "The QR code doesn't contain a usable web URL.",
  ],
  "操作未完成，请稍后重试": [
    "操作未完成，請稍後再試",
    "Action failed. Please try again.",
  ],
  文件或内容过大: ["檔案或內容過大", "File or content is too large"],
  请求内容格式不正确: ["請求內容格式不正確", "Invalid request format"],
  "请求来源不受信任，请刷新页面重试": [
    "請求來源不受信任，請重新整理後再試",
    "Untrusted request. Refresh and try again.",
  ],
  "尝试次数较多，请 15 分钟后再试": [
    "嘗試次數過多，請於 15 分鐘後再試",
    "Too many attempts. Try again in 15 minutes.",
  ],
  "登录已过期，请重新登录": [
    "登入已過期，請重新登入",
    "Session expired. Sign in again.",
  ],
  请先设置新的管理员密码: [
    "請先設定新的管理員密碼",
    "Set an admin password first.",
  ],
  图片不存在: ["圖片不存在", "Image not found"],
  管理员服务尚未初始化: [
    "管理員服務尚未初始化",
    "Admin service is not initialized",
  ],
  首次登录请使用专属初始化链接: [
    "首次登入請使用專屬初始化連結",
    "Use your private setup link for the first sign-in.",
  ],
  "密码不正确，请重试": [
    "密碼不正確，請再試一次",
    "Incorrect password. Try again.",
  ],
  当前密码不正确: ["目前密碼不正確", "Current password is incorrect"],
  "密码至少 6 位": ["密碼至少 6 位", "Password must be at least 6 characters"],
  "密码已被修改，请重新登录": [
    "密碼已修改，請重新登入",
    "Password changed. Sign in again.",
  ],
  "图片格式无效或尺寸过大，请上传 JPEG / PNG 图片": [
    "圖片格式無效或尺寸過大，請上傳 JPEG / PNG 圖片",
    "Invalid or oversized image. Upload a JPEG or PNG.",
  ],
  "图片不存在，请重新上传": [
    "圖片不存在，請重新上傳",
    "Image not found. Upload it again.",
  ],
  "餐厅不存在，可能已被删除": [
    "餐廳不存在，可能已被刪除",
    "Restaurant not found. It may have been deleted.",
  ],
  "请输入完整的 http:// 或 https:// 网址": [
    "請輸入完整的 http:// 或 https:// 網址",
    "Enter a full http:// or https:// URL.",
  ],
  只支持不含登录凭据的网页网址: [
    "只支援不含登入資料的網頁網址",
    "Only web URLs without embedded credentials are supported.",
  ],
  请使用商家的公开域名网址: [
    "請使用商家的公開網域網址",
    "Use the merchant's public domain.",
  ],
  请选择有效的发布状态: ["請選擇有效的發佈狀態", "Choose a valid status."],
  "排序应为 0 到 9999 的整数": [
    "排序須為 0 至 9999 的整數",
    "Order must be a whole number from 0 to 9999.",
  ],
  图片编号不正确: ["圖片編號不正確", "Invalid image ID."],
  "图片不能超过 10 MB，请选择较小的图片": [
    "圖片不能超過 10 MB，請選擇較小的圖片",
    "Image must be under 10 MB.",
  ],
  "请选择 JPG、PNG 或 WebP 图片；HEIC 照片可以先截图再上传": [
    "請選擇 JPG、PNG 或 WebP 圖片；HEIC 照片可先截圖再上傳",
    "Choose a JPG, PNG or WebP image. For HEIC, take a screenshot first.",
  ],
  "图片尺寸过大，请先裁剪到二维码附近再上传": [
    "圖片尺寸過大，請先裁剪到二維碼附近再上傳",
    "Image dimensions are too large. Crop around the QR code first.",
  ],
  "当前浏览器无法处理图片，请更换浏览器": [
    "目前瀏覽器無法處理圖片，請更換瀏覽器",
    "This browser cannot process the image. Try another browser.",
  ],
  "图片处理失败，请重试": [
    "圖片處理失敗，請再試一次",
    "Image processing failed. Try again.",
  ],
  "处理后的图片过大，请先裁剪后重试": [
    "處理後的圖片過大，請先裁剪再試",
    "Processed image is too large. Crop it and try again.",
  ],
  "没有识别到清晰二维码。可裁剪后重传，或在下方手动填写点餐网址。": [
    "未識別到清晰二維碼。可裁剪後重傳，或在下方手動填寫點餐網址。",
    "No clear QR code found. Crop and retry, or enter the ordering URL below.",
  ],
};

export function translate(locale: Locale, text: string): string {
  if (locale === "zh-Hans") return text;
  return translations[text]?.[locale === "zh-Hant" ? 0 : 1] || text;
}

export function localizedRestaurant(
  restaurant: Restaurant,
  field: "name" | "address" | "description",
  locale: Locale,
): string {
  if (locale === "zh-Hans") return restaurant[field];
  const suffix = locale === "zh-Hant" ? "zh_hant" : "en";
  const translated = restaurant[`${field}_${suffix}` as keyof Restaurant];
  return (
    (typeof translated === "string" && translated.trim()) || restaurant[field]
  );
}

export function localizedPlace(name: string, locale: Locale): string {
  return name === "香港城市大学" ? translate(locale, name) : name;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
};
const LocaleContext = createContext<LocaleContextValue | null>(null);
const locales: Locale[] = ["zh-Hans", "zh-Hant", "en"];
function initialLocale(): Locale {
  try {
    const value = localStorage.getItem("qr-locale");
    if (locales.includes(value as Locale)) return value as Locale;
  } catch {
    /* Keep the default if storage is unavailable. */
  }
  return "zh-Hans";
}
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("qr-locale", locale);
    } catch {
      /* Language still works. */
    }
  }, [locale]);
  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, t: (text) => translate(locale, text) }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("LocaleProvider is missing");
  return context;
}
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={translate(locale, "选择语言")}
    >
      {(["zh-Hans", "zh-Hant", "en"] as Locale[]).map((value, index) => (
        <button
          key={value}
          type="button"
          aria-label={["简体中文", "繁體中文", "English"][index]}
          aria-pressed={locale === value}
          className={locale === value ? "active" : ""}
          onClick={() => setLocale(value)}
        >
          {["简", "繁", "EN"][index]}
        </button>
      ))}
    </div>
  );
}
