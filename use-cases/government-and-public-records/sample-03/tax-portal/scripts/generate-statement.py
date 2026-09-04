#!/usr/bin/env python3
"""Rebuild the deliberately synthetic, deterministic one-page PDF fixture."""
from pathlib import Path


def statement_pdf() -> bytes:
    lines = [
        "SYNTHETIC TAX STATEMENT",
        "Demonstration only. Not a bill or public record.",
        "Example County - Tax year 2024",
        "Demo parcel: DEMO-0001",
        "Amount due: $0.00",
        "No payment is required. All information is fabricated.",
        "Browserbase cookbook verification fixture",
    ]
    commands = ["BT", "/F1 18 Tf", "54 730 Td", "28 TL"]
    for index, line in enumerate(lines):
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if index:
            commands.extend(["T*", "/F1 12 Tf"])
        commands.append(f"({escaped}) Tj")
    commands.append("ET")
    stream = ("\n".join(commands) + "\n").encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"endstream",
    ]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode("ascii") + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(output)


if __name__ == "__main__":
    destination = Path(__file__).resolve().parents[1] / "public" / "tax-statement-2024.pdf"
    destination.parent.mkdir(exist_ok=True)
    destination.write_bytes(statement_pdf())
    print("Rebuilt synthetic statement fixture.")
