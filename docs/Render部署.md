# Render 首次部署

项目使用仓库根目录的 `render.yaml`：Docker、免费实例、Frankfurt 区域、`/healthz` 健康检查。平台自动分配独立网址，不需要 ChatGPT 登录。网站本身使用个人访问密码。

当前状态：代码已准备，尚未创建或验证实际线上服务。不要将下面说明中的服务名称当成已经分配的真实网址。

## 首次连接

1. 登录 https://dashboard.render.com/ 。如果需要注册、接受条款或 GitHub 安装授权，由账号所有者操作。
2. 连接 GitHub，仓库选择 `leoohuang/swedish-vocab-trainer`。仓库保持私有，只授权这一个仓库即可。
3. 创建 Blueprint，选择该仓库的 `main` 分支，使用根目录的 `render.yaml`。核对实例计划为 **Free**，不用添加付费数据库或磁盘。
4. 平台会要求填写两项保密环境变量：`SITE_PASSWORD`（为此网站设置的密码，用户名为 `ord`）、`OPENAI_API_KEY`（现有模型服务密钥）。这些值只在平台的保密配置中填写，不提交 GitHub。其他模型参数已按本机已验证配置填写。
5. 启动部署，等待状态变为可用。使用 Render 实际返回的 HTTPS 网址，不要自行猜测域名。

Render 自动设置 `RENDER_EXTERNAL_URL`，服务会读取它作为允许的网站来源。后来绑定自己的域名时，设置 `PUBLIC_ORIGIN=https://实际域名`，重新部署。

## 验收

- `/healthz` 返回 `ok`。
- 首页提示网站自己的访问密码，用户名 `ord`，不跳转 ChatGPT。
- 输入正确密码后能打开页面；AI 配置状态正常。
- 先用合成词汇验证 AI 整理，再用「数据与设置 → 合并导入备份」迁移个人词库。刷新后核对词库和练习进度。
- 当前词库仍保存在浏览器里，独立托管没有增加跨设备同步。

## 免费实例的限制

根据 Render 官方说明，免费 Web Service 闲置 15 分钟后会休眠，再次访问启动约需一分钟；适合个人试用。当前配置不将词库保存在服务器临时磁盘上。AI 请求仍使用模型账号的额度或计费，不因为托管免费而免费。

官方参考：[免费服务](https://render.com/docs/free)、[Blueprint 规范](https://render.com/docs/blueprint-spec)、[默认环境变量](https://render.com/docs/environment-variables)。
