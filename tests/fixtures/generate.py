"""Generate tiny synthetic file-import fixtures; no user data."""
from pathlib import Path
from zipfile import ZipFile
base = Path(__file__).parent

def zipped(name, files):
    with ZipFile(base / name, 'w') as out:
        for path, content in files.items():
            out.writestr(path, content)

zipped('words.docx', {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>en bok - 书，böcker</w:t></w:r></w:p><w:p><w:r><w:t>äta / 吃 / åt / ätit</w:t></w:r></w:p></w:body></w:document>'
})

def sheet(rows):
    return '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join('<row r="%d">'%n + ''.join('<c r="%s%d" t="inlineStr"><is><t>%s</t></is></c>'%(chr(65+j),n,value) for j,value in enumerate(row)) + '</row>' for n,row in enumerate(rows,1)) + '</sheetData></worksheet>'

zipped('words.xlsx', {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="名词" sheetId="1" r:id="rId1"/><sheet name="动词" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet([['中文','瑞典语','备注'],['苹果','ett äpple','复数 äpplen']]),
    'xl/worksheets/sheet2.xml': sheet([['瑞典语','中文'],['läsa','阅读']])
})

def pdf(name, content):
    stream = content.encode('ascii')
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length %d >>\nstream\n'%len(stream)+stream+b'\nendstream']
    data = b'%PDF-1.4\n'; offsets = [0]
    for n, obj in enumerate(objects,1):
        offsets.append(len(data)); data += ('%d 0 obj\n'%n).encode()+obj+b'\nendobj\n'
    start = len(data)
    data += b'xref\n0 6\n0000000000 65535 f \n'+b''.join(('%010d 00000 n \n'%n).encode() for n in offsets[1:])+b'trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n'+str(start).encode()+b'\n%%EOF'
    (base/name).write_bytes(data)
pdf('words.pdf','BT /F1 12 Tf 60 720 Td (en bok - book) Tj 0 -22 Td (fika - coffee break) Tj ET')
pdf('empty.pdf','')
(base/'words.csv').write_text('中文,瑞典语,备注\n苹果,ett äpple,"复数 äpplen"\n阅读,läsa,"läste, läst"\n',encoding='utf-8-sig')
