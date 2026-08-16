import re
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)

# ─── Colours ───────────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#1e3a5f")
BLUE      = colors.HexColor("#2563eb")
LIGHT_BG  = colors.HexColor("#f0f4ff")
ROW_ALT   = colors.HexColor("#f8fafc")
BORDER    = colors.HexColor("#e2e8f0")
GREY_TXT  = colors.HexColor("#6b7280")
DARK_TXT  = colors.HexColor("#1f2937")
DEL_COLOR = colors.HexColor("#9ca3af")
WHITE     = colors.white

PAGE_W, PAGE_H = A4
LEFT_M = RIGHT_M = 18 * mm
TOP_M  = 20 * mm
BOT_M  = 22 * mm

# ─── Footer ────────────────────────────────────────────────────────────────
def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GREY_TXT)
    canvas.drawString(LEFT_M, 12 * mm,
        "LodgeCore Hospitality Technology  |  www.getlodgecore.com  |  Confidential")
    pg = f"Page {doc.page}"
    canvas.drawRightString(PAGE_W - RIGHT_M, 12 * mm, pg)
    canvas.restoreState()

# ─── Styles ────────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()

    styles = {
        "h1": ParagraphStyle("h1",
            fontName="Helvetica-Bold", fontSize=22, leading=28,
            textColor=NAVY, spaceAfter=8, spaceBefore=0),

        "h2": ParagraphStyle("h2",
            fontName="Helvetica-Bold", fontSize=12, leading=16,
            textColor=NAVY, spaceBefore=16, spaceAfter=6,
            backColor=LIGHT_BG, leftIndent=-4, rightIndent=-4,
            borderPadding=(5, 8, 5, 10),
            borderColor=BLUE, borderWidth=0, borderLeftPadding=6),

        "h3": ParagraphStyle("h3",
            fontName="Helvetica-Bold", fontSize=10.5, leading=14,
            textColor=NAVY, spaceBefore=10, spaceAfter=4),

        "body": ParagraphStyle("body",
            fontName="Helvetica", fontSize=9.5, leading=15,
            textColor=DARK_TXT, spaceAfter=4),

        "italic": ParagraphStyle("italic",
            fontName="Helvetica-Oblique", fontSize=9, leading=13,
            textColor=GREY_TXT, spaceAfter=6),

        "blockquote": ParagraphStyle("blockquote",
            fontName="Helvetica-Oblique", fontSize=9.5, leading=14,
            textColor=NAVY, leftIndent=14, rightIndent=0,
            spaceAfter=8, spaceBefore=8,
            backColor=colors.HexColor("#eff6ff"),
            borderPadding=(6, 10, 6, 10)),

        "bullet": ParagraphStyle("bullet",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=DARK_TXT, spaceAfter=3, leftIndent=14,
            bulletIndent=4),

        "footer_txt": ParagraphStyle("footer_txt",
            fontName="Helvetica-Oblique", fontSize=8,
            textColor=GREY_TXT, spaceAfter=0, spaceBefore=8),

        "toc": ParagraphStyle("toc",
            fontName="Helvetica", fontSize=9.5, leading=16,
            textColor=DARK_TXT, leftIndent=8),

        "subtitle": ParagraphStyle("subtitle",
            fontName="Helvetica", fontSize=9, leading=13,
            textColor=GREY_TXT, spaceAfter=4, spaceBefore=2),
    }
    return styles

# ─── Inline markup helpers ─────────────────────────────────────────────────
def clean_inline(text, styles):
    """Convert **bold**, *italic*, ~~del~~ to ReportLab XML."""
    # strikethrough ~~text~~
    text = re.sub(r'~~(.*?)~~',
        lambda m: f'<font color="#9ca3af"><strike>{m.group(1)}</strike></font>', text)
    # bold **text**
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # italic *text* (not already inside tags)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
    # inline code `text`
    text = re.sub(r'`(.+?)`',
        r'<font face="Courier" size="8" color="#374151">\1</font>', text)
    # escape bare & that aren't already entities
    # (ReportLab XML needs & as &amp;)
    text = re.sub(r'&(?!amp;|lt;|gt;|nbsp;)', '&amp;', text)
    return text

# ─── Table renderer ────────────────────────────────────────────────────────
def build_table(rows):
    """rows: list of lists of strings (first row = header)."""
    BODY_FONT_SIZE = 8.5
    HDR_FONT_SIZE  = 8.5

    col_count = max(len(r) for r in rows)
    usable_w  = PAGE_W - LEFT_M - RIGHT_M

    # Estimate column widths: first col wider
    if col_count == 2:
        col_widths = [usable_w * 0.30, usable_w * 0.70]
    elif col_count == 4:
        col_widths = [usable_w * 0.28, usable_w * 0.24, usable_w * 0.24, usable_w * 0.24]
    else:
        first = usable_w * 0.26
        rest  = (usable_w - first) / max(col_count - 1, 1)
        col_widths = [first] + [rest] * (col_count - 1)

    hdr_style = ParagraphStyle("th", fontName="Helvetica-Bold",
        fontSize=HDR_FONT_SIZE, textColor=WHITE, leading=12)
    cell_style = ParagraphStyle("td", fontName="Helvetica",
        fontSize=BODY_FONT_SIZE, textColor=DARK_TXT, leading=12)
    first_cell_style = ParagraphStyle("td1", fontName="Helvetica-Bold",
        fontSize=BODY_FONT_SIZE, textColor=NAVY, leading=12)

    data = []
    for i, row in enumerate(rows):
        # pad short rows
        while len(row) < col_count:
            row.append("")
        if i == 0:
            cells = [Paragraph(clean_inline(c, None), hdr_style) for c in row]
        else:
            cells = []
            for j, c in enumerate(row):
                st = first_cell_style if j == 0 else cell_style
                cells.append(Paragraph(clean_inline(c, None), st))
        data.append(cells)

    tbl = Table(data, colWidths=col_widths, repeatRows=1)

    tbl_style = TableStyle([
        # Header
        ("BACKGROUND",  (0, 0), (-1,  0), NAVY),
        ("TEXTCOLOR",   (0, 0), (-1,  0), WHITE),
        ("FONTNAME",    (0, 0), (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1,  0), HDR_FONT_SIZE),
        ("TOPPADDING",  (0, 0), (-1,  0), 6),
        ("BOTTOMPADDING",(0,0), (-1,  0), 6),
        ("LEFTPADDING", (0, 0), (-1,  0), 8),
        ("RIGHTPADDING",(0, 0), (-1,  0), 8),
        # Body rows
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",    (0, 1), (-1, -1), BODY_FONT_SIZE),
        ("TOPPADDING",  (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING",(0,1), (-1, -1), 5),
        ("LEFTPADDING", (0, 1), (-1, -1), 8),
        ("RIGHTPADDING",(0, 1), (-1, -1), 8),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW",   (0, 0), (-1, -1), 0.3, BORDER),
        # Alternating row colours
        *[("BACKGROUND", (0, r), (-1, r), ROW_ALT)
          for r in range(2, len(data), 2)],
    ])
    tbl.setStyle(tbl_style)
    return tbl

# ─── Markdown parser ───────────────────────────────────────────────────────
def md_to_story(md_text, styles):
    story  = []
    lines  = md_text.splitlines()
    i      = 0
    in_tbl = False
    tbl_rows = []

    def flush_table():
        nonlocal tbl_rows
        if tbl_rows:
            story.append(Spacer(1, 4))
            story.append(build_table(tbl_rows))
            story.append(Spacer(1, 6))
        tbl_rows = []

    while i < len(lines):
        line = lines[i]

        # ── TABLE ──
        if line.strip().startswith("|"):
            # skip separator rows like |---|---|
            if re.match(r'^\s*\|[\s\-|:]+\|\s*$', line):
                i += 1
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            tbl_rows.append(cells)
            i += 1
            continue
        else:
            if tbl_rows:
                flush_table()

        stripped = line.strip()

        # ── BLANK LINE ──
        if not stripped:
            story.append(Spacer(1, 4))
            i += 1
            continue

        # ── HR ──
        if re.match(r'^---+$', stripped):
            story.append(Spacer(1, 3))
            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=BORDER, spaceAfter=3))
            i += 1
            continue

        # ── H1 ──
        if stripped.startswith("# ") and not stripped.startswith("## "):
            text = clean_inline(stripped[2:], styles)
            story.append(Paragraph(text, styles["h1"]))
            story.append(HRFlowable(width="100%", thickness=2,
                                    color=BLUE, spaceAfter=6))
            i += 1
            continue

        # ── H2 ──
        if stripped.startswith("## "):
            text = clean_inline(stripped[3:], styles)
            p = Paragraph(f'<para backColor="#f0f4ff" leftIndent="8" borderPadding="5">'
                          f'{text}</para>', styles["h2"])
            story.append(p)
            i += 1
            continue

        # ── H3 ──
        if stripped.startswith("### "):
            text = clean_inline(stripped[4:], styles)
            story.append(Paragraph(text, styles["h3"]))
            i += 1
            continue

        # ── BLOCKQUOTE ──
        if stripped.startswith("> "):
            text = clean_inline(stripped[2:], styles)
            story.append(Paragraph(text, styles["blockquote"]))
            i += 1
            continue

        # ── BULLET ──
        if stripped.startswith("* ") or stripped.startswith("- "):
            text = clean_inline(stripped[2:], styles)
            story.append(Paragraph(f"\u2022  {text}", styles["bullet"]))
            i += 1
            continue

        # ── ITALIC ONLY line (module subtitles) ──
        if stripped.startswith("*") and stripped.endswith("*") and not stripped.startswith("**"):
            text = clean_inline(stripped[1:-1], styles)
            story.append(Paragraph(text, styles["italic"]))
            i += 1
            continue

        # ── PLAIN PARAGRAPH ──
        text = clean_inline(stripped, styles)
        story.append(Paragraph(text, styles["body"]))
        i += 1

    if tbl_rows:
        flush_table()

    return story

# ─── Main ──────────────────────────────────────────────────────────────────
def generate(md_path, pdf_path):
    with open(md_path, encoding="utf-8") as f:
        md_text = f.read()

    styles = make_styles()
    story  = md_to_story(md_text, styles)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=LEFT_M, rightMargin=RIGHT_M,
        topMargin=TOP_M,   bottomMargin=BOT_M,
        title="LodgeCore Document",
        author="LodgeCore Hospitality Technology",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"✅  {pdf_path}")

if __name__ == "__main__":
    files = [
        ("LodgeCore_Feature_Catalog.md",        "LodgeCore_Feature_Catalog.pdf"),
        ("LodgeCore_Pricing_Proposal.md",        "LodgeCore_Pricing_Proposal.pdf"),
        ("LodgeCore_Full_Functionality_Guide.md","LodgeCore_Full_Functionality_Guide.pdf"),
        ("LodgeCore_Development_Status_&_Roadmap.md","LodgeCore_Development_Status_&_Roadmap.pdf"),
    ]
    for md, pdf in files:
        generate(md, pdf)
