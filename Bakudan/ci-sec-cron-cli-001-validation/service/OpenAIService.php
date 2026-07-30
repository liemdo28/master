<?php

class OpenAIService
{
    public function extractTasksFromDocument($filePath, $originalName, $mimeType, array $context = [])
    {
        $sections = array_values(array_filter(array_map(function ($section) {
            return trim((string) ($section['name'] ?? ''));
        }, $context['sections'] ?? [])));

        $members = array_values(array_filter(array_map(function ($member) {
            $name = trim((string) ($member['name'] ?? ''));
            if ($name === '') {
                return null;
            }

            return [
                'name' => $name,
                'email' => trim((string) ($member['email'] ?? '')),
            ];
        }, $context['members'] ?? [])));

        return $this->extractJsonFromDocument(
            $filePath,
            $originalName,
            $mimeType,
            $this->buildTaskPrompt($originalName, $mimeType, $context, $sections, $members),
            'You extract actionable work items from user-provided documents. Return strict JSON only. Do not wrap JSON in markdown.'
        );
    }

    public function extractBillFromDocument($filePath, $originalName, $mimeType, array $context = [])
    {
        $storeName = trim((string) ($context['store']['name'] ?? ''));
        $vendors = array_values(array_filter(array_map(function ($vendor) {
            return trim((string) ($vendor['name'] ?? ''));
        }, $context['vendors'] ?? [])));

        $vendorList = $vendors ? implode(', ', $vendors) : 'No vendors available';
        $today = date('Y-m-d');

        $prompt = <<<PROMPT
Analyze the attached bill / invoice / receipt document and extract bill tracking data.

Today: {$today}
Selected store: {$storeName}
Source filename: {$originalName}
Source mime type: {$mimeType}
Known vendors: {$vendorList}

Rules:
1. Return a single bill object for the main bill in the document.
2. Use YYYY-MM-DD for due_date when possible, otherwise null.
3. amount must be numeric only, no currency symbols. If unsure return null.
4. status must be one of: pending, paid, overdue.
5. If vendor is not certain, return null.
6. Use a short meaningful title.
7. Return valid JSON only.

Return exactly this shape:
{
  "summary": "short summary",
  "warnings": ["warning 1"],
  "bill": {
    "title": "string",
    "vendor_name": "string or null",
    "amount": 0,
    "due_date": "YYYY-MM-DD or null",
    "status": "pending|paid|overdue",
    "note": "string",
    "color": "hex color or null",
    "confidence": 0.0,
    "source_excerpt": "short supporting excerpt"
  }
}
PROMPT;

        return $this->extractJsonFromDocument(
            $filePath,
            $originalName,
            $mimeType,
            $prompt,
            'You extract bill tracking data from user-provided documents. Return strict JSON only. Do not wrap JSON in markdown.'
        );
    }

    private function extractJsonFromDocument($filePath, $originalName, $mimeType, $prompt, $instructions)
    {
        if (!openai_is_configured()) {
            throw new RuntimeException('OPENAI_API_KEY is not configured.');
        }

        if (!is_file($filePath)) {
            throw new RuntimeException('Uploaded file not found.');
        }

        $uploadedFile = $this->uploadInputFile($filePath, $originalName, $mimeType);

        $payload = [
            'model' => openai_task_model(),
            'instructions' => $instructions,
            'input' => [
                [
                    'role' => 'user',
                    'content' => $this->buildContent($prompt, $uploadedFile),
                ],
            ],
            'max_output_tokens' => 3000,
        ];

        $response = $this->requestJson(openai_base_url() . '/responses', $payload);
        $outputText = $this->extractOutputText($response);
        if ($outputText === '') {
            throw new RuntimeException('OpenAI returned an empty response.');
        }

        $decoded = json_decode($outputText, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('OpenAI returned invalid JSON.');
        }

        return $decoded;
    }

    private function buildContent($prompt, array $uploadedFile)
    {
        $content = [
            [
                'type' => 'input_text',
                'text' => $prompt,
            ],
        ];

        if (($uploadedFile['content_type'] ?? '') === 'input_file') {
            $content[] = [
                'type' => 'input_file',
                'file_id' => $uploadedFile['file_id'],
            ];
        } else {
            $content[] = [
                'type' => 'input_image',
                'file_id' => $uploadedFile['file_id'],
                'detail' => 'high',
            ];
        }

        return $content;
    }

    private function uploadInputFile($filePath, $originalName, $mimeType)
    {
        $purpose = $this->isPdf($mimeType, $originalName) ? 'user_data' : 'vision';
        $response = $this->requestMultipart(
            openai_base_url() . '/files',
            [
                'purpose' => $purpose,
                'file' => [
                    'path' => $filePath,
                    'name' => $originalName,
                    'type' => $mimeType ?: 'application/octet-stream',
                ],
            ]
        );

        $fileId = trim((string) ($response['id'] ?? ''));
        if ($fileId === '') {
            throw new RuntimeException('OpenAI file upload failed.');
        }

        return [
            'file_id' => $fileId,
            'content_type' => $this->isPdf($mimeType, $originalName) ? 'input_file' : 'input_image',
        ];
    }

    private function buildTaskPrompt($originalName, $mimeType, array $context, array $sections, array $members)
    {
        $projectName = trim((string) ($context['project']['name'] ?? ''));
        $projectDescription = trim((string) ($context['project']['description'] ?? ''));
        $today = date('Y-m-d');

        $sectionList = $sections ? implode(', ', $sections) : 'No sections available';
        $memberList = $members
            ? implode(', ', array_map(function ($member) {
                return $member['email'] !== '' ? $member['name'] . ' <' . $member['email'] . '>' : $member['name'];
            }, $members))
            : 'No project members available';

        return <<<PROMPT
Analyze the attached file and extract actionable tasks for a project management system.

Today: {$today}
Project: {$projectName}
Project description: {$projectDescription}
Source filename: {$originalName}
Source mime type: {$mimeType}
Available sections: {$sectionList}
Available project members: {$memberList}

Rules:
1. Extract only concrete tasks someone can do.
2. Split combined requests into separate tasks where reasonable.
3. Keep titles short and specific.
4. Use only these priority values: low, medium, high, urgent.
5. Use only these status values: todo, in_progress, review, done.
6. If assignee or section is not clearly supported by the file, return null for that field.
7. If a due date is unclear, return null. If a date is relative, resolve it against today and output YYYY-MM-DD.
8. Never invent names, deadlines, or assignments.
9. Return valid JSON only.

Return exactly this shape:
{
  "summary": "short summary",
  "warnings": ["warning 1"],
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "assignee_name": "string or null",
      "section_name": "string or null",
      "priority": "low|medium|high|urgent",
      "status": "todo|in_progress|review|done",
      "due_date": "YYYY-MM-DD or null",
      "start_date": "YYYY-MM-DD or null",
      "confidence": 0.0,
      "source_excerpt": "short supporting excerpt"
    }
  ]
}
PROMPT;
    }

    private function requestJson($url, array $payload)
    {
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . openai_api_key(),
        ];

        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($body === false) {
            throw new RuntimeException('Failed to encode OpenAI request.');
        }

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 120,
            ]);
            $responseBody = curl_exec($ch);
            $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($responseBody === false) {
                throw new RuntimeException('OpenAI request failed: ' . ($curlError ?: 'Unknown cURL error'));
            }
        } else {
            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => implode("\r\n", $headers),
                    'content' => $body,
                    'timeout' => 120,
                    'ignore_errors' => true,
                ],
            ]);
            $responseBody = @file_get_contents($url, false, $context);
            $statusCode = 0;
            $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
            if (!empty($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $matches)) {
                $statusCode = (int) $matches[1];
            }

            if ($responseBody === false) {
                throw new RuntimeException('OpenAI request failed.');
            }
        }

        $decoded = json_decode($responseBody, true);
        if ($statusCode >= 400) {
            $message = $decoded['error']['message'] ?? ('OpenAI API error (' . $statusCode . ')');
            throw new RuntimeException($message);
        }

        if (!is_array($decoded)) {
            throw new RuntimeException('Failed to decode OpenAI response.');
        }

        return $decoded;
    }

    private function requestMultipart($url, array $fields)
    {
        $authorizationHeader = 'Authorization: Bearer ' . openai_api_key();

        if (function_exists('curl_init')) {
            $postFields = [];
            foreach ($fields as $name => $value) {
                if ($name === 'file' && is_array($value)) {
                    $postFields[$name] = new CURLFile($value['path'], $value['type'], $value['name']);
                    continue;
                }
                $postFields[$name] = $value;
            }

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [$authorizationHeader],
                CURLOPT_POSTFIELDS => $postFields,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 120,
            ]);
            $responseBody = curl_exec($ch);
            $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($responseBody === false) {
                throw new RuntimeException('OpenAI file upload failed: ' . ($curlError ?: 'Unknown cURL error'));
            }
        } else {
            $boundary = '----OpenAIBoundary' . bin2hex(random_bytes(8));
            $eol = "\r\n";
            $body = '';

            foreach ($fields as $name => $value) {
                $body .= '--' . $boundary . $eol;

                if ($name === 'file' && is_array($value)) {
                    $binary = file_get_contents($value['path']);
                    if ($binary === false) {
                        throw new RuntimeException('Failed to read uploaded file.');
                    }

                    $body .= 'Content-Disposition: form-data; name="file"; filename="' . addslashes($value['name']) . '"' . $eol;
                    $body .= 'Content-Type: ' . ($value['type'] ?: 'application/octet-stream') . $eol . $eol;
                    $body .= $binary . $eol;
                    continue;
                }

                $body .= 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol;
                $body .= $value . $eol;
            }

            $body .= '--' . $boundary . '--' . $eol;

            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => $authorizationHeader . "\r\n" . 'Content-Type: multipart/form-data; boundary=' . $boundary,
                    'content' => $body,
                    'timeout' => 120,
                    'ignore_errors' => true,
                ],
            ]);
            $responseBody = @file_get_contents($url, false, $context);
            $statusCode = 0;
            $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
            if (!empty($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $matches)) {
                $statusCode = (int) $matches[1];
            }

            if ($responseBody === false) {
                throw new RuntimeException('OpenAI file upload failed.');
            }
        }

        $decoded = json_decode($responseBody, true);
        if ($statusCode >= 400) {
            $message = $decoded['error']['message'] ?? ('OpenAI API error (' . $statusCode . ')');
            throw new RuntimeException($message);
        }

        if (!is_array($decoded)) {
            throw new RuntimeException('Failed to decode OpenAI upload response.');
        }

        return $decoded;
    }

    private function extractOutputText(array $response)
    {
        if (!empty($response['output_text']) && is_string($response['output_text'])) {
            return trim($response['output_text']);
        }

        foreach ($response['output'] ?? [] as $item) {
            foreach ($item['content'] ?? [] as $content) {
                if (($content['type'] ?? '') === 'output_text' && !empty($content['text'])) {
                    return trim((string) $content['text']);
                }
            }
        }

        return '';
    }

    private function isPdf($mimeType, $originalName)
    {
        return stripos((string) $mimeType, 'pdf') !== false
            || strtolower(pathinfo((string) $originalName, PATHINFO_EXTENSION)) === 'pdf';
    }
}
