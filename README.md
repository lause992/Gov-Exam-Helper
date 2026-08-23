# 公考小助手

一款面向公务员考试的学习工具，包含行测错题复盘、速算练习、每日时政、成语积累、AI 问答、统计分析等核心功能。

## 功能

- **错题复盘**：上传错题截图 → OCR 自动提取题干与选项 → 填写错误思路、规划几天后复盘 → 到期再做题 → 记录正确思路
- **申论练习**：申论材料阅读 + 手写作答 + AI 批改评分 + 机构答案对比
- **速算练习**：资料分析常见计算（增长率、基期量、倍数、比重、间隔增长率），误差≤5%算正确
- **每日时政**：公务员考试时政要闻，AI 筛选提炼 + 金句总结 + 收藏夹
- **成语积累**：AI 查词 + 收藏管理 + 自定义释义
- **AI 问答**：常识问答，支持图片识别，上下文记忆
- **统计分析**：薄弱度热力图 + 正确率趋势曲线 + 预测模拟分（线性回归）
- **夜间模式**：一键切换深色主题
- **截图识别**：拍照/相册选图后，浏览器端 Tesseract.js 离线 OCR
- **六大分类**：言语理解 / 政治理论 / 常识判断 / 判断推理 / 资料分析 / 数量关系（含17个子模块）
- **复盘计划**：保存时可选择 1/2/3/5/7/14/30 天或自定义天数后复盘；逾期自动标红
- **复盘做题**：到期后进入做题模式，重做原题 → 对照正确答案 → 回顾当时的错误思路 → 写下正确思路
- **错题本**：按分类/子分类筛选、关键词搜索、查看详情（含复盘历史记录），支持编辑/删除/收藏/推迟
- **草稿画板**：复盘时可随时涂鸦记录思路，支持撤销/橡皮/三色画笔
- **公式手写**：手写数学公式保存为图片，嵌入题目
- **数据备份**：一键导出/导入 JSON 备份
- **完全离线**：错题复盘和速算练习所有资源打包在 App 内，无需联网

## 版本历史

### v102 — 头像编辑器完善
- **修复**：头像拖拽边界限制（图片必须完全覆盖圆框，不露背景）
- **修复**：图片初始居中显示
- **修复**：头像保存后正确显示
- **优化**：最小缩放锁定为 fit 比例，缩放按钮改为倍率缩放

### v100 — 头像编辑器
- **新增**：头像编辑器（拖动调整位置、缩放调整大小、圆形裁剪预览）
- **新增**：个人中心页面（统计格子可点击跳转）
- **优化**：统计→个人中心改名，底部导航图标更换

### v88 — 本地账号系统
- **新增**：注册/登录/登出/切换用户
- **新增**：多用户数据隔离（题目/成语/AI/新闻/设置等独立存储）
- **新增**：游客模式

### v87 — 头像更换
- **新增**：个人中心可上传/更换头像（圆形裁剪）
- **新增**：Header 显示用户名首字母

### v86 — 新 App 图标
- **优化**：更换 App 图标（书本+铅笔+星星+对勾徽章）

### v85 — 按钮样式统一
- **优化**：移除成语积累按钮"已收藏"文字，学习工具五个按钮等宽

### v84 — 错题本筛选器排序
- **优化**：错题本筛选器顺序调整为"全部→只看未复盘→只看已复盘"

### v83 — 首页+统计页格子点击跳转
- **新增**：首页/统计页统计格子点击可跳转到对应内容（待复盘→错题本未复盘，已复盘→错题本已复盘，今日待复盘→今日到期，已积累词语→成语积累）
- **优化**：统计页分类进度条改为完成率（1/1 显示满格）

### v82 — 分类统计优化
- **优化**：分类统计只显示有题目的分类
- **优化**：深色模式下进度条底色加亮

### v81 — 模块分组重构
- **优化**：19 个 JS 模块按功能分组到 12 个子目录
- **修复**：app.js 加载顺序修复，首页恢复显示

### v80 — 正式版本
- **优化**：首页学习工具按钮样式统一（移除成语积累"已收藏"文字，按钮等宽）

### v66 — 修复首页空白
- **修复**：modules 重构后 app.js 加载顺序错误，首页只剩 navbar

### v65 — modules 按功能模块分组重构
- **优化**：将 19 个 JS 模块按功能分组到 12 个子目录（core/bank/practice/ai/news/idiom/calc/stats/crop/scratch/home/units）

### v64 — fab 浮动按钮阴影
- **优化**：首页右下角"+"浮动按钮添加 text-shadow 阴影

### v63 — 添加错题+号阴影
- **优化**：添加错题页"+"号添加蓝色阴影

### v62 — 标签/按钮间距统一优化
- **优化**：`.tag` 添加 margin，`.actions` 间距加大，`.formula-tools` 按钮不拥挤

### v61 — 详情页底部按钮间距
- **优化**：两行按钮之间添加 10px 间隔

### v60 — 公式工具栏间距
- **优化**：公式工具栏按钮间距加大

### v59 — 统计增强
- **新增**：知识点薄弱度热力图（按分类/子分类可视化错误率）
- **新增**：正确率趋势曲线（SVG 折线图，近30天）
- **新增**：预测模拟分（线性回归预测7天后分数）
- **新增**：点击热力图可跳转筛选错题本

### v58 — 夜间模式选项修复
- **修复**：移除选项 div 内联 `background:#fff`，夜间模式选项不再白底白字

### v57 — 夜间模式详情页适配
- **修复**：添加 `body.dark .opt` 规则，深色模式下选项背景/文字颜色正常

### v56 — 按钮文字颜色修复
- **修复**：`.tool-btn` 文字颜色恢复 `#fff`，浅色模式下不显示黑色

### v55 — 按钮样式优化
- **优化**：tool-btn 使用 CSS 变量 `--tool-btn-color`
- **优化**：所有按钮添加 `focus-visible` 状态
- **优化**：header-pen 尺寸 32px → 36px
- **优化**：`.btn.ok` 添加白色文字
- **优化**：ai-send-btn/ai-img-btn 添加 `touch-action: manipulation`

### v54 — 夜间模式 + 公式渲染 + 数量关系
- **新增**：夜间模式开关（header 月相图标切换，localStorage 持久化）
- **新增**：公式 LaTeX 自动转文本（`\frac{2}{7}` → `2/7`）
- **新增**：数量关系 17 个子模块（工程/最值/年龄/和差倍比/周期/数列/行程/几何/容斥原理/排列组合/概率/经济利润/统筹规划/星期日期/公倍数与公约数/分段计算/函数最值）

### v53 — AI 评分降级重试
- **修复**：申论 AI 评分失败时自动降级重试（完整 prompt → 精简 prompt → 记录无分数）

### v52 — AI 评分错误信息改进
- **优化**：catch 块显示实际错误原因

### v51 — 复盘记录写入 reviewHistory
- **修复**：finishPractice 写入 reviewHistory（选择题记录 correct/answer，申论记录 score/aiResult）

### v50 — 申论 AI 批改
- **新增**：finishPractice 对申论题异步调用 scoreShenlunAnswer

### v49 — 公式渲染 + 复盘回到详情页
- **修复**：finishPractice/closePractice 完成后恢复 detail overlay 而非 null
- **修复**：detail overlay 左右滑动切换上下题
- **修复**：openAdd 按钮调用 openForm(null)

### v48 — 内存优化 + innerHTML 比对
- **优化**：render() innerHTML 比对跳过无变化渲染
- **优化**：草稿面板无抖动（scratch layer HTML 始终存在）

### v47 — ink 撤销 + summary 撤回
- **新增**：ink.js 历史栈（40步 ImageData）+ undo()/canUndo()
- **新增**：summary.js 撤回按钮

### v46 — Overlay 分离
- **优化**：Overlay 分离到独立 `#overlay-root` 容器（position: fixed）
- **优化**：renderHeader/renderTabbar overlay 时 return 不清空 innerHTML
- **优化**：移除 overlay `.slidein` CSS 动画

### v45 — detail.js 编码修复
- **修复**：detail.js 编码损坏，从 update/ 备份恢复

### v44 — 复盘 checkbox + rounds
- **修复**：finishPractice 读取 checkbox DOM 状态 + q.rounds 递增

### v43 — NS.constants → NS.consts
- **修复**：detail.js、form.js、summary.js 中 NS.constants 改为 NS.consts

### v42 — swipeDetailId 保护当前题
- **修复**：`if (q.id === curId) return true`

### v41 — finishPractice 函数补回
- **修复**：finishPractice 函数补回并加入 NS.detail 导出

### v40 — 代码模块化拆分
- **优化**：app.js 拆分为 19 个独立模块文件

### v30 — 机构答案对比
- **新增**：AI 根据不同机构答题思路生成 2×2 并列卡片对比

### v25 — 申论对比
- **新增**：申论机构答案对比功能

### v21 — AI 分析多余 # 修复
- **修复**：mdRender 标题正则支持无空格 `##` 标题

### v20 — 复盘历史管理
- **新增**：复盘记录管理（删除/清空）
- **优化**：笔迹查看弹层去掉独立预览卡片

### v18 — 新闻收藏夹
- **新增**：新闻收藏夹（localStorage 持久化）
- **优化**：AI 总结在浮层内展示

### v15 — AI 上下文记忆
- **新增**：AI 携带最近 20 条历史对话

### v14 — AI 时政实时化
- **优化**：AI 系统提示注入今天真实日期
- **优化**：时政类问题自动抓取实时新闻列表

### v13 — 子分类细分
- **新增**：常识判断/言语理解/判断推理/政治理论/申论/数量关系 子分类

### v10 — 抖动优化
- **修复**：点击选项不再触发整页 render() 重绘
- **修复**：成语点击改为局部更新

### v7 — 首页重构
- **优化**：错题本/成语积累/时政/速算转移至首页，navbar 仅保留首页/AI/统计

### v2.0 — 速算 + 时政
- **新增**：速算练习（增长率/基期量/倍数/比重/间隔增长率）
- **新增**：每日时政

### v1.3 — 裁剪 + 选项图片
- **新增**：截图裁剪
- **新增**：选项支持图片

### v1.2 — OCR 修复
- **修复**：Tesseract 核心改用自包含 LSTM 版 wasm

### v1.1 — 相册 + 返回键
- **修复**：相册改用系统标准文件选择器
- **修复**：添加错题页可正常退出

### v1.0
- 首个版本

## 文件结构

```
xcapp/
├── app-release.apk              已构建好的安卓安装包
├── web/                         前端源码
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── core.js              工具函数 + 常量
│   │   ├── units.js             单位换算
│   │   ├── ink.js               手写画板引擎
│   │   └── modules/
│   │       ├── core/            核心框架（state/storage/shell/actions/app）
│   │       ├── bank/            错题本（detail/form/file-io）
│   │       ├── practice/        复盘练习（summary/shenlun-canvas/shenlun-compare）
│   │       ├── ai/              AI 问答
│   │       ├── news/            时政
│   │       ├── idiom/           成语
│   │       ├── calc/            速算
│   │       ├── stats/           统计
│   │       ├── crop/            图片裁剪
│   │       ├── scratch/         草稿画板
│   │       └── home/            首页
│   └── libs/                    Tesseract.js + wasm + 中文语言包
├── android/                     安卓工程（WebView 壳 + JS 桥）
├── docs/                        项目文档
│   ├── optimization-records.md  优化记录（30条）
│   ├── bug-records.md           Bug 记录（40条）
│   └── report.md                项目报告
└── update/                      热更新目录（GitHub Pages）
    ├── version.json             版本号 + 更新说明
    └── ...                      web/ 的镜像副本
```

## 安装到手机

1. 把 `app-release.apk` 传到手机（微信/QQ/网盘均可）
2. 点击安装；若提示"未知来源"，在系统设置中允许该来源安装应用
3. 打开即用，无需任何权限授权（拍照走系统相机，相册走系统选择器）

> 注意：数据保存在应用本地的浏览器存储中，**卸载应用会清空数据**，卸载前请先在「统计」页导出备份。

## 热更新

App 启动时自动检查 `update/version.json`，若版本号高于本地则下载替换 web 资源，无需重装 APK。

## 修改前端后重新构建

```powershell
# 1. 把 web/ 同步到安卓 assets
robocopy web android\app\src\main\assets /MIR

# 2. 构建 APK
cd android
.\gradlew.bat :app:assembleRelease --offline

# 3. 复制到项目根目录
Copy-Item android\app\build\outputs\apk\release\app-release.apk .

# 4. 推送热更新
robocopy web update /MIR /XD .git
# 手动恢复 update/version.json
cd update
git add -A
git commit -m "vXX: 更新说明"
git push
```

## 技术栈

- **前端**：原生 HTML/CSS/JS（无框架依赖），模块化架构
- **OCR**：Tesseract.js（中文 chi_sim 模型，离线识别）
- **AI**：智谱 GLM-4-Flash（成语查询/申论批改/新闻筛选/学习分析）
- **手写**：Canvas 2D + Pointer Events（ink.js 通用画板引擎）
- **图表**：SVG（趋势曲线）+ CSS Grid（热力图）
- **存储**：localStorage + IndexedDB（图片）
- **构建**：Android WebView + Gradle
- **热更新**：GitHub Pages + version.json 版本检测
