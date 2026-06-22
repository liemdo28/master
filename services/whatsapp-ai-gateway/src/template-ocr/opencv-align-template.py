import json
import sys

import cv2
import numpy as np


def marker_centers(template):
    markers = template.get("marker_positions") or {}
    ordered = ["top_left", "top_right", "bottom_left", "bottom_right"]
    pts = []
    for name in ordered:
        m = markers.get(name) or {}
        pts.append([float(m["x"]) + float(m["w"]) / 2, float(m["y"]) + float(m["h"]) / 2])
    return np.array(pts, dtype=np.float32)


def find_marker_candidates(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = gray.shape[:2]
    min_dim = min(w, h)
    candidates = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < max(80, min_dim * min_dim * 0.00005):
            continue
        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 8 or bh < 8:
            continue
        ratio = bw / float(bh)
        if ratio < 0.55 or ratio > 1.8:
            continue
        if bw > w * 0.18 or bh > h * 0.18:
            continue
        fill = area / float(bw * bh)
        if fill < 0.25:
            continue
        cx = x + bw / 2.0
        cy = y + bh / 2.0
        edge_score = min(cx, w - cx) + min(cy, h - cy)
        candidates.append((edge_score, area, cx, cy))

    candidates.sort(key=lambda c: (c[0], -c[1]))
    return np.array([[c[2], c[3]] for c in candidates[:24]], dtype=np.float32)


def pick_corners(points):
    if len(points) < 4:
        raise RuntimeError("Could not find four template markers")
    sums = points[:, 0] + points[:, 1]
    diffs = points[:, 0] - points[:, 1]
    tl = points[np.argmin(sums)]
    br = points[np.argmax(sums)]
    tr = points[np.argmax(diffs)]
    bl = points[np.argmin(diffs)]
    picked = np.array([tl, tr, bl, br], dtype=np.float32)
    if len({(round(x), round(y)) for x, y in picked}) < 4:
        raise RuntimeError("Template marker detection was ambiguous")
    return picked


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: opencv-align-template.py input-image output-image template-json")

    input_path, output_path, template_path = sys.argv[1:]
    with open(template_path, "r", encoding="utf-8") as f:
        template = json.load(f)

    page = template["page_size"]
    out_w = int(page["width"])
    out_h = int(page["height"])
    image = cv2.imread(input_path)
    if image is None:
        raise RuntimeError("Input image could not be read")

    src = pick_corners(find_marker_candidates(image))
    dst = marker_centers(template)
    matrix = cv2.getPerspectiveTransform(src, dst)
    aligned = cv2.warpPerspective(
        image,
        matrix,
        (out_w, out_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    if not cv2.imwrite(output_path, aligned):
        raise RuntimeError("Aligned image could not be written")

    print(json.dumps({"status": "ALIGNED_OPENCV", "markers": src.tolist()}))


if __name__ == "__main__":
    main()
