"""Build the user setup guide from docs/SETUP.md; render with PyMuPDF for QA."""
from pathlib import Path
import re
import argparse
from html import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
import fitz

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", default="WEBSITE-PRODUCTS-SETUP.pdf")
output_name = parser.parse_args().output
if Path(output_name).name != output_name or not output_name.lower().endswith(".pdf"):
    raise ValueError("Output must be a PDF filename in the workspace root.")
OUT = ROOT / output_name
QA = ROOT / "tmp" / "pdfs"
QA.mkdir(parents=True, exist_ok=True)
FONTS = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Guide", str(FONTS / "segoeui.ttf")))
pdfmetrics.registerFont(TTFont("GuideBold", str(FONTS / "segoeuib.ttf")))
pdfmetrics.registerFont(TTFont("GuideMono", str(FONTS / "consola.ttf")))
pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold", italic="Guide", boldItalic="GuideBold")
INK = colors.HexColor("#24392f")
MUTED = colors.HexColor("#728478")
GREEN = colors.HexColor("#34715a")
LINE = colors.HexColor("#dfe7e0")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyGuide", fontName="Guide", fontSize=9.4, leading=14.2, textColor=INK, spaceAfter=7, splitLongWords=True))
styles.add(ParagraphStyle(name="H2Guide", fontName="GuideBold", fontSize=18, leading=23, textColor=INK, spaceBefore=19, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="H3Guide", fontName="GuideBold", fontSize=12, leading=17, textColor=GREEN, spaceBefore=14, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="CodeGuide", fontName="GuideMono", fontSize=7.7, leading=11.3, textColor=colors.HexColor("#405c4b"), backColor=colors.HexColor("#f3f6f3"), borderColor=LINE, borderWidth=.5, borderPadding=10, spaceBefore=5, spaceAfter=11))
styles.add(ParagraphStyle(name="TableGuide", fontName="Guide", fontSize=8, leading=11.5, textColor=INK))
styles.add(ParagraphStyle(name="CoverTitle", fontName="GuideBold", fontSize=36, leading=44, textColor=INK, spaceAfter=17))
styles.add(ParagraphStyle(name="CoverSub", fontName="Guide", fontSize=13, leading=20, textColor=MUTED, spaceAfter=20))
styles.add(ParagraphStyle(name="LabelGuide", fontName="GuideBold", fontSize=8, leading=13, textColor=GREEN, spaceAfter=10, tracking=1))
styles.add(ParagraphStyle(name="CoverList", fontName="Guide", fontSize=10, leading=17, textColor=MUTED, spaceAfter=5))

def rich(text):
    text = escape(text)
    text = re.sub(r"`([^`]+)`", r'<font name="GuideMono" size="8.4">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.states = []
    def showPage(self):
        self.states.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        total = len(self.states)
        for state in self.states:
            self.__dict__.update(state)
            header(self, None)
            self.saveState()
            width, height = A4
            self.setStrokeColor(LINE)
            self.line(45, 40, width - 45, 40)
            self.setFont("Guide", 7.5)
            self.setFillColor(MUTED)
            self.drawString(45, 25, "WEBSITE PRODUCTS  /  Setup & operations  /  29 October 2026")
            self.drawRightString(width - 45, 25, f"{self._pageNumber} / {total}")
            self.restoreState()
            super().showPage()
        super().save()

def header(c, doc):
    c.saveState()
    c.setFillColor(GREEN)
    c.setFont("GuideBold", 8)
    c.drawString(45, A4[1] - 32, "workspace.")
    c.setFillColor(MUTED)
    c.setFont("Guide", 7.5)
    c.drawRightString(A4[0] - 45, A4[1] - 32, "YOUR BUSINESS WORKSPACE")
    c.restoreState()

story = [Spacer(1, 38), Paragraph("OWNER SETUP GUIDE", styles["LabelGuide"]),
         Paragraph("Website Products<br/>Setup & operations", styles["CoverTitle"]),
         Paragraph("Start locally. Add your accounts when you are ready.<br/>A practical guide for your first client and the websites that follow.", styles["CoverSub"])]
story += [Paragraph("START HERE", styles["LabelGuide"]),
          Paragraph("Open a terminal in your main <b>website-products</b> folder and run:", styles["BodyGuide"]),
          Preformatted("npm --prefix admin install\nnpm run dev", styles["CodeGuide"]),
          Paragraph('<b>Open:</b> <link href="http://127.0.0.1:3001" color="#34715a">http://127.0.0.1:3001</link>', styles["BodyGuide"]),
          Paragraph("You can add clients, websites, individual maintenance prices, communications and follow-up tasks before connecting external services. Defaults are USD and Europe/Skopje for your North Macedonia business.", styles["BodyGuide"]),
          Spacer(1, 22), Paragraph("WHAT YOU WILL SET UP", styles["LabelGuide"])]
for item in ["01  Local workspace, communications and follow-ups", "02  Configuration files and API keys", "03  Stripe payment tracking and webhooks", "04  Website health and Breeze CMS monitoring", "05  Cloud database, owner sign-in and hosting", "06  New websites, migration, backups and checks"]:
    story.append(Paragraph(item, styles["CoverList"]))
story += [Spacer(1, 20), Paragraph("Prepared 29 October 2026. Keys, account setup and production deployment are completed by you using this guide. Dashboard visual review is left to you as requested.", styles["BodyGuide"]), PageBreak()]

lines = (ROOT / "docs" / "SETUP.md").read_text(encoding="utf-8").splitlines()
paragraph, table_rows = [], []
def flush_paragraph():
    if paragraph:
        text = " ".join(paragraph)
        if text.startswith("- "):
            text = "<b> - </b>" + rich(text[2:])
        else:
            text = rich(text)
        story.append(Paragraph(text, styles["BodyGuide"]))
        paragraph.clear()
def flush_table():
    if not table_rows:
        return
    rows = [[Paragraph(rich(cell), styles["TableGuide"]) for cell in row] for row in table_rows]
    widths = [160, 125, A4[0] - 90 - 285]
    t = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#edf3ee")), ("VALIGN",(0,0),(-1,-1),"TOP"), ("LINEBELOW",(0,0),(-1,0),.7,LINE), ("LINEBELOW",(0,1),(-1,-1),.3,LINE), ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8), ("TOPPADDING",(0,0),(-1,-1),8), ("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story.extend([t, Spacer(1, 12)])
    table_rows.clear()

i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith("# "):
        i += 1
        continue
    if line.startswith("```"):
        flush_paragraph(); flush_table(); i += 1; code = []
        while i < len(lines) and not lines[i].startswith("```"):
            code.append(lines[i]); i += 1
        story.append(Preformatted("\n".join(code), styles["CodeGuide"], maxLineLength=102, splitChars=" "))
    elif line.startswith("| "):
        flush_paragraph()
        if not re.match(r"^\|\s*[-:]+", line):
            table_rows.append([cell.strip() for cell in line.strip("|").split("|")])
    elif line.startswith("## "):
        flush_paragraph(); flush_table()
        story.append(Paragraph(rich(line[3:]), styles["H2Guide"]))
    elif line.startswith("### "):
        flush_paragraph(); flush_table()
        story.append(Paragraph(rich(line[4:]), styles["H3Guide"]))
    elif not line.strip():
        flush_paragraph(); flush_table()
    elif re.match(r"^\d+\. ", line) or line.startswith("- "):
        flush_paragraph(); flush_table(); paragraph.append(line)
    else:
        if table_rows: flush_table()
        paragraph.append(line.strip())
    i += 1
flush_paragraph(); flush_table()
doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=45, leftMargin=45, topMargin=57, bottomMargin=56,
                        title="Website Products - Setup & Operations", author="Website Products", subject="Local setup, API keys, private hosting and operations")
doc.build(story, canvasmaker=NumberedCanvas)
pdf = fitz.open(OUT)
for index, page in enumerate(pdf):
    page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25)).save(QA / f"setup-{index+1:02d}.png")
    for block in page.get_text("blocks"):
        if block[0] < 35 or block[2] > A4[0] - 35 or block[1] < 18 or block[3] > A4[1] - 15:
            raise RuntimeError(f"Out-of-bounds content on page {index+1}: {block[:4]}")
print(f"Created {OUT} ({len(pdf)} pages). Rendered pages: {QA}")
