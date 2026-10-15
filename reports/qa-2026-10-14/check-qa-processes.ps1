$taskProcessList = Get-CimInstance Win32_Process
$taskPids = @($taskProcessList.ProcessId)
$taskOrphans = $taskProcessList | Where-Object {
    $_.Name -eq 'msedge.exe' -and $_.CommandLine -match '--headless' -and
    $_.CommandLine -match '--user-data-dir=.*playwright_chromiumdev_profile' -and
    $_.CommandLine -notmatch '--type=' -and $_.ParentProcessId -notin $taskPids
}
foreach ($taskBrowser in $taskOrphans) {
    Stop-Process -Id $taskBrowser.ProcessId
    Write-Output "Stopped orphaned temporary QA browser $($taskBrowser.ProcessId)."
}
