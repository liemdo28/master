"""
generate_sample_filled.py
Generates a sample filled Stone Oak form for testing.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_forms import (
    W, H, MARGIN_L, MARGIN_R, ROW_H,
    COL_FIELD_X, COL_FIELD_W,
    COL_ITEM_X, COL_ITEM_W,
    COL_RANGE_X, COL_RANGE_W,
    COL_AM_X, COL_AM_W,
    COL_PM_X, COL_PM_W,
    COL_NOTE_X, COL_NOTE_W,
    draw_header, draw_table, draw_footer, STORES
)

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Sample values for Stone Oak (some out-of-range to show corrective actions)
SAMPLE_VALUES = {
    "SO-01": ("38", "37", ""),
    "SO-02": ("-2", "-3", ""),
    "SO-03": ("39", "40", ""),
    "SO-04": ("41", "38", "SO-04 AM above 40F — moved items to walk-in"),
    "SO-05": ("37", "36", ""),
    "SO-06": ("0", "-1", ""),
    "SO-07": ("40", "39", ""),
    "SO-08": ("38", "40", ""),
    "SO-09": ("39", "38", ""),
    "SO-10": ("37", "37", ""),
    "SO-11": ("330", "328", ""),
    "SO-12": ("315", "325", "SO-12 AM below 325F — adjusted thermostat"),
    "SO-13": ("205", "210", ""),
    "SO-14": ("208", "206", ""),
    "SO-15": ("105", "102", ""),
    "SO-16": ("210", "212", ""),
    "SO-17": ("208", "205", ""),
    "SO-18": ("203", "201", ""),
}

def build_sample():
    store = STORES[0]  # Stone Oak
    out_path = os.path.join(OUTPUT_DIR, "FoodSafety-StoneOak-SAMPLE-FILLED.pdf")
    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle("FoodSafety-StoneOak-v2 — SAMPLE FILLED")

    # Draw blank form first
    table_y = draw_header(c, store)

    # --- Fill header fields ---
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#1A1AE6"))  # blue pen simulation
    # Date
    c.drawString(MARGIN_L + 0.15*72, H - 0.97*72, "06/09/2026")
    # Shift — mark PM
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_L + 1.83*72, H - 0.97*72, "X")   # marks [X] PM
    c.setFont("Helvetica", 10)
    # Employee name
    c.drawString(MARGIN_L + 3.17*72, H - 0.97*72, "Maria G.")
    # Manager review
    c.drawString(MARGIN_L + 0.10*72, H - 1.23*72, "Chef David")
    # Submission ID
    c.drawString(MARGIN_L + 3.17*72, H - 1.23*72, "SO-20260609-PM")
    c.setFillColor(colors.black)

    # Draw table
    items = store["items"]
    prefix = store["prefix"]

    # Header row height
    hdr_h = 0.27 * 72
    ry = table_y - hdr_h

    # Redraw table rows (call the standard draw, then overlay values)
    draw_table(c, store, table_y)

    # Overlay handwritten values in blue
    c.setFont("Helvetica", 10)
    for idx, (item_name, req_range) in enumerate(items):
        field_id = f"{prefix}-{idx+1:02d}"
        row_y = ry - ROW_H * (idx + 1)
        text_y = row_y + ROW_H * 0.28

        am_val, pm_val, note = SAMPLE_VALUES.get(field_id, ("", "", ""))

        # Determine if out of range for coloring
        try:
            am_f = float(am_val)
            if "below" in req_range:
                limit = float(req_range.split("°F")[0])
                am_ok = am_f <= limit
            else:
                limit = float(req_range.split("°F")[0])
                am_ok = am_f >= limit
        except Exception:
            am_ok = True

        # AM value
        c.setFillColor(colors.HexColor("#CC0000") if not am_ok else colors.HexColor("#1A1AE6"))
        c.drawCentredString(COL_AM_X + COL_AM_W / 2, text_y, am_val)

        # PM value
        try:
            pm_f = float(pm_val)
            if "below" in req_range:
                pm_ok = pm_f <= limit
            else:
                pm_ok = pm_f >= limit
        except Exception:
            pm_ok = True
        c.setFillColor(colors.HexColor("#CC0000") if not pm_ok else colors.HexColor("#1A1AE6"))
        c.drawCentredString(COL_PM_X + COL_PM_W / 2, text_y, pm_val)

        # Note
        if note:
            c.setFillColor(colors.HexColor("#CC0000"))
            c.setFont("Helvetica", 6.5)
            c.drawString(COL_NOTE_X + 3, text_y, note[:52])
            c.setFont("Helvetica", 10)

        c.setFillColor(colors.black)

    # SAMPLE watermark
    c.setFont("Helvetica-Bold", 40)
    c.setFillColor(colors.Color(0.5, 0.5, 0.5, alpha=0.15))
    c.saveState()
    c.translate(W / 2, H / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "SAMPLE FILLED")
    c.restoreState()
    c.setFillColor(colors.black)

    draw_footer(c, store, 0)
    c.save()
    print(f"  CREATED: FoodSafety-StoneOak-SAMPLE-FILLED.pdf")

if __name__ == "__main__":
    build_sample()
