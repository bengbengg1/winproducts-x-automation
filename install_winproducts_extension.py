#!/usr/bin/env python3
"""Install the original WinProducts Chrome Web Store CRX into an isolated cache.

Only official Google update service is used. The proprietary extension is NOT
redistributed in this repository or in the downloadable project ZIP.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import struct
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile

EXTENSION_ID = "maplianemjpbfdhnmfpjhbjnmimbncla"
MAX_CRX_BYTES = 40 * 1024 * 1024
MAX_UNPACKED_BYTES = 100 * 1024 * 1024
MAX_FILES = 4000


def chrome_extension_id(public_key: bytes) -> str:
    digest = hashlib.sha256(public_key).digest()[:16]
    return "".join("abcdefghijklmnop"[nibble] for b in digest for nibble in (b >> 4, b & 0xF))


def read_varint(data: bytes, offset: int):
    number = 0
    for i in range(10):
        if offset >= len(data):
            raise ValueError("Kesik CRX3 protobuf verisi")
        b = data[offset]
        offset += 1
        number |= (b & 0x7F) << (7 * i)
        if not (b & 0x80):
            return number, offset
    raise ValueError("Gecersiz protobuf varint")


def protobuf_fields(data: bytes):
    pos = 0
    while pos < len(data):
        tag, pos = read_varint(data, pos)
        kind = tag & 7
        field = tag >> 3
        if not field:
            raise ValueError("Gecersiz protobuf field")
        if kind == 2:
            n, pos = read_varint(data, pos)
            if n > len(data) - pos:
                raise ValueError("Kesik protobuf string")
            yield field, data[pos:pos + n]
            pos += n
        elif kind == 0:
            _, pos = read_varint(data, pos)
        elif kind == 1:
            pos += 8
        elif kind == 5:
            pos += 4
        else:
            raise ValueError("Desteklenmeyen protobuf wire tipi")
        if pos > len(data):
            raise ValueError("Kesik protobuf")


def parse_crx3(blob: bytes, expected_id: str = EXTENSION_ID):
    if len(blob) < 12 or blob[:4] != b"Cr24":
        raise ValueError("Google CRX dosyasi degil")
    version, header_size = struct.unpack_from("<II", blob, 4)
    if version != 3 or header_size < 5 or header_size > 2 * 1024 * 1024:
        raise ValueError("Desteklenmeyen CRX surumu veya header")
    start = 12 + header_size
    if start >= len(blob) or blob[start:start + 2] != b"PK":
        raise ValueError("CRX3 icindeki ZIP verisi yok")
    header = blob[12:start]
    keys = []
    crx_id = None
    for field, value in protobuf_fields(header):
        if field in (2, 3):  # RSA/ECDSA AsymmetricKeyProof
            keys += [item for f, item in protobuf_fields(value) if f == 1]
        if field == 10000:  # signed_header_data, contains crx_id field 1
            crx_id = next((item for f, item in protobuf_fields(value) if f == 1), None)
    key = next((k for k in keys if chrome_extension_id(k) == expected_id), None)
    if not key:
        raise ValueError("CRX3 public key WinProducts Web Store ID ile eslesmiyor")
    if crx_id and crx_id != hashlib.sha256(key).digest()[:16]:
        raise ValueError("CRX3 imzali extension ID uyumsuz")
    return blob[start:], key


def extract_extension(blob: bytes, target: Path, expected_id: str = EXTENSION_ID):
    """Extract only safe regular entries, preserve Web Store ID via manifest key."""
    zipped, public_key = parse_crx3(blob, expected_id)
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(zipped)) as package:
        if len(package.infolist()) > MAX_FILES:
            raise ValueError("CRX3 gereksiz cok dosya iceriyor")
        total = 0
        for item in package.infolist():
            rel = PurePosixPath(item.filename)
            if rel.is_absolute() or ".." in rel.parts or "\\" in item.filename or not rel.parts:
                raise ValueError("Guvenli olmayan dosya yolu")
            # Reject symlinks and special files.
            mode = (item.external_attr >> 16) & 0o170000
            if mode and mode not in (0o100000, 0o040000):
                raise ValueError("Guvenli olmayan arşiv dosya tipi")
            total += item.file_size
            if total > MAX_UNPACKED_BYTES:
                raise ValueError("CRX acilmis veri sinirini asiyor")
            dest = target.joinpath(*rel.parts)
            if item.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                with package.open(item) as source, open(dest, "wb") as sink:
                    shutil.copyfileobj(source, sink)
    manifest_file = target / "manifest.json"
    if not manifest_file.exists():
        raise ValueError("WinProducts manifest.json bulunamadi")
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    if manifest.get("manifest_version") not in (2, 3):
        raise ValueError("Gecersiz Chrome extension manifest surumu")
    if not manifest.get("name") or not manifest.get("version"):
        raise ValueError("Gecersiz Chrome extension manifest")
    manifest_key = manifest.get("key")
    if manifest_key and chrome_extension_id(base64.b64decode(manifest_key)) != expected_id:
        raise ValueError("Manifest anahtari orijinal eklenti ID ile eslesmiyor")
    # An unpacked extension without the original key gets a DIFFERENT ID.
    # Adding the public key from Google's CRX3 header retains original origin/ID.
    manifest["key"] = base64.b64encode(public_key).decode("ascii")
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return str(manifest["version"])


def official_update_url():
    query = urllib.parse.urlencode({
        "response": "redirect",
        "prod": "chromium",
        "prodversion": "143.0.7499.41",
        "acceptformat": "crx3",
        "x": f"id={EXTENSION_ID}&installsource=ondemand&uc",
    })
    return "https://clients2.google.com/service/update2/crx?" + query


def download_crx(timeout: int = 40):
    request = urllib.request.Request(official_update_url(), headers={"User-Agent": "WinProducts-Extension-Test/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"Chrome Web Store paketi indirilemedi (HTTP {response.status})")
        blob = response.read(MAX_CRX_BYTES + 1)
    if len(blob) > MAX_CRX_BYTES:
        raise RuntimeError("Chrome Web Store CRX boyut sinirini asti")
    return blob


def install(destination: Path, download_fn=download_crx):
    destination = destination.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = download_fn()
    with tempfile.TemporaryDirectory(prefix="wp-extension-", dir=destination.parent) as temp:
        staged = Path(temp) / "extension"
        version = extract_extension(data, staged, expected_id=EXTENSION_ID)
        if destination.exists():
            shutil.rmtree(destination)
        staged.rename(destination)
    # Don't log browser secrets or store proprietary extension files in Git.
    return {"path": str(destination), "version": version, "id": EXTENSION_ID,
            "crx_sha256": hashlib.sha256(data).hexdigest(), "origin": "official Google Chrome Web Store"}


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="WinProducts resmi Chrome Web Store surumunu indir ve guvenli sekilde kur")
    parser.add_argument("--out", type=Path, default=root / ".extensions" / "winproducts")
    args = parser.parse_args()
    try:
        result = install(args.out)
    except (ValueError, RuntimeError, urllib.error.URLError, OSError, zipfile.BadZipFile) as error:
        parser.exit(1, f"WinProducts uzantisi kurulamadı: {error}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
