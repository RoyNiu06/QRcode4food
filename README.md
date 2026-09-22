# QRCode

附近餐厅的轻量点餐目录。访客无需登录，点击餐厅直接进入商家网页；管理员在 `/admin` 上传二维码照片、自动识别网址并发布。

- 网站：https://qrcode.royilab.com
- 管理后台：https://qrcode.royilab.com/admin
- 首版只支持无需桌号的通用网页入口。
- 固定一个管理员可配置的地点；没有访客上传功能。
- `shared/types.ts` 中的 `MenuProvider` 仅为未来菜单接口约定，当前没有菜单获取、接口路由或 UI。

## 管理员开始使用

1. 使用部署时提供的专属初始化链接（`/admin#setup=…`），输入初始密码 `000000`。
2. 依照页面提示设置至少 10 位的新密码，再登录。此后直接使用 `/admin`。
3. 在「地点设置」填写地点名称和地址。
4. 添加餐厅，上传单个清晰二维码，或手动填写完整网页网址。
5. 点击「试打开网址」，核对门店并确认不需要桌号，选择「发布到首页」。

初始化链接只在第一次改密前使用。初始化密钥和密码均不在源码中分发。管理员上传的二维码不能包含个人订单、私人会话或桌号信息。小程序码、支付码和纯文本码不会自动成为网页点餐入口。

## 技术与本地开发

React + TypeScript + Vite；Cloudflare Worker + D1 + 私有 R2。公开目录不加载二维码解码库，管理员上传页按需加载 `qr-scanner` 及其 Worker 回退解码器。

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
- 草稿图片需要有效管理员会话；只有已发布记录可公开读取。
- 登录有持久化限流；Cookie 为 HttpOnly、SameSite=Strict，线上使用 Secure。改密或退出撤销会话。
- PBKDF2-SHA256 使用随机盐、100,000 次迭代和独立 Worker secret pepper；会话仅保存 SHA-256 摘要。不要无计划轮换 pepper，否则现有密码无法校验。
- 每日清理过期会话、限流记录和超过一天的未关联图片。
- 服务端不访问任意商家 URL，不抓取菜单、不代理订单或支付；网址可用性由管理员发布前核对。
- 未提供真实地点和商家二维码时，线上保持空目录，不使用测试商家充数。
- 浏览器模拟尺寸不能替代真实折叠屏、Safari 或微信内置浏览器的设备验收。

完整产品计划见 `docs/PLAN.md`，实施后的验证结果见 `docs/QA.md`。
