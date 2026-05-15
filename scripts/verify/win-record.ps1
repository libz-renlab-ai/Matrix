# scripts/verify/win-record.ps1
#
# 参数化的 Win32 录制脚本 —— 启动 -SceneScript(在新的 Windows Terminal 窗口里),
# 用 EnumWindows 按精确 -WindowTitle 找到窗口句柄,贴到固定矩形并置顶,
# ffmpeg gdigrab 按固定捕获区真实录屏,产出 mp4 + 9 张检查帧。
#
# 窗口生命周期:录制前后都用 PostMessage(WM_CLOSE) 按句柄精确关闭目标窗口。
# 绝不 Stop-Process Windows Terminal 进程 —— 它同时托管着用户的其它终端窗口。
#
# 源自 docs/acceptance/2026-05-14-hook-moment-block/recording/record.ps1 (参照原型),
# 由 docs/plans/2026-05-14-verification-tooling.md Phase 1 Task 2 参数化。
param(
  [Parameter(Mandatory=$true)][string]$SceneScript,   # 在被录窗口里跑的 .ps1(需自行设置窗口标题为 $WindowTitle)
  [Parameter(Mandatory=$true)][string]$WindowTitle,   # 场景脚本设置的窗口标题,用于 EnumWindows 精确匹配
  [Parameter(Mandatory=$true)][string]$OutMp4,        # mp4 输出绝对路径(父目录会自动建)
  [int]$WinX = 0,      [int]$WinY = 0,      [int]$WinW = 1120, [int]$WinH = 760,
  [int]$CapX = 8,      [int]$CapY = 0,      [int]$CapW = 1104, [int]$CapH = 744,
  [int]$DurationSec = 40
)
$ErrorActionPreference = 'Stop'

# 父目录就绪
$outDir = Split-Path -Parent $OutMp4
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr hAfter, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  static List<IntPtr> AllByTitle(string title) {
    var found = new List<IntPtr>();
    EnumWindows((h,l)=>{
      if(!IsWindowVisible(h)) return true;
      var sb=new StringBuilder(300); GetWindowText(h,sb,300);
      if(sb.ToString()==title) found.Add(h);
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static IntPtr FindByTitle(string title) {
    var a = AllByTitle(title);
    return a.Count > 0 ? a[0] : IntPtr.Zero;
  }
  public static int CountByTitle(string title) { return AllByTitle(title).Count; }
  // 只对标题精确等于 title 的窗口发 WM_CLOSE(0x10);WT 会关掉那一个窗口,不动其它窗口。
  public static int CloseAllByTitle(string title) {
    var a = AllByTitle(title);
    foreach (var h in a) PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero);
    return a.Count;
  }
}
"@

# 0. 清掉之前留下的僵尸窗口
$closed = [Win]::CloseAllByTitle($WindowTitle)
if ($closed -gt 0) { Write-Output "pre-clean: 关闭了 $closed 个残留 $WindowTitle 窗口"; Start-Sleep -Seconds 2 }

# 1. 启动被录的场景窗口(会开一个新的 Windows Terminal 窗口)
$p = Start-Process powershell -ArgumentList '-NoProfile','-File',$SceneScript -PassThru
Write-Output "scene PID = $($p.Id)"

# 2. 按精确标题轮询找窗口,最多 12 秒
$h = [IntPtr]::Zero
$found_i = 0
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 200
  $h = [Win]::FindByTitle($WindowTitle)
  if ($h -ne [IntPtr]::Zero) { $found_i = $i; break }
}
if ($h -eq [IntPtr]::Zero) {
  [Win]::CloseAllByTitle($WindowTitle) | Out-Null
  throw "找不到 $WindowTitle 窗口(12s 内未出现)"
}
$cnt = [Win]::CountByTitle($WindowTitle)
Write-Output "window handle = $h (found after ~$([math]::Round($found_i*0.2,1))s, $WindowTitle 窗口总数 = $cnt)"
if ($cnt -ne 1) {
  [Win]::CloseAllByTitle($WindowTitle) | Out-Null
  throw "$WindowTitle 窗口数异常($cnt),已全部关闭,请重跑"
}

# 3. 贴到固定矩形 + 置顶 + 前台 (HWND_TOPMOST=-1, SWP_SHOWWINDOW=0x40, SW_SHOW=5)
[Win]::ShowWindow($h, 5) | Out-Null
[Win]::SetWindowPos($h, [IntPtr](-1), $WinX, $WinY, $WinW, $WinH, 0x40) | Out-Null
[Win]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 700

# 4. ffmpeg 按固定区域真实录屏(场景窗口长 hold,录够时长即可)
& ffmpeg -hide_banner -loglevel warning -stats `
  -f gdigrab -framerate 12 -offset_x $CapX -offset_y $CapY -video_size "${CapW}x${CapH}" -i desktop `
  -t $DurationSec -pix_fmt yuv420p -y $OutMp4
$ff_exit = $LASTEXITCODE
Write-Output "ffmpeg(record) exit = $ff_exit"

# 5. 关掉场景窗口(按句柄精确 WM_CLOSE,不碰 WT 进程)
Start-Sleep -Seconds 1
$closed2 = [Win]::CloseAllByTitle($WindowTitle)
Write-Output "post-clean: 关闭了 $closed2 个 $WindowTitle 窗口"

if ($ff_exit -ne 0 -or -not (Test-Path $OutMp4)) {
  throw "录制失败(ffmpeg exit=$ff_exit, mp4 exists=$(Test-Path $OutMp4))"
}

# 6. 抽 9 张均匀分布的检查帧(供人工确定裁剪窗口或截取 still)
$frameDir = $outDir
$stride = [math]::Max(1, [math]::Floor($DurationSec / 10))
$times = @()
for ($t = $stride; $t -lt $DurationSec; $t += $stride) {
  if ($times.Count -ge 9) { break }
  $times += $t
}
foreach ($t in $times) {
  & ffmpeg -hide_banner -loglevel error -ss $t -i $OutMp4 -frames:v 1 -update 1 -y (Join-Path $frameDir "frame-$t.png") | Out-Null
}

Write-Output "=== record done ==="
Get-Item $OutMp4 | Select-Object Name,Length
