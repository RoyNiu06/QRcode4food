# QRCode

附近餐厅的轻量点餐目录。访客无需登录，点击餐厅或窗口进入商家网页；管理员在 `/admin` 上传二维码照片、自动识别网址并发布。

- 网站：https://qrcode.royilab.com
- 管理后台：https://qrcode.royilab.com/admin
- 首版只支持无需桌号的通用网页入口。
- 固定一个管理员可配置的地点；访客可投稿二维码，管理员审核后才公开。
- 网站与后台支持简体中文、繁体中文、英文切换，选择保存在浏览器中。当前地点为香港城市大学。
- 管理员可为餐厅单独填写繁体和英文名称、地址与介绍；留空时访客看到原始内容。分类由界面翻译。
- 「今天吃什么」默认按餐厅抽签，也可切换为按窗口抽签；两种模式均可按分类筛选或手动勾选。
- `shared/types.ts` 中的 `MenuProvider` 仅为未来菜单接口约定，当前没有菜单获取、接口路由或 UI。

## 管理员开始使用

1. 已初始化的网站直接打开 `/admin`，使用管理员密码登录。密码支持至少 6 位，可使用纯数字及重复数字。
2. 添加餐厅，只需填写名称。上传单个清晰二维码后自动填入点餐链接，也可手动粘贴或暂时留空。
3. 点击「保存并发布」。位置、分类、介绍等收在「更多信息」内，均可不填；「试打开链接」为可选操作。
4. 地点设置独立选填，不再作为发布前置条件；保存地点时也只要求名称。没有链接的餐厅显示“点餐入口待补充”。
5. 餐厅列表中点击「批量上传二维码」，一次选择至多 20 张二维码，核对每个窗口名称及识别出的链接后统一发布。窗口可继续添加、修改或删除；已有主入口保留为一个独立选项。
6. 「共创审核」列出待审投稿、二维码、匿名浏览器编号与提交时间；管理员可修改名称、目标餐厅、窗口名称和网址后通过或拒绝。通过新餐厅投稿会发布新餐厅，通过已有餐厅投稿会新增窗口。

全新安装时，使用部署方提供的 `/admin#setup=…` 链接及初始密码完成初始化；可以保留六位密码。已有站点无需重复初始化。初始化密钥不在源码中分发。管理员上传的二维码不能包含个人订单、私人会话或桌号信息。小程序码、支付码和纯文本码不会自动成为网页点餐入口。

## 技术与本地开发

React + TypeScript + Vite；Cloudflare Worker + D1 + 私有 R2。公开目录不加载二维码解码库，图片上传时按需加载 `qr-scanner` 及其 Worker 回退解码器。

```sh
npm ci
# 将 .dev.vars.example 复制为 .dev.vars，并设置本地随机值
npm run db:local
npm run build
npm run preview
```

打开 `http://127.0.0.1:8787`。本地首次初始化地址为 `http://127.0.0.1:8787/admin#setup=你的本地SETUP_TOKEN`。

实时前端开发可另开终端执行 `npm run dev`；Vite 将 `/api` 和 `/media` 代理到本地 Worker。后台修改后重新构建静态资源，或使用 Vite 开发地址。

```sh
npm test                # URL、安全字段、密码哈希、图片文件校验
npm run build          # TypeScript 检查及生产打包
npx wrangler deploy --dry-run
```

`scripts/check-api.mjs` 是本地完整流程验证脚本，覆盖首次登录/改密、权限、CSRF、上传、发布、停用与删除。仅对全新本地数据库运行，需设置本地 `AUTH_SECRET=local-test-pepper-not-for-production` 和 `SETUP_TOKEN=local-setup-test`，使用 8787 端口；它会把本地管理员密码改为脚本中的测试密码并留下明确标注的测试目录，禁止对线上运行。实际浏览器 QA 使用 Playwright CLI，产物位于被忽略的 `output/playwright`。

`scripts/check-community.mjs` 仅用于**已有测试餐厅的本地数据库**，会新增测试窗口和多条投稿，并验证窗口增改删、投稿隐私、新旧餐厅审核与串行/并发 5 小时限额。不要对线上运行。

## 部署和版本管理

GitHub Actions 在 PR 上运行测试与构建，main 更新后迁移并部署。需要仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。Worker 的 `AUTH_SECRET` 和 `SETUP_TOKEN` 使用 Cloudflare Secrets 管理，不设置为前端变量。后续 `wrangler deploy` 保留既有 secrets。

```sh
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

数据库、R2 与自定义域名均在 `wrangler.jsonc` 声明。迁移优先保持向后兼容，回滚代码不自动回滚数据。执行破坏性数据库操作前导出备份。

```sh
npx wrangler d1 export DB --remote --output backup.sql
npx wrangler versions list
npx wrangler rollback <version-id>
```

备份包含管理员密码哈希和会话，必须放在受保护的本地目录，不提交到仓库。恢复管理员访问时可在受信任环境使用 D1 删除管理员会话并重置管理员记录，再更换 `SETUP_TOKEN` 后重新初始化；不要在公开 API 中提供重置入口。

## 运行边界

- 图片原始上限 10 MB、24 MP；客户端识别后重新编码，服务器接受不超过 5 MB 的 PNG/JPEG，检查文件签名和尺寸。
- 草稿及待审核投稿图片需要有效管理员会话；只有已发布餐厅或窗口关联的图片可公开读取。
- 访客投稿使用服务端签名的匿名浏览器 Cookie 和 D1 原子计数，首次提交起 5 小时最多 10 条。后台可查看匿名编号、次数、投稿时间与重置时间。清除浏览器数据可换新编号，因此该限制是免登录场景下的尽力约束，并非身份验证。
- 登录有持久化限流；Cookie 为 HttpOnly、SameSite=Strict，线上使用 Secure。改密或退出撤销会话。
- PBKDF2-SHA256 使用随机盐、100,000 次迭代和独立 Worker secret pepper；会话仅保存 SHA-256 摘要。不要无计划轮换 pepper，否则现有密码无法校验。
- 每日清理过期会话、限流记录和超过一天的未关联图片。
- 服务端不访问任意商家 URL，不抓取菜单、不代理订单或支付；网址可用性由管理员发布前核对。
- 未提供真实地点和商家二维码时，线上保持空目录，不使用测试商家充数。
- 浏览器模拟尺寸不能替代真实折叠屏、Safari 或微信内置浏览器的设备验收。

完整产品计划见 `docs/PLAN.md`，实施后的验证结果见 `docs/QA.md`。
