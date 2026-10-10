"""Gibt alle Meldungen eines KoSIT-Prüfberichts lesbar aus (Schema + Schematron).

Aufruf aus .github/workflows/xrechnung-validate.yml:
    python3 backend/scripts/kosit-report.py <report.xml>
"""
import re
import sys

xml = open(sys.argv[1], encoding="utf-8").read()
for m in re.finditer(r"<(?:\w+:)?message\b([^>]*)>(.*?)</(?:\w+:)?message>", xml, re.S):
    attrs, text = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
    get = lambda name: (re.search(rf'{name}="([^"]*)"', attrs) or [None, "?"])[1]
    print(f"   [{get('level')}] {get('code')} Z.{get('lineNumber')}: {text[:300]}")
