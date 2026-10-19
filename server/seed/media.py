"""Demo media for seeded case studies and project profiles: SVG gallery images and a one-page PDF
fact sheet. Generated deterministically, with no image or PDF libraries. hero_svg made the static
fallback banners in client/public/heroes."""
import random
import textwrap
from xml.sax.saxutils import escape

PALETTES = [("#004825", "#00994d"), ("#00994d", "#a0cd60"), ("#004825", "#671c32"), ("#0b5a33", "#a0cd60")]


def _ridge(r: random.Random, width, height, base, amp, steps):
    pts = [(0, height)]
    for i in range(steps + 1):
        pts.append((round(width * i / steps), round(base + r.uniform(-amp, amp))))
    pts.append((width, height))
    return " ".join(f"{x},{y}" for x, y in pts)


def _scene(seed: int, width: int, height: int, extra: str = "") -> bytes:
    r = random.Random(seed)
    a, b = PALETTES[seed % len(PALETTES)]
    sun_x, sun_y = r.uniform(0.15, 0.85) * width, r.uniform(0.18, 0.4) * height
    layers = "".join(
        f'<polygon points="{_ridge(r, width, height, height * base, height * amp, steps)}" fill="#ffffff" opacity="{op}"/>'
        for base, amp, steps, op in ((0.55, 0.12, 7, 0.10), (0.68, 0.08, 11, 0.16), (0.8, 0.05, 16, 0.24)))
    # A row of transmission towers / light poles so the scenes read as infrastructure.
    poles = []
    for i in range(r.randint(3, 6)):
        x = width * (0.08 + i * r.uniform(0.12, 0.18))
        top = height * r.uniform(0.42, 0.58)
        poles.append(f'<path d="M{x:.0f} {height * 0.86:.0f} L{x:.0f} {top:.0f} M{x - 14:.0f} {top + 12:.0f} L{x + 14:.0f} {top + 12:.0f}" '
                     f'stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" fill="none"/>')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/>'
        f'<stop offset="1" stop-color="{b}"/></linearGradient></defs>'
        f'<rect width="{width}" height="{height}" fill="url(#g)"/>'
        f'<circle cx="{sun_x:.0f}" cy="{sun_y:.0f}" r="{height * 0.09:.0f}" fill="#ffffff" opacity="0.18"/>'
        f'{layers}{"".join(poles)}{extra}</svg>'
    )
    return svg.encode()


def hero_svg(seed: int) -> bytes:
    return _scene(seed, 1600, 600)


def gallery_svg(seed: int, caption: str) -> bytes:
    label = (f'<rect x="0" y="720" width="1200" height="80" fill="#000000" opacity="0.35"/>'
             f'<text x="32" y="770" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#ffffff">{escape(caption[:70])}</text>')
    return _scene(seed, 1200, 800, label)


def _pdf_text(s: str) -> str:
    s = s.encode("cp1252", "replace").decode("latin-1")
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def fact_sheet_pdf(title: str, sections: list[tuple[str, list[str]]]) -> bytes:
    """A single A4 page: a green title band, then headed sections of wrapped text."""
    ops = ["0 0.282 0.145 rg 0 752 595 90 re f", "BT 1 1 1 rg /F2 18 Tf 40 790 Td"]
    ops += [f"({_pdf_text(line)}) Tj 0 -22 Td" for line in textwrap.wrap(title, 52)[:2]]
    ops.append("ET")
    y = 720
    for heading, lines in sections:
        if y < 80:
            break
        ops.append(f"BT 0 0.282 0.145 rg /F2 12 Tf 40 {y} Td ({_pdf_text(heading)}) Tj ET")
        y -= 18
        for para in lines:
            for line in textwrap.wrap(para, 95) or [""]:
                if y < 60:
                    break
                ops.append(f"BT 0.15 0.15 0.15 rg /F1 10 Tf 40 {y} Td ({_pdf_text(line)}) Tj ET")
                y -= 14
            y -= 4
        y -= 10
    ops.append("BT 0.45 0.45 0.45 rg /F1 8 Tf 40 30 Td (Generated demo fact sheet - One Work Winning Hub) Tj ET")
    stream = "\n".join(ops).encode("latin-1")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)
