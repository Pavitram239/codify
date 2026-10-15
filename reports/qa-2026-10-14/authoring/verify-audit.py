from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import json

root = Path(__file__).resolve().parents[3]
file = root / 'outputs/01a12c0c-0888-7d53-94e2-75261c5185d7/Codify_Test_Audit_2026-10-14.xlsx'
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with ZipFile(file) as z:
    assert z.testzip() is None
    shared = ET.fromstring(z.read('xl/sharedStrings.xml')) if 'xl/sharedStrings.xml' in z.namelist() else None
    strings = [''.join(el.itertext()) for el in shared] if shared is not None else []
    sheets = []
    for i in range(1, 4):
        sheet = ET.fromstring(z.read(f'xl/worksheets/sheet{i}.xml'))
        errors = [c.attrib['r'] for c in sheet.findall('.//s:c', ns) if c.attrib.get('t') == 'e']
        assert not errors, errors
        sheets.append(sheet)
    def value(sheet, address):
        cell = sheet.find(f'.//s:c[@r="{address}"]', ns)
        val = cell.find('s:v', ns)
        if cell.attrib.get('t') == 's':
            return strings[int(val.text)]
        if cell.attrib.get('t') == 'inlineStr':
            return ''.join(cell.find('s:is', ns).itertext())
        return val.text if val is not None else None
    expected = {'B7': '256', 'B8': '67', 'B9': '80', 'B10': '323', 'B11': '403', 'B13': '0',
                'E7': '8', 'E8': '27', 'E9': '3', 'E10': '38', 'E11': '38', 'E12': '0'}
    for cell, count in expected.items():
        assert float(value(sheets[0], cell)) == float(count), (cell, value(sheets[0], cell))
    for i in [1, 2]:
        pane = sheets[i].find('.//s:pane', ns)
        assert pane is not None and float(pane.attrib.get('xSplit', 0)) == 2 and float(pane.attrib.get('ySplit', 0)) == 6, pane.attrib
        assert sheets[i].find('s:dataValidations', ns) is not None
        assert sheets[i].find('s:tableParts', ns) is not None
    assert len(sheets[1].findall('.//s:c/s:f', ns)) == 38
    result = {'xlsx_integrity': 'Passed', 'cached_summary_counts': 'Passed', 'formula_errors': 0,
              'frozen_headers_and_ids': 'Passed', 'editable_dropdowns_and_filter_tables': 'Passed',
              'finding_rows': 38, 'scenario_rows': 403, 'file_bytes': file.stat().st_size}
    print(json.dumps(result))
    (root / 'reports/qa-2026-10-14/evidence/workbook-verification.json').write_text(json.dumps(result, indent=2))
