# 业绩助手 - Gitee 云存储网页 APP v2

这是一个可以部署成网址使用的手机网页 APP / PWA。数据保存在 Gitee 私有仓库的 JSON 文件中。

## v2 主要变化

- 去掉“月目标”“金额类合计”“是否计入金额合计”等概念。
- 首页改为显示：今日上报笔数、本月上报笔数、今日各项业绩汇总、本月各项业绩汇总。
- 月报改为“月统计”：展示不同业绩类型的月度统计图。
- 新增“单项业绩每日趋势图”：可选择某个业绩类型查看每天变化。
- 新增“成员管理”：可以为多名成员记录业绩，并按成员筛选首页、日报、月统计。
- 保留 Gitee 拉取/上传、业绩类型管理、导出 JSON、导出 CSV、清空记录等功能。

## 文件结构

```text
gitee-performance-webapp/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── icon.svg
├── data-format.json
└── README.md
```

## 部署方式

把以下文件上传到 Gitee Pages、宝塔网站目录、Nginx 静态站点或任意静态网站空间：

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icon.svg
```

然后用手机浏览器打开网址，即可使用。安卓 Chrome / Edge 或 iPhone Safari 可以添加到手机主屏幕。

## Gitee 数据仓库

建议单独创建一个私有仓库，例如：

```text
performance-data
```

在仓库中创建数据文件：

```text
data/performance.json
```

可以先复制 `data-format.json` 的内容作为初始数据。

## APP 中的 Gitee 配置

进入：

```text
我的 → Gitee 数据同步设置
```

填写：

```text
Gitee 用户名/组织：你的 Gitee 用户名
仓库名：performance-data
分支：master 或 main
数据路径：data/performance.json
Access Token：你的 Gitee 私人令牌
```

## 数据安全提醒

这是纯前端方案，Access Token 会保存在当前浏览器本地。适合个人使用、内部使用、小范围使用。正式多人使用时，建议增加自己的后端服务，由后端代管 Token。

## 数据格式说明

请看 `data-format.json`。核心结构如下：

```json
{
  "version": 2,
  "members": [],
  "types": [],
  "records": [],
  "updatedAt": "2026-05-31T00:00:00.000Z"
}
```

- `members`：成员列表。
- `types`：业绩类型列表。
- `records`：业绩记录，每条记录关联一个成员和一个业绩类型。
- `updatedAt`：最后更新时间。
