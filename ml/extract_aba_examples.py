"""
Extract labeled category examples from ABA bank statement XLSX files.

Usage:
    python3 ml/extract_aba_examples.py statement_20260701_20260708.xlsx

Produces:
    ml/datasets/aba_statement_examples.csv

Labels only clear purchases (coffee, parking, spotify, etc.).
Personal-name purchases and transfers default to 'other' for later user correction.
"""

import csv
import hashlib
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

# ----- Manual labeling rules for known merchants -----
MERCHANT_LABELS = {
    'phaen coffee': 'food',
    'kafe chakvai': 'food',
    'koi the eden garden': 'food',
    'legend eden garden': 'food',
    'som pov': 'food',
    'mom ko': 'food',
    'phan kimsras': 'food',
    'kong vantho': 'food',
    'seng daly': 'food',
    'phork chandara': 'food',
    'kry bunthai': 'food',
    'sao dang': 'food',
    'kheng chhaiheng': 'food',
    'phat vanny': 'food',
    'tep chansokha': 'food',
    'suor y den': 'food',
    'kong samnang': 'food',
    'chhom vechaka': 'shopping',
    'smart axiata': 'bills',
    'spotify': 'ent',
    'tk avenue parking': 'transport',
    'chan kongkea cd': 'ent',
    'legend tk': 'ent',
    'anomaly': 'shopping',
    'qraftio ttp': 'shopping',
    'eco town': 'shopping',
}


def parse_xlsx(path: Path) -> list[dict]:
    """Parse ABA ACCOUNT ACTIVITY XLSX into list of row dicts."""
    with zipfile.ZipFile(path) as z:
        ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        shared = []
        for si in ss_root.findall('a:si', NS):
            parts = [t.text or '' for t in si.findall('.//a:t', NS)]
            shared.append(''.join(parts))

        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows_raw = []
        for row in sheet.findall('a:sheetData/a:row', NS):
            cells = {}
            for c in row.findall('a:c', NS):
                ref = c.attrib.get('r', '')
                col = ''.join(ch for ch in ref if ch.isalpha())
                t = c.attrib.get('t')
                v = c.find('a:v', NS)
                val = ''
                if v is not None:
                    val = shared[int(v.text)] if t == 's' else (v.text or '')
                cells[col] = val
            rows_raw.append(cells)

    # Find header row: must have Date, Transaction Details, Balance
    header_idx = None
    for i, r in enumerate(rows_raw):
        vals = [r.get(c, '').strip().lower() for c in 'ABCDEFGH']
        if vals[0] == 'date' and vals[1] == 'transaction details' and vals[6] == 'balance':
            header_idx = i
            break
    if header_idx is None:
        raise ValueError('Could not find ABA header row in XLSX')

    rows = []
    for r in rows_raw[header_idx + 1:]:
        date = r.get('A', '').strip()
        details = r.get('B', '').strip()
        if not date or not details:
            continue
        money_in = r.get('C', '').strip()
        ccy_in = r.get('D', '').strip()
        money_out = r.get('E', '').strip()
        ccy_out = r.get('F', '').strip()
        balance = r.get('G', '').strip()
        ccy_bal = r.get('H', '').strip()
        rows.append({
            'date_raw': date,
            'description': details,
            'money_in': money_in,
            'ccy_in': ccy_in,
            'money_out': money_out,
            'ccy_out': ccy_out,
            'balance': balance,
            'ccy_bal': ccy_bal,
        })
    return rows


def parse_date(raw: str) -> str:
    """Convert 'Jul 03, 2026' to '2026-07-03'."""
    months = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
              'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
    m = re.match(r'(\w{3})\s+(\d{1,2}),?\s*(\d{4})', raw, re.I)
    if not m:
        raise ValueError(f'Cannot parse date: {raw}')
    mon = months.get(m.group(1).lower())
    if mon is None:
        raise ValueError(f'Unknown month: {m.group(1)}')
    return f'{m.group(3)}-{mon:02d}-{int(m.group(2)):02d}'


def kind_hint(desc: str) -> str:
    upper = desc.upper()
    if upper.startswith('PURCHASE AT'):
        return 'purchase'
    if upper.startswith('FUNDS TRANSFERRED'):
        return 'transfer_out'
    if upper.startswith('FUNDS RECEIVED'):
        return 'transfer_in'
    return 'other'


def clean_label(desc: str) -> str:
    """Clean ABA description to a compact label for classification."""
    t = desc.strip()
    # Remove leading kind prefix
    t = re.sub(r'^(PURCHASE AT|FUNDS TRANSFERRED TO|FUNDS RECEIVED FROM)\s+', '', t, flags=re.I)
    # Remove everything after first ON ... timestamp
    t = re.sub(r'\bON\s+\w{3}\s+\d{1,2},\s*\d{4}.*$', '', t, flags=re.I)
    # Remove REF#, PURCHASE#, APV#, RRN#, BAKONG#, CARD#
    t = re.sub(r'\b(REF|PURCHASE|APV|RRN|BAKONG|CARD|AUTHORIZATION)\s*[#:]\s*\S+', '', t, flags=re.I)
    # Remove ORIGINAL AMOUNT ... currency
    t = re.sub(r'ORIGINAL\s+AMOUNT\s+[\d,.]+\s+(USD|KHR)', '', t, flags=re.I)
    # Remove REMARK and trailing noise
    t = re.sub(r'REMARK:\s*\S+.*$', '', t, flags=re.I)
    t = re.sub(r'@CYBS_TRN.*$', '', t, flags=re.I)
    # Remove bank names (noise after merchant)
    t = re.sub(r'\bBANK\s+\S+(\s+Bank)?(\s+Plc)?(\s+Ltd)?\b', '', t, flags=re.I)
    # Remove account numbers
    t = re.sub(r'\b\d{6,}\b', '', t)
    # Remove location suffixes after merchant
    t = re.sub(r',\s*\S+,\s*\S+\s+(UNITED STATES|SWEDEN|CAMBODIA|SINGAPORE).*$', '', t, flags=re.I)
    # Remove BY SENG CHANBORA CARD# ...
    t = re.sub(r'\bBY\s+\S+\s+CARD#.*$', '', t, flags=re.I)
    # Remove time segments
    t = re.sub(r'\bON\s+CAMBODIA\s+TIME.*$', '', t, flags=re.I)
    # Collapse whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    # Strip trailing noise characters
    t = re.sub(r'[,;:\s-]+$', '', t)
    return t.lower()


def label_category(desc: str, kind: str) -> str:
    """Assign category from description using merchant rules."""
    clean = clean_label(desc)
    # Only label purchases; transfers and income go to other
    if kind != 'purchase':
        return 'other'
    for merchant, cat in MERCHANT_LABELS.items():
        if merchant in clean:
            return cat
    return 'other'


def main():
    if len(sys.argv) < 2:
        print(f'Usage: python3 {sys.argv[0]} statement_YYYYMMDD_YYYYMMDD.xlsx')
        sys.exit(1)

    xlsx_path = Path(sys.argv[1])
    if not xlsx_path.exists():
        print(f'File not found: {xlsx_path}')
        sys.exit(1)

    rows = parse_xlsx(xlsx_path)

    out_path = Path('ml/datasets/aba_statement_examples.csv')
    fieldnames = [
        'id', 'split', 'raw_text', 'clean_label', 'category_key',
        'category_label', 'currency_hint', 'amount_value', 'direction',
        'kind_hint', 'locale_hint', 'source', 'notes',
    ]

    # Taxonomy labels
    CAT_LABELS = {
        'food': 'Food & drinks', 'transport': 'Transport',
        'bills': 'Bills & utilities', 'shopping': 'Shopping',
        'ent': 'Entertainment', 'health': 'Health',
        'education': 'Education', 'family': 'Family & home',
        'travel': 'Travel', 'other': 'Other',
    }

    with out_path.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        idx = 0
        for row in rows:
            kind = kind_hint(row['description'])
            date = parse_date(row['date_raw'])
            direction = 'out' if row['money_out'] else 'in'
            amt_str = row['money_out'] or row['money_in']
            ccy = (row['ccy_out'] or row['ccy_in']).upper()
            amount = float(amt_str.replace(',', '')) if amt_str else 0
            clean = clean_label(row['description'])
            cat_key = label_category(row['description'], kind)

            idx += 1
            writer.writerow({
                'id': f'aba-{idx:03d}',
                'split': 'train',
                'raw_text': row['description'][:200],
                'clean_label': clean,
                'category_key': cat_key,
                'category_label': CAT_LABELS.get(cat_key, 'Other'),
                'currency_hint': ccy,
                'amount_value': str(amount),
                'direction': direction,
                'kind_hint': kind,
                'locale_hint': 'en',
                'source': 'aba_statement',
                'notes': f'date={date} balance={row["balance"]}',
            })

    print(f'Wrote {idx} examples to {out_path}')

    # Summary stats
    cats = {}
    with out_path.open('r', newline='') as f:
        for r in csv.DictReader(f):
            k = r['category_key']
            cats[k] = cats.get(k, 0) + 1
    print('Category distribution:', dict(sorted(cats.items())))


if __name__ == '__main__':
    main()
