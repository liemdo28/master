/**
 * DoorDash account registry — 4 brand accounts
 */
module.exports = [
  {
    id: 'bakudan-1',
    brand: 'Bakudan Ramen',
    label: 'B1',
    email: process.env.DD_B1_EMAIL || '',
    password: process.env.DD_B1_PASS || '',
  },
  {
    id: 'bakudan-2',
    brand: 'Bakudan Ramen',
    label: 'B2',
    email: process.env.DD_B2_EMAIL || '',
    password: process.env.DD_B2_PASS || '',
  },
  {
    id: 'bakudan-3',
    brand: 'Bakudan Ramen',
    label: 'B3',
    email: process.env.DD_B3_EMAIL || '',
    password: process.env.DD_B3_PASS || '',
  },
  {
    id: 'raw-sushi',
    brand: 'Raw Sushi Bar',
    label: 'Raw',
    email: process.env.DD_RAW_EMAIL || '',
    password: process.env.DD_RAW_PASS || '',
  },
];
