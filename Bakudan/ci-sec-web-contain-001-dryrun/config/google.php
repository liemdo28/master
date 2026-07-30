<?php
return [
  'client_id' => 'PASTE_CLIENT_ID',
  'client_secret' => 'PASTE_CLIENT_SECRET',
  'redirect_uri' => APP_URL . '/google/callback',
  'scopes' => [
    'https://www.googleapis.com/auth/calendar',
  ],
  'calendar_id' => 'primary'
];