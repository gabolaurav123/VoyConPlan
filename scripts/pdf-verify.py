"""Run after pdf-fixtures.mjs with Python + pypdf for extraction-level checks."""
from pathlib import Path
import json
import re
from pypdf import PdfReader

qa = Path(__file__).resolve().parents[1] / 'work' / 'qa'
reader = PdfReader(qa / 'voyconplan-texto-largo.pdf')
long_text = re.sub(r'\s+', ' ', ' '.join(page.extract_text() or '' for page in reader.pages))
assert long_text.count('Texto largo con acentos:') == 110, 'Every long-note fragment must survive'
# A sentence may continue after a repeated page header/footer; its words must all survive.
assert all(long_text.count(word) == 110 for word in ['orientación,', 'conexión,', 'documentación.']), 'Accents and final lines must survive'
assert 'Continuación' in long_text, 'Long activities need explicit continuation labels'
private = ' '.join(' '.join((page.extract_text() or '').split()) for page in PdfReader(qa / 'voyconplan-desde-app.pdf').pages)
assert 'PRIVATE_' not in private, 'Passport, reservation and top-level private canaries must remain absent'
assert 'SIN VERIFICAR' in private, 'Checklist status must never clear essential requirements'
short = PdfReader(qa / 'voyconplan-corto.pdf')
assert len(short.pages) == 2
assert short.pages[1].extract_text().startswith('DÍA 02'), 'Running header must identify the current day'
long = PdfReader(qa / 'voyconplan-largo.pdf')
assert long.pages[1].extract_text().startswith('DÍA 01'), 'Running header must identify the continued day'
assert not any('javascript:' in str(page.get('/Annots', '')) for page in short.pages)
report_path = qa / 'pdf-qa-report.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
report['extractionChecks'] = ['110 complete long-note repetitions with accents', 'private canaries excluded', 'essential requirements unverified', 'day continuation headers', '2-page short sample']
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('PDF extraction checks passed: text, privacy, requirements, and continuation headers.')
