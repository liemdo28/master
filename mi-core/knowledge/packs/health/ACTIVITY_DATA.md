# Health & Activity Data

## Huawei Health Export
- **Source:** Manual export from Huawei Health app
- **Format:** JSON export file uploaded to the system
- **Sync:** Via food-safety-gateway or manual import
- **Location:** D:/Project/Master/food-safety-gateway/ or imported via visibility

## Data Types Available
- **Steps:** Daily step count
- **Sleep:** Sleep duration and quality
- **Heart Rate:** Resting and active heart rate
- **Workouts:** Exercise sessions logged

## How to Import
1. Export data from Huawei Health app (JSON format)
2. Place in food-safety-gateway data folder
3. Trigger sync via visibility API: POST /api/visibility/sync/health-export

## Interpretation
- Steps < 5,000: Low activity
- Steps 5,000-10,000: Moderate
- Steps > 10,000: Active
- Sleep < 6h: Insufficient
- Sleep 6-8h: Normal
- Sleep > 8h: Extended

## Tags
health, activity, steps, sleep, heart rate, exercise, huawei
