"""Offline tests for the official store CRX3 installer; no network access."""
import base64
import io
import json
import struct
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from install_winproducts_extension import (
    chrome_extension_id, parse_crx3, extract_extension, official_update_url, install,
)


def varint(number):
    out=[]
    while number>127:
        out.append((number&127)|128);number >>= 7
    out.append(number)
    return bytes(out)


def field(number,data):
    return varint(number<<3|2)+varint(len(data))+data


def make_crx(files=None):
    key=bytes(range(1,111))
    eid=chrome_extension_id(key)
    proof=field(1,key)+field(2,b'test signature')
    signed=field(1,__import__('hashlib').sha256(key).digest()[:16])
    header=field(2,proof)+field(10000,signed)
    buf=io.BytesIO()
    with ZipFile(buf,'w',ZIP_DEFLATED) as z:
        for name,content in (files or {'manifest.json':json.dumps({'manifest_version':3,'name':'WinProducts','version':'0.1.31'}),'panel/index.html':'Hello'}).items():
            z.writestr(name,content)
    blob=b'Cr24'+struct.pack('<II',3,len(header))+header+buf.getvalue()
    return blob,eid


class TestInstaller(unittest.TestCase):
    def test_signed_header_webstore_id_is_preserved(self):
        crx,eid=make_crx()
        archive,key=parse_crx3(crx,eid)
        self.assertTrue(archive.startswith(b'PK'))
        self.assertEqual(chrome_extension_id(key),eid)
        with tempfile.TemporaryDirectory() as d:
            ver=extract_extension(crx,Path(d),eid)
            m=json.loads((Path(d)/'manifest.json').read_text())
            self.assertEqual(ver,'0.1.31')
            self.assertEqual(chrome_extension_id(base64.b64decode(m['key'])),eid)

    def test_rejects_modified_id_and_bad_package(self):
        crx,eid=make_crx()
        with self.assertRaisesRegex(ValueError,'ID'):
            parse_crx3(crx,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        with self.assertRaises(ValueError):parse_crx3(b'not a CRX',eid)
        modified=bytearray(crx)
        marker=modified.find(__import__('hashlib').sha256(bytes(range(1,111))).digest()[:16])
        self.assertGreater(marker,0)
        modified[marker]^=1
        with self.assertRaisesRegex(ValueError,'imzali'):parse_crx3(bytes(modified),eid)

    def test_rejects_archive_traversal(self):
        crx,eid=make_crx({'../outside.txt':'evil','manifest.json':'{}'})
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError,'dosya yolu'):
                extract_extension(crx,Path(d)/'extension',eid)
            self.assertFalse((Path(d)/'outside.txt').exists())

    def test_atomic_local_install_of_fake_fixture(self):
        crx,eid=make_crx()
        # Use same verified fake extension id by temporarily injecting it into the
        # module's expected constant - fake fixture NEVER goes to production.
        import install_winproducts_extension as mod
        original=mod.EXTENSION_ID
        with tempfile.TemporaryDirectory() as d:
            try:
                mod.EXTENSION_ID=eid
                result=install(Path(d)/'ext',lambda:crx)
                self.assertEqual(result['id'],eid)
                self.assertTrue((Path(d)/'ext'/'manifest.json').exists())
                self.assertFalse(any(p.name.startswith('wp-extension-') for p in Path(d).iterdir()))
            finally:
                mod.EXTENSION_ID=original

    def test_update_origin_is_google(self):
        url=official_update_url()
        self.assertTrue(url.startswith('https://clients2.google.com/service/update2/crx?'))
        self.assertIn('maplianemjpbfdhnmfpjhbjnmimbncla',url)

if __name__=='__main__': unittest.main()
