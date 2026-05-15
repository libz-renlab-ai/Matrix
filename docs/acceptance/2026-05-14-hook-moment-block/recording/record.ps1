# record.ps1 — 启动 demo-scene.ps1(在新的 Windows Terminal 窗口里),
# 用 EnumWindows 按精确标题 TADEMOREC 找到窗口句柄,贴到屏幕左上角并置顶,
# ffmpeg gdigrab 按固定区域真实录屏。只录 demo 窗口那块,不录整桌面。
#
# 窗口生命周期:录制前后都用 PostMessage(WM_CLOSE) 按句柄精确关闭 TADEMOREC 窗口。
# 绝不 Stop-Process WT 进程 —— 它同时托管着用户的其它终端窗口。
$ErrorActionPreference = 'Stop'
$stage = 'C:\Users\tianhaoxuan\ta-demo-stage'
$out   = "$stage\out"
New-Item -ItemType Directory -Force $out | Out-Null

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

# 屏幕 1536x864,可用高 816 —— 窗口 760 高,留出任务栏
$winX = 0; $winY = 0; $winW = 1120; $winH = 760
# 捕获区域整体内移 8px(跳过窗口左侧隐形边框)
$capX = 8; $capY = 0; $capW = 1096; $capH = 730

# 0. 清掉之前留下的僵尸 TADEMOREC 窗口
$closed = [Win]::CloseAllByTitle('TADEMOREC')
if ($closed -gt 0) { Write-Output "pre-clean: 关闭了 $closed 个残留 TADEMOREC 窗口"; Start-Sleep -Seconds 2 }

# 1. 启动被录的场景窗口(会开一个新的 Windows Terminal 窗口)
$p = Start-Process powershell -ArgumentList '-NoProfile','-File',"$stage\demo-scene.ps1" -PassThru
Write-Output "scene PID = $($p.Id)"

# 2. 按精确标题 TADEMOREC 轮询找窗口,最多 12 秒
$h = [IntPtr]::Zero
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 200
  $h = [Win]::FindByTitle('TADEMOREC')
  if ($h -ne [IntPtr]::Zero) { break }
}
if ($h -eq [IntPtr]::Zero) { [Win]::CloseAllByTitle('TADEMOREC') | Out-Null; throw "找不到 TADEMOREC 窗口" }
$cnt = [Win]::CountByTitle('TADEMOREC')
Write-Output "window handle = $h (found after ~$([math]::Round($i*0.2,1))s, TADEMOREC 窗口总数 = $cnt)"
if ($cnt -ne 1) { [Win]::CloseAllByTitle('TADEMOREC') | Out-Null; throw "TADEMOREC 窗口数异常($cnt),已全部关闭,请重跑" }

# 3. 贴到固定矩形 + 置顶 + 前台 (HWND_TOPMOST=-1, SWP_SHOWWINDOW=0x40, SW_SHOW=5)
[Win]::ShowWindow($h, 5) | Out-Null
[Win]::SetWindowPos($h, [IntPtr](-1), $winX, $winY, $winW, $winH, 0x40) | Out-Null
[Win]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 700

# 4. ffmpeg 按固定区域真实录屏(场景窗口长 hold,录够时长即可)
$mp4 = "$out\demo.mp4"
& ffmpeg -hide_banner -loglevel warning -stats `
  -f gdigrab -framerate 12 -offset_x $capX -offset_y $capY -video_size "${capW}x${capH}" -i desktop `
  -t 40 -pix_fmt yuv420p -y $mp4
Write-Output "ffmpeg(record) exit = $LASTEXITCODE"

# 5. 关掉场景窗口(按句柄精确 WM_CLOSE,不碰 WT 进程)
Start-Sleep -Seconds 1
$closed2 = [Win]::CloseAllByTitle('TADEMOREC')
Write-Output "post-clean: 关闭了 $closed2 个 TADEMOREC 窗口"

# 6. 抽密集的检查帧,供人工确定裁剪窗口
foreach ($t in 4,8,12,16,20,24,28,32,36) {
  & ffmpeg -hide_banner -loglevel error -ss $t -i $mp4 -frames:v 1 -update 1 -y "$out\frame-$t.png"
}

Write-Output "=== record done ==="
Get-Item $mp4 | Select-Object Name,Length
