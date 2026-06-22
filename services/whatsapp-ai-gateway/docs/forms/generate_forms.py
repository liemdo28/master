"""
generate_forms.py
Generates 3 standardized food safety line-check PDF forms.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

W, H = letter  # 612 x 792 pts

# ── Store configs ──────────────────────────────────────────────────────────────
STORES = [
    {
        "name": "Stone Oak",
        "form_id": "FoodSafety-StoneOak-v2",
        "store_id": "stone_oak",
        "prefix": "SO",
        "filename": "FoodSafety-StoneOak-LineCheck-v2.pdf",
        "confirmed": True,
        "items": [
            ("Walk-In Cooler",      "40°F or below"),
            ("Walk-In Freezer",     "0°F or below"),
            ("Prep Area Refrig",    "40°F or below"),
            ("Ramen Refrig Below",  "40°F or below"),
            ("Ramen Refrig Top",    "40°F or below"),
            ("Freezer Line",        "0°F or below"),
            ("Tapas Refrig Below",  "40°F or below"),
            ("Tapas Refrig Top",    "40°F or below"),
            ("Pork Chashu Top",     "40°F or below"),
            ("Chicken Chashu Top",  "40°F or below"),
            ("Fryer 1",             "325°F minimum"),
            ("Fryer 2",             "325°F minimum"),
            ("Pasta Boiler 1",      "200°F minimum"),
            ("Pasta Boiler 2",      "200°F minimum"),
            ("Seasoned Eggs Warm",  "100°F minimum"),
            ("Pork Broth",          "200°F minimum"),
            ("Chicken Broth",       "200°F minimum"),
            ("Veggie Broth",        "200°F minimum"),
        ],
    },
    {
        "name": "Rim",
        "form_id": "FoodSafety-Rim-v2",
        "store_id": "rim",
        "prefix": "RIM",
        "filename": "FoodSafety-Rim-LineCheck-v2.pdf",
        "confirmed": False,
        "items": [
            ("Walk-In Cooler",      "40°F or below"),
            ("Walk-In Freezer",     "0°F or below"),
            ("Prep Area Refrig",    "40°F or below"),
            ("Ramen Refrig Below",  "40°F or below"),
            ("Ramen Refrig Top",    "40°F or below"),
            ("Freezer Line",        "0°F or below"),
            ("Tapas Refrig Below",  "40°F or below"),
            ("Tapas Refrig Top",    "40°F or below"),
            ("Pork Chashu Top",     "40°F or below"),
            ("Chicken Chashu Top",  "40°F or below"),
            ("Fryer 1",             "325°F minimum"),
            ("Fryer 2",             "325°F minimum"),
            ("Pasta Boiler 1",      "200°F minimum"),
            ("Pasta Boiler 2",      "200°F minimum"),
            ("Seasoned Eggs Warm",  "100°F minimum"),
            ("Pork Broth",          "200°F minimum"),
            ("Chicken Broth",       "200°F minimum"),
            ("Veggie Broth",        "200°F minimum"),
        ],
    },
    {
        "name": "Bandera",
        "form_id": "FoodSafety-Bandera-v2",
        "store_id": "bandera",
        "prefix": "BAN",
        "filename": "FoodSafety-Bandera-LineCheck-v2.pdf",
        "confirmed": False,
        "items": [
            ("Walk-In Cooler",      "40°F or below"),
            ("Walk-In Freezer",     "0°F or below"),
            ("Prep Area Refrig",    "40°F or below"),
            ("Ramen Refrig Below",  "40°F or below"),
            ("Ramen Refrig Top",    "40°F or below"),
            ("Freezer Line",        "0°F or below"),
            ("Tapas Refrig Below",  "40°F or below"),
            ("Tapas Refrig Top",    "40°F or below"),
            ("Pork Chashu Top",     "40°F or below"),
            ("Chicken Chashu Top",  "40°F or below"),
            ("Fryer 1",             "325°F minimum"),
            ("Fryer 2",             "325°F minimum"),
            ("Pasta Boiler 1",      "200°F minimum"),
            ("Pasta Boiler 2",      "200°F minimum"),
            ("Seasoned Eggs Warm",  "100°F minimum"),
            ("Pork Broth",          "200°F minimum"),
            ("Chicken Broth",       "200°F minimum"),
            ("Veggie Broth",        "200°F minimum"),
        ],
    },
]

# ── Column layout (x positions, widths) ───────────────────────────────────────
MARGIN_L = 0.45 * inch
MARGIN_R = W - 0.45 * inch

COL_FIELD_X  = MARGIN_L
COL_FIELD_W  = 0.75 * inch
COL_ITEM_X   = COL_FIELD_X + COL_FIELD_W
COL_ITEM_W   = 1.70 * inch
COL_RANGE_X  = COL_ITEM_X + COL_ITEM_W
COL_RANGE_W  = 1.20 * inch
COL_AM_X     = COL_RANGE_X + COL_RANGE_W
COL_AM_W     = 0.85 * inch
COL_PM_X     = COL_AM_X + COL_AM_W
COL_PM_W     = 0.85 * inch
COL_NOTE_X   = COL_PM_X + COL_PM_W
COL_NOTE_W   = MARGIN_R - COL_NOTE_X

ROW_H = 0.365 * inch   # handwriting row height

def draw_header(c, store):
    y = H - 0.35 * inch

    # ── Title bar ─────────────────────────────────────────────────────────────
    c.setFillColor(colors.black)
    c.rect(MARGIN_L, y - 0.38 * inch, MARGIN_R - MARGIN_L, 0.38 * inch, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(MARGIN_L + 0.10 * inch, y - 0.27 * inch,
                 "FOOD SAFETY LINE CHECK")

    c.setFont("Helvetica", 9)
    c.drawRightString(MARGIN_R - 0.10 * inch, y - 0.27 * inch,
                      store["form_id"] + " | v2.0")

    y -= 0.38 * inch

    # ── Store / confirmation notice ───────────────────────────────────────────
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_L, y - 0.22 * inch, f"Store: {store['name']}")

    if not store["confirmed"]:
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawRightString(MARGIN_R, y - 0.22 * inch,
                          "* Items PENDING STORE CONFIRMATION")
        c.setFillColor(colors.black)

    y -= 0.28 * inch

    # ── Header fields (two rows) ──────────────────────────────────────────────
    field_h = 0.245 * inch
    field_gap = 0.06 * inch
    c.setFont("Helvetica", 8)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.8)

    # Row 1: Date | Shift | Employee Name
    row1_y = y
    # Date box
    bx = MARGIN_L
    bw = 1.55 * inch
    c.rect(bx, row1_y - field_h, bw, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx + 3, row1_y - 9, "DATE")
    # Shift box
    bx2 = bx + bw + field_gap
    bw2 = 1.20 * inch
    c.rect(bx2, row1_y - field_h, bw2, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx2 + 3, row1_y - 9, "SHIFT")
    c.setFont("Helvetica", 8)
    c.drawString(bx2 + 0.27 * inch, row1_y - field_h + 0.05 * inch, "[ ] AM    [ ] PM")
    # Employee Name box
    bx3 = bx2 + bw2 + field_gap
    bw3 = MARGIN_R - bx3
    c.rect(bx3, row1_y - field_h, bw3, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx3 + 3, row1_y - 9, "EMPLOYEE NAME")

    # Row 2: Manager Review | Submission ID
    row2_y = row1_y - field_h - field_gap
    bx4 = MARGIN_L
    bw4 = 2.80 * inch
    c.rect(bx4, row2_y - field_h, bw4, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx4 + 3, row2_y - 9, "MANAGER REVIEW / SIGNATURE")

    bx5 = bx4 + bw4 + field_gap
    bw5 = MARGIN_R - bx5
    c.rect(bx5, row2_y - field_h, bw5, field_h)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(bx5 + 3, row2_y - 9, "SUBMISSION ID (optional)")

    return row2_y - field_h - 0.14 * inch   # return y for table start


def draw_table(c, store, table_top_y):
    items = store["items"]
    prefix = store["prefix"]

    # ── Column header row ─────────────────────────────────────────────────────
    hdr_h = 0.27 * inch
    hy = table_top_y
    c.setFillColor(colors.black)
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.0)

    # Header background
    c.rect(MARGIN_L, hy - hdr_h, MARGIN_R - MARGIN_L, hdr_h, fill=1, stroke=1)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7.5)
    labels = [
        (COL_FIELD_X,  COL_FIELD_W,  "FIELD ID"),
        (COL_ITEM_X,   COL_ITEM_W,   "TEMPERATURE ITEM"),
        (COL_RANGE_X,  COL_RANGE_W,  "REQUIRED RANGE"),
        (COL_AM_X,     COL_AM_W,     "11:00 AM"),
        (COL_PM_X,     COL_PM_W,     "4:00 PM"),
        (COL_NOTE_X,   COL_NOTE_W,   "CORRECTIVE ACTION / NOTES"),
    ]
    for lx, lw, label in labels:
        c.drawCentredString(lx + lw / 2, hy - hdr_h + 0.08 * inch, label)

    c.setFillColor(colors.black)
    c.setLineWidth(0.8)

    # ── Data rows ─────────────────────────────────────────────────────────────
    ry = hy - hdr_h
    for idx, (item_name, req_range) in enumerate(items):
        field_id = f"{prefix}-{idx+1:02d}"
        row_y = ry - ROW_H

        # Alternating row shading
        if idx % 2 == 0:
            c.setFillColor(colors.HexColor("#F4F4F4"))
            c.rect(MARGIN_L, row_y, MARGIN_R - MARGIN_L, ROW_H, fill=1, stroke=0)
        c.setFillColor(colors.black)

        # Outer border
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.5)
        c.rect(MARGIN_L, row_y, MARGIN_R - MARGIN_L, ROW_H, fill=0, stroke=1)

        # Vertical dividers
        for vx in [COL_ITEM_X, COL_RANGE_X, COL_AM_X, COL_PM_X, COL_NOTE_X]:
            c.line(vx, row_y, vx, row_y + ROW_H)

        # Text
        text_y = row_y + ROW_H * 0.32

        # Field ID — bold, centred
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(COL_FIELD_X + COL_FIELD_W / 2, text_y, field_id)

        # Item name
        c.setFont("Helvetica", 8.5)
        c.drawString(COL_ITEM_X + 4, text_y, item_name)

        # Required range — centred, slight grey
        c.setFillColor(colors.HexColor("#222222"))
        c.setFont("Helvetica", 8)
        c.drawCentredString(COL_RANGE_X + COL_RANGE_W / 2, text_y, req_range)
        c.setFillColor(colors.black)

        if not store["confirmed"]:
            c.setFillColor(colors.HexColor("#888888"))
            c.setFont("Helvetica-Oblique", 6.5)
            c.drawString(COL_ITEM_X + 4, row_y + 3, "* PENDING STORE CONFIRMATION")
            c.setFillColor(colors.black)

        ry = row_y

    # ── Thick outer border around full table ─────────────────────────────────
    c.setLineWidth(1.5)
    c.rect(MARGIN_L, ry, MARGIN_R - MARGIN_L, table_top_y - ry, fill=0, stroke=1)

    return ry  # return bottom of table


def draw_footer(c, store, table_bottom_y):
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.HexColor("#555555"))
    footer_text = (
        f"{store['form_id']}  |  Bakudan Ramen Group  |  "
        "Print fresh each shift — do not reuse  |  "
        "Photo and upload to WhatsApp after completion"
    )
    c.drawCentredString(W / 2, 0.28 * inch, footer_text)

    # Thin top line for footer area
    c.setStrokeColor(colors.HexColor("#AAAAAA"))
    c.setLineWidth(0.5)
    c.line(MARGIN_L, 0.42 * inch, MARGIN_R, 0.42 * inch)
    c.setFillColor(colors.black)


def build_form(store):
    out_path = os.path.join(OUTPUT_DIR, store["filename"])
    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle(store["form_id"])
    c.setAuthor("Bakudan Ramen Group")
    c.setSubject("Food Safety Line Check")

    table_y = draw_header(c, store)
    draw_table(c, store, table_y)
    draw_footer(c, store, 0)

    c.save()
    print(f"  CREATED: {store['filename']}")
    return out_path


if __name__ == "__main__":
    print("Generating food safety line-check forms...")
    for store in STORES:
        build_form(store)
    print("Done.")
