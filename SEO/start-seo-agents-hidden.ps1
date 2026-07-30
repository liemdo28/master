$agents = @(
  @{ id = 'seo-local-maps-agent'; port = 4011; dir = 'D:\Project\Master\SEO\seo-local-maps-agent' },
  @{ id = 'seo-website-agent'; port = 4012; dir = 'D:\Project\Master\SEO\seo-website-agent' },
  @{ id = 'seo-technical-agent'; port = 4013; dir = 'D:\Project\Master\SEO\seo-technical-agent' },
  @{ id = 'seo-schema-agent'; port = 4014; dir = 'D:\Project\Master\SEO\seo-schema-agent' },
  @{ id = 'seo-content-agent'; port = 4015; dir = 'D:\Project\Master\SEO\seo-content-agent' },
  @{ id = 'seo-citation-agent'; port = 4016; dir = 'D:\Project\Master\SEO\seo-citation-agent' },
  @{ id = 'seo-analytics-agent'; port = 4017; dir = 'D:\Project\Master\SEO\seo-analytics-agent' },
  @{ id = 'seo-automation-orchestrator'; port = 4020; dir = 'D:\Project\Master\SEO\seo-automation-orchestrator' }
)

function Test-SeoHealth {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$Port/health"
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

foreach ($agent in $agents) {
  if (-not (Test-SeoHealth -Port $agent.port)) {
    Start-Process -FilePath 'node' -ArgumentList 'index.js' -WorkingDirectory $agent.dir -WindowStyle Hidden | Out-Null
    Start-Sleep -Milliseconds 300
  }
}
