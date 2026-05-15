# demo-scene.ps1 — TeamAgent 核心能力验收演示(在被录屏的终端窗口里跑)
# before/after 用同一条命令,唯一差别是知识库里有没有那条「学到的经验」。
# 两个场景之间 Clear-Host,保证每屏内容都完整可见。
$ErrorActionPreference = 'SilentlyContinue'

$ui = $Host.UI.RawUI
$ui.WindowTitle = 'TADEMOREC'
try {
  $ui.BufferSize = New-Object Management.Automation.Host.Size(100, 600)
  $ui.WindowSize = New-Object Management.Automation.Host.Size(100, 30)
} catch {}

$stage = 'C:\Users\tianhaoxuan\ta-demo-stage'
$env:NODE_NO_WARNINGS = '1'
Set-Location 'C:\bzli\Matrix'
function teamagent { & node 'C:\bzli\Matrix\packages\teamagent\dist\bin.js' @args }
function Type-Cmd($prompt, $cmd) {
  Write-Host -NoNewline $prompt -ForegroundColor DarkCyan
  foreach ($ch in $cmd.ToCharArray()) {
    Write-Host -NoNewline $ch -ForegroundColor White
    Start-Sleep -Milliseconds 36
  }
  Write-Host ''
  Start-Sleep -Milliseconds 500
}

# ── 开场 ──
Clear-Host
Write-Host ''
Write-Host '   =================================================================' -ForegroundColor Cyan
Write-Host '    TeamAgent  验收演示' -ForegroundColor Cyan
Write-Host '    核心能力:把 AI 重复犯的错,在执行前就拦下来' -ForegroundColor Cyan
Write-Host '   =================================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '    场景:AI 准备执行  ' -NoNewline -ForegroundColor Gray
Write-Host 'npm install moment' -NoNewline -ForegroundColor Yellow
Write-Host '   (moment 是已过时的库)' -ForegroundColor Gray
Write-Host ''
Start-Sleep -Seconds 5

# ── 场景一:之前(知识库为空)──
Write-Host '   -----------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host '    [ 之前 ]  知识库是空的 —— TeamAgent 还没学到这条经验' -ForegroundColor Yellow
Write-Host ''
$env:USERPROFILE = "$stage\home-empty"; $env:HOME = $env:USERPROFILE
Type-Cmd '    PS C:\my-project> ' 'teamagent demo hook Bash command="npm install moment"'
teamagent demo hook Bash command="npm install moment"
Write-Host ''
Write-Host '    >> 没有相关经验,放行。AI 就这样把过时的库装进了项目。' -ForegroundColor DarkYellow
Start-Sleep -Seconds 6

# ── 清屏,进入场景二 ──
Clear-Host
Write-Host ''
Write-Host '    同样的命令再来一次 —— 但这次,有人已经纠正过 TeamAgent 一回。' -ForegroundColor Gray
Write-Host ''

# ── 场景二:之后(规则已进知识库)──
Write-Host '   -----------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host '    [ 之后 ]  有人纠正过一次 —— TeamAgent 把它提炼成规则,存进了知识库' -ForegroundColor Green
Write-Host ''
$env:USERPROFILE = "$stage\home-loaded"; $env:HOME = $env:USERPROFILE
Type-Cmd '    PS C:\my-project> ' 'teamagent demo hook Bash command="npm install moment"'
teamagent demo hook Bash command="npm install moment"
Write-Host ''
Write-Host '    >> 同样的命令,这次被拦下了,并告诉 AI 应该改用 dayjs。错误没能发生。' -ForegroundColor Green
Write-Host ''
# 录制结束后由 record.ps1 精确结束并清理本窗口;这里长 hold 保证窗口不自行关闭。
Start-Sleep -Seconds 600
