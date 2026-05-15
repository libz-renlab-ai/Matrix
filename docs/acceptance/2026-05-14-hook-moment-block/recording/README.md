# 本次验收 GIF 的录制脚本

这两个脚本产出了 `../demo.gif` —— TeamAgent 拦截 `npm install moment` 的真实屏幕录像。
保留在这里是为了**可复现**:任何人都能照下面重跑一遍。

## 文件

- `demo-scene.ps1` —— 在被录的终端窗口里跑的「场景脚本」。它做两件事:
  1. **之前**:把 `USERPROFILE` 指向一个空知识库的临时 HOME,跑 `teamagent demo hook` → 放行;
  2. **之后**:把 `USERPROFILE` 指向一个已加载 universal pack 的临时 HOME,跑同样的命令 → 拦截。
  两段之间 `Clear-Host`,保证每屏内容完整可见。
- `record.ps1` —— 录制编排。启动场景窗口 → 用 `EnumWindows` 按精确标题 `TADEMOREC`
  找到窗口 → 贴到固定矩形并置顶 → `ffmpeg gdigrab` 按固定区域**真实录屏** → 产出 mp4 + 检查帧。
  录制前后都用 `PostMessage(WM_CLOSE)` 按窗口句柄精确关闭 `TADEMOREC` 窗口
  (**绝不** `Stop-Process` Windows Terminal 进程 —— 它同时托管着其它终端窗口)。

## 复现前置

- Windows + ffmpeg(在 PATH 上)。
- 两个临时 HOME:`home-empty`(空)与 `home-loaded`(其 `.teamagent/global.db`
  由 `teamagent init` 加载了 `packages/teamagent/seed/packs/universal.jsonl`)。
  脚本里这两个路径写死在 `$stage` 下,按需改。
- 预编译 CLI:`packages/teamagent/dist/bin.js`(`demo-scene.ps1` 直接 `node` 跑它,
  避免 tsx 现编译带来的不可预测延迟)。

## 跑

```powershell
# 这两个 .ps1 含中文,PowerShell 5.1 需要 UTF-8 BOM 才能正确读取
& record.ps1
```

`record.ps1` 产出 `out/demo.mp4` + `out/frame-*.png`。GIF 由 mp4 两遍调色板转出
(见 `record.ps1` 注释或验收报告的「怎么复现」一节)。

## 已知约束

- 录制窗口是一个新的 Windows Terminal 窗口(本机 WT 是默认终端)。WT 的 emoji / CJK
  渲染完整,这是选它的原因。
- 捕获区域比窗口略小、整体内移 8px —— 避开 Win11 窗口的隐形边框,免得框进背后的内容。
- 这是**人工产出的首个样板**。后续验证框架(套件1 + 套件2 生成器)会把这套流程脚本化、
  参数化;本目录的脚本是那个框架的参照原型。
