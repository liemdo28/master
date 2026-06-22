"""
generate_v3_rim.py
Generates FoodSafety-Rim-v3 print form.

v3 improvements over v2:
  - Larger write boxes (AM / PM cells: taller for legibility)
  - QR code anchor box bottom-right for camera alignment
  - "PENDING PILOT APPROVAL" notice in header (grey)
  - Submission ID box enlarged and labelled "SCAN / ENTER"
  - Version bumped to v3.0
  - Bowl Warmer / Pork/Chicken Chashu target ranges corrected
  - Time headers updated: 11AM -> 11:00 AM CHECK, 4PM -> 4:00 PM CHECK
  - Notes column renamed: CORRECTIVE ACTION / NOTES
  - Footer updated with v3 instructions
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
FORM_ID    = "FoodSafety-Rim-v3"
VERSION    = "v3.0"
STORE_NAME = "Rim"
PREFIX     = "RIM"
OUT_FILE   = "FoodSafety-Rim-LineCheck-v3.pdf"

W, H = letter   # 612 x 792 pts

MARGIN_L = 0.42 * inch
MARGIN_R = W - 0.42 * inch

COL_FIELD_X  = MARGIN_L
COL_FIELD_W  = 0.72 * inch
COL_ITEM_X   = COL_FIELD_X + COL_FIELD_W
COL_ITEM_W   = 1.78 * inch
COL_RANGE_X  = COL_ITEM_X + COL_ITEM_W
COL_RANGE_W  = 1.18 * inch
COL_AM_X     = COL_RANGE_X + COL_RANGE_W
COL_AM_W     = 0.90 * inch
COL_PM_X     = COL_AM_X + COL_AM_W
COL_PM_W     = 0.90 * inch
COL_NOTE_X   = COL_PM_X + COL_PM_W
COL_NOTE_W   = MARGIN_R - COL_NOTE_X

ROW_H        = 0.385 * inch   # taller rows -- easier handwriting

ITEMS = [
    # (field_label, required_range, bold_required)
    ("Walk-In Cooler",      "<= 40F",       True),
    ("Walk-In Freezer",     "<= 0F",        True),
    ("Prep Area Cooler",    "<= 40F",       False),
    ("Ramen Refrig Bottom", "<= 40F",       False),
    ("Ramen Refrig Top",    "<= 40F",       False),
    ("Line Freezer",        "<= 0F",        True),
    ("Tapas Refrig Bottom", "<= 40F",       False),
    ("Tapas Refrig Top",    "<= 40F",       False),
    ("Pork Chashu",         "<= 40F",       True),
    ("Chicken Chashu",      "<= 40F",       True),
    ("Fryer 1",             ">= 325F",      True),
    ("Fryer 2",             ">= 325F",      True),
    ("Pasta Boiler 1",      ">= 200F",      False),
    ("Pasta Boiler 2",      ">= 200F",      False),
    ("Seasoned Eggs",       ">= 100F",      False),
    ("Bowl Warmers",        ">= 100F",      True),
    ("Pork Broth",          ">= 200F",      True),
    ("Chicken Broth",       ">= 200F",      True),
    ("Veggie Broth",        ">= 200F",      False),
]


def draw_header(c):
    y = H - 0.32 * inch

    # Title bar
    c.setFillColor(colors.black)
    c.rect(MARGIN_L, y - 0.38 * inch, MARGIN_R - MARGIN_L, 0.38 * inch, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13.5)
    c.drawString(MARGIN_L + 0.10 * inch, y - 0.265 * inch, "FOOD SAFETY LINE CHECK")

    # PENDING PILOT APPROVAL notice (grey, not red badge)
    badge_x = MARGIN_L + 2.80 * inch
    c.setFillColor(colors.HexColor("#888888"))
    c.roundRect(badge_x, y - 0.32 * inch, 1.65 * inch, 0.26 * inch, 3, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(badge_x + 0.825 * inch, y - 0.175 * inch, "PENDING PILOT APPROVAL")

    c.setFillColor(colors.white)
    c.setFont("Helvetica", 8.5)
    c.drawRightString(MARGIN_R - 0.08 * inch, y - 0.265 * inch, f"{FORM_ID}  |  {VERSION}")

    y -= 0.38 * inch

    # Store name line
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_L, y - 0.22 * inch, f"Store: {STORE_NAME}")

    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#555555"))
    c.drawRightString(MARGIN_R, y - 0.22 * inch,
                      "* Required fields -- must not be blank")
    c.setFillColor(colors.black)

    y -= 0.28 * inch

    # Header fields
    field_h   = 0.255 * inch
    field_gap = 0.055 * inch
    c.setFont("Helvetica", 8)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.8)

    # Row 1: Date | Shift | Employee Name
    row1_y = y
    bx = MARGIN_L
    bw = 1.52 * inch
    c.rect(bx, row1_y - field_h, bw, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx + 3, row1_y - 10, "DATE  (MM / DD / YYYY)")

    bx2 = bx + bw + field_gap
    bw2 = 1.18 * inch
    c.rect(bx2, row1_y - field_h, bw2, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx2 + 3, row1_y - 10, "SHIFT")
    c.setFont("Helvetica", 8.5)
    c.drawString(bx2 + 0.22 * inch, row1_y - field_h + 0.06 * inch, "[ ] AM    [ ] PM")

    bx3 = bx2 + bw2 + field_gap
    bw3 = MARGIN_R - bx3
    c.rect(bx3, row1_y - field_h, bw3, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx3 + 3, row1_y - 10, "EMPLOYEE NAME")

    # Row 2: Manager signature | Submission ID (larger)
    row2_y = row1_y - field_h - field_gap
    bx4 = MARGIN_L
    bw4 = 2.80 * inch
    c.rect(bx4, row2_y - field_h, bw4, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx4 + 3, row2_y - 10, "MANAGER REVIEW / SIGNATURE")

    bx5 = bx4 + bw4 + field_gap
    bw5 = MARGIN_R - bx5
    c.rect(bx5, row2_y - field_h, bw5, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx5 + 3, row2_y - 10, "SUBMISSION ID")
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.HexColor("#777777"))
    c.drawString(bx5 + 3, row2_y - field_h + 3, "(auto-filled by system)")
    c.setFillColor(colors.black)

    return row2_y - field_h - 0.13 * inch


def draw_table(c, table_top_y):
    hdr_h = 0.28 * inch
    hy = table_top_y
    c.setFillColor(colors.black)
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.0)

    c.rect(MARGIN_L, hy - hdr_h, MARGIN_R - MARGIN_L, hdr_h, fill=1, stroke=1)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7.5)
    hdr_labels = [
        (COL_FIELD_X,  COL_FIELD_W,  "FIELD ID"),
        (COL_ITEM_X,   COL_ITEM_W,   "TEMPERATURE ITEM"),
        (COL_RANGE_X,  COL_RANGE_W,  "REQUIRED RANGE"),
        (COL_AM_X,     COL_AM_W,     "11:00 AM CHECK"),
        (COL_PM_X,     COL_PM_W,     "4:00 PM CHECK"),
        (COL_NOTE_X,   COL_NOTE_W,   "CORRECTIVE ACTION / NOTES"),
    ]
    for lx, lw, label in hdr_labels:
        c.drawCentredString(lx + lw / 2, hy - hdr_h + 0.085 * inch, label)

    c.setFillColor(colors.black)
    c.setLineWidth(0.5)

    ry = hy - hdr_h
    for idx, (item_name, req_range, required) in enumerate(ITEMS):
        field_id = f"{PREFIX}-{idx+1:02d}"
        row_y    = ry - ROW_H

        # Alternating shade
        if idx % 2 == 0:
            c.setFillColor(colors.HexColor("#F5F5F5"))
            c.rect(MARGIN_L, row_y, MARGIN_R - MARGIN_L, ROW_H, fill=1, stroke=0)
        c.setFillColor(colors.black)

        # Row border
        c.setStrokeColor(colors.HexColor("#BBBBBB"))
        c.setLineWidth(0.4)
        c.rect(MARGIN_L, row_y, MARGIN_R - MARGIN_L, ROW_H, fill=0, stroke=1)

        # Vertical dividers
        c.setStrokeColor(colors.HexColor("#999999"))
        for vx in [COL_ITEM_X, COL_RANGE_X, COL_AM_X, COL_PM_X, COL_NOTE_X]:
            c.line(vx, row_y, vx, row_y + ROW_H)

        text_y = row_y + ROW_H * 0.35

        # Field ID
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(COL_FIELD_X + COL_FIELD_W / 2, text_y, field_id)

        # Required star
        if required:
            c.setFillColor(colors.HexColor("#CC0000"))
            c.setFont("Helvetica-Bold", 9)
            c.drawString(COL_ITEM_X + 3, text_y + 1, "*")
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(COL_ITEM_X + 12, text_y, item_name)
        else:
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 8.5)
            c.drawString(COL_ITEM_X + 4, text_y, item_name)

        # Range -- colour-coded
        if "<=" in req_range:
            c.setFillColor(colors.HexColor("#003399"))   # cold = blue
        else:
            c.setFillColor(colors.HexColor("#990000"))   # hot = red
        c.setFont("Helvetica-Bold", 8.5)
        c.drawCentredString(COL_RANGE_X + COL_RANGE_W / 2, text_y, req_range)
        c.setFillColor(colors.black)

        # Write-in tick line in AM / PM cells
        c.setStrokeColor(colors.HexColor("#CCCCCC"))
        c.setLineWidth(0.3)
        mid_am = COL_AM_X + COL_AM_W / 2
        mid_pm = COL_PM_X + COL_PM_W / 2
        c.line(mid_am - 0.25 * inch, row_y + 0.10 * inch, mid_am + 0.25 * inch, row_y + 0.10 * inch)
        c.line(mid_pm - 0.25 * inch, row_y + 0.10 * inch, mid_pm + 0.25 * inch, row_y + 0.10 * inch)

        ry = row_y

    # Outer thick border
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.5)
    c.rect(MARGIN_L, ry, MARGIN_R - MARGIN_L, table_top_y - ry, fill=0, stroke=1)
    return ry


def draw_footer(c, table_bottom_y):
    # QR / alignment target box -- bottom right corner (for phone camera framing)
    box_sz = 0.52 * inch
    box_x  = MARGIN_R - box_sz
    box_y  = 0.18 * inch
    c.setStrokeColor(colors.black)
    c.setLineWidth(2.0)
    c.rect(box_x, box_y, box_sz, box_sz, fill=0, stroke=1)
    # Inner alignment cross
    cx = box_x + box_sz / 2
    cy = box_y + box_sz / 2
    c.setLineWidth(0.5)
    c.line(cx - 0.10 * inch, cy, cx + 0.10 * inch, cy)
    c.line(cx, cy - 0.10 * inch, cx, cy + 0.10 * inch)
    c.setFont("Helvetica", 5.5)
    c.setFillColor(colors.HexColor("#888888"))
    c.drawCentredString(cx, box_y - 0.07 * inch, "ALIGN CORNER")
    c.setFillColor(colors.black)

    # Footer text
    c.setFont("Helvetica", 6.5)
    c.setFillColor(colors.HexColor("#555555"))
    line1 = (f"{FORM_ID}  |  Bakudan Ramen Group  |  Rim Store  |  "
             "* = Required field -- leave no blanks")
    line2 = ("Fill form completely -> take photo of ENTIRE page -> send to Kitchen Log WhatsApp group  |  "
             "Print a fresh form each shift -- do not reuse")
    c.drawCentredString(W / 2, 0.33 * inch, line1)
    c.drawCentredString(W / 2, 0.20 * inch, line2)

    # Thin separator
    c.setStrokeColor(colors.HexColor("#BBBBBB"))
    c.setLineWidth(0.5)
    c.line(MARGIN_L, 0.46 * inch, MARGIN_R - 0.65 * inch, 0.46 * inch)
    c.setFillColor(colors.black)


def build():
    out_path = os.path.join(OUTPUT_DIR, OUT_FILE)
    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle(FORM_ID)
    c.setAuthor("Bakudan Ramen Group")
    c.setSubject("Food Safety Line Check -- Rim v3")
    c.setCreator("Bakudan Auto-Generator")

    table_y = draw_header(c)
    table_bottom = draw_table(c, table_y)
    draw_footer(c, table_bottom)

    c.save()
    print(f"CREATED: {out_path}")
    return out_path


if __name__ == "__main__":
    build()
