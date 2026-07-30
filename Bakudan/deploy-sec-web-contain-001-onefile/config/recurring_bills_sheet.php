<?php
/**
 * Recurring Bills Google Sheet Configuration
 * 
 * Sheet URL: https://docs.google.com/spreadsheets/d/1gtWwFKZACdwN1jbbJ5fbCzXp7aIsye6vWFWRkTHMCTw/edit
 * 
 * Sheet Structure:
 * Column A: Bill Name (e.g., "Insurance", "Fire", "Sale Tax")
 * Column B: Store (e.g., "B1", "B2", "Raw Stockton")
 * Column C: Vendor (e.g., "Amtrust", "-")
 * Column D: Amount (number, e.g., 500.00)
 * Column E: Frequency (monthly, quarterly, semi-annual, annual)
 * Column F: Category (e.g., "Insurance", "Fire", "Tax")
 * Column G: Start Date (e.g., "2024-01-15")
 * Column H: Notes
 */
define('RECURRING_SHEET_ID', '1gtWwFKZACdwN1jbbJ5fbCzXp7aIsye6vWFWRkTHMCTw');
define('RECURRING_SHEET_RANGE', 'Sheet1!A1:H100');
define('RECURRING_SHEET_CSV_URL', 'https://docs.google.com/spreadsheets/d/' . RECURRING_SHEET_ID . '/export?format=csv');
