param(
  [switch]$Json
)

$repos = @(
  @{ name = 'Open Agent Builder'; repo = 'firecrawl/open-agent-builder' },
  @{ name = 'OpenMontage'; repo = 'calesthio/OpenMontage' },
  @{ name = 'TTS Audio Suite'; repo = 'diodiogod/TTS-Audio-Suite' },
  @{ name = 'WebLLM'; repo = 'mlc-ai/web-llm' }
)

$results = foreach ($r in $repos) {
  $raw = gh repo view $r.repo --json nameWithOwner,description,licenseInfo,primaryLanguage,pushedAt,stargazerCount,forkCount,issues 2>$null
  if ($LASTEXITCODE -eq 0 -and $raw) {
    $data = $raw | ConvertFrom-Json
    [pscustomobject]@{
      project = $r.name
      repo = $data.nameWithOwner
      description = $data.description
      license = $data.licenseInfo.spdxId
      language = $data.primaryLanguage.name
      pushedAt = $data.pushedAt
      stars = $data.stargazerCount
      forks = $data.forkCount
      openIssues = $data.issues.totalCount
    }
  } else {
    [pscustomobject]@{ project = $r.name; repo = $r.repo; error = 'gh repo view failed' }
  }
}

if ($Json) { $results | ConvertTo-Json -Depth 5 } else { $results | Format-Table -AutoSize }
