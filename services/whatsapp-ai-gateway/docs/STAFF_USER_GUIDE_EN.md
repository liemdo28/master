# Bakudan WhatsApp Daily Entry Guide

## 1. What this system does

This system helps staff submit daily temperature and operations readings in WhatsApp. The bot asks for each item from the current Daily Entry Template, checks the target range, shows warnings when needed, and saves the final confirmed log.

## 2. How to start

Open the store WhatsApp group and type:

```text
/ldagent
```

Choose Daily Entry Log when the bot asks what you want to do.

## 3. How to enter daily readings

The bot asks one item at a time. Reply with the number you measured. Use a clear number like `38`, `40.5`, or `-5`.

## 4. What to do if a number is outside range

If the value is outside the target range, the bot will ask you to confirm the real reading, re-enter the value, or skip the item if unavailable. Confirm only if the number is the actual measured value.

## 5. How to edit a mistake

Use:

```text
EDIT 1 40
```

This changes item 1 to 40. You can also follow the bot prompt if it asks you to re-enter a value.

## 6. How to cancel

Use:

```text
CANCEL
```

Cancel stops the current entry. Nothing is saved until you reply CONFIRM at the final summary.

## 7. How to submit

Review the final summary. If everything is correct, reply:

```text
CONFIRM
```

Only CONFIRM saves the log.

## 8. How to use printed form OCR

Print the Daily Entry Test Form. Fill every reading by hand. Take a clear photo of the full page with all four corner markers visible. Send the photo to the WhatsApp test group and wait for the bot summary. Reply CONFIRM if correct, or EDIT if needed.

## 9. What manager alerts mean

Manager alerts mean a reading may need attention, such as an out-of-range value, a missing entry, or a value that needs review. Follow store policy and manager instructions.

## 10. Supported languages

The bot supports English, Spanish, Vietnamese, and French for the main guided workflow.

## 11. Common commands

```text
/ldagent
/help
/status
/cancel
/language en
/language es
/language vi
/language fr
```

Common replies:

```text
CONFIRM
EDIT 1 40
CANCEL
STATUS
SKIP
```

## 12. Troubleshooting

- If the bot does not answer, check that the gateway is running.
- If you entered the wrong value, use EDIT before CONFIRM.
- If the item is unavailable, use SKIP or write N/A on the printed form.
- If a photo is blurry, retake it with better lighting.
- If the bot summary looks wrong, do not CONFIRM. Use EDIT or ask a manager.

## Quick Guide

How to use WhatsApp Daily Entry:

1. Open the store WhatsApp group.
2. Type:
/ldagent

3. Choose:
1 — Daily Entry Log

4. The bot will ask one item at a time.

Example:
Walk-in Cooler
Target: 30°F - 45°F
Reply with temperature:

5. Type the reading:
38

6. If the value is outside range, the bot will ask:

1 — Confirm actual reading
2 — Re-enter value
3 — Skip this item

7. At the end, review the summary.

8. Reply:
CONFIRM

Only CONFIRM saves the log.
