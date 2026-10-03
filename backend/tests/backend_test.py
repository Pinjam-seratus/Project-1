"""Backend API tests for FinNota (invoice ledger) app."""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-ledger-36.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"username": "admin", "password": "admin123"}


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["role"] == "admin"
    # Also attach bearer as backup
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def created_ids():
    return {"users": [], "kode_rekening": [], "kegiatan": [], "item_barang": [], "notas": []}


# ---------------- auth ----------------
class TestAuth:
    def test_login_wrong(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_login_ok_and_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["username"] == "admin"
        assert r.json()["role"] == "admin"

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------------- master data ----------------
class TestMasterData:
    def test_create_kode_rekening_pendapatan(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/kode-rekening",
                               json={"kode": "TEST-P1", "nama": "TEST Pendapatan 1", "jenis": "pendapatan"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["jenis"] == "pendapatan" and d["kode"] == "TEST-P1"
        created_ids["kode_rekening"].append(d["id"])

    def test_create_kode_rekening_pengeluaran(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/kode-rekening",
                               json={"kode": "TEST-E1", "nama": "TEST Pengeluaran 1", "jenis": "pengeluaran"}, timeout=15)
        assert r.status_code == 200
        created_ids["kode_rekening"].append(r.json()["id"])

    def test_list_kode_rekening(self, admin_session):
        r = admin_session.get(f"{API}/master/kode-rekening", timeout=15)
        assert r.status_code == 200
        names = [x["nama"] for x in r.json()]
        assert any("TEST Pendapatan 1" in n for n in names)

    def test_update_kode_rekening(self, admin_session, created_ids):
        kid = created_ids["kode_rekening"][0]
        r = admin_session.put(f"{API}/master/kode-rekening/{kid}",
                              json={"kode": "TEST-P1", "nama": "TEST Pendapatan 1 Updated", "jenis": "pendapatan"},
                              timeout=15)
        assert r.status_code == 200
        lst = admin_session.get(f"{API}/master/kode-rekening").json()
        assert any(x["id"] == kid and "Updated" in x["nama"] for x in lst)

    def test_create_kegiatan(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/kegiatan", json={"nama": "TEST Kegiatan", "keterangan": "x"}, timeout=15)
        assert r.status_code == 200
        created_ids["kegiatan"].append(r.json()["id"])

    def test_create_item_barang(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/item-barang",
                               json={"nama": "TEST Pensil", "satuan": "pcs", "harga_default": 2500}, timeout=15)
        assert r.status_code == 200
        assert r.json()["harga_default"] == 2500
        created_ids["item_barang"].append(r.json()["id"])

    def test_import_csv_item_barang(self, admin_session):
        csv = "nama,satuan,harga_default\nTEST Buku,pcs,15000\nTEST Spidol,pcs,8000\n"
        files = {"file": ("items.csv", io.BytesIO(csv.encode()), "text/csv")}
        r = admin_session.post(f"{API}/master/item-barang/import", files=files, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] >= 2

    def test_import_csv_kode_rekening(self, admin_session):
        csv = "kode,nama,jenis\nTEST-IMP-P,TEST Imp Pendapatan,pendapatan\nTEST-IMP-E,TEST Imp Pengeluaran,pengeluaran\n"
        files = {"file": ("kr.csv", io.BytesIO(csv.encode()), "text/csv")}
        r = admin_session.post(f"{API}/master/kode-rekening/import", files=files, timeout=30)
        assert r.status_code == 200
        assert r.json()["inserted"] >= 2

    def test_master_unknown_kind(self, admin_session):
        r = admin_session.get(f"{API}/master/invalid-kind", timeout=15)
        assert r.status_code == 404


# ---------------- nota ----------------
class TestNota:
    def test_create_pengeluaran_nota(self, admin_session, created_ids):
        payload = {
            "nomor_nota": "TEST-NOTA-001",
            "tanggal_nota": "2026-01-10",
            "tanggal_bayar": "2026-01-11",
            "kode_rekening": "TEST-E1",
            "kode_rekening_nama": "TEST Pengeluaran 1",
            "jenis": "pengeluaran",
            "sumber_dana": "kasir",
            "kegiatan": "Operasional",
            "items": [
                {"nama": "TEST Pensil", "unit": 10, "harga_per_unit": 2500, "total": 0},
                {"nama": "TEST Buku", "unit": 2, "harga_per_unit": 15000, "total": 0},
            ],
            "total_nota": 0,
        }
        r = admin_session.post(f"{API}/nota", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_nota"] == 10 * 2500 + 2 * 15000
        assert d["items"][0]["total"] == 25000
        created_ids["notas"].append(d["id"])

    def test_create_pendapatan_nota(self, admin_session, created_ids):
        payload = {
            "nomor_nota": "TEST-NOTA-002",
            "tanggal_nota": "2026-01-12",
            "kode_rekening": "TEST-P1",
            "kode_rekening_nama": "TEST Pendapatan 1",
            "jenis": "pendapatan",
            "sumber_dana": "transfer",
            "kegiatan": "Operasional",
            "items": [{"nama": "Iuran", "unit": 1, "harga_per_unit": 1000000, "total": 0}],
            "total_nota": 0,
        }
        r = admin_session.post(f"{API}/nota", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["total_nota"] == 1000000
        created_ids["notas"].append(r.json()["id"])

    def test_list_nota(self, admin_session):
        r = admin_session.get(f"{API}/nota", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_get_nota(self, admin_session, created_ids):
        nid = created_ids["notas"][0]
        r = admin_session.get(f"{API}/nota/{nid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["nomor_nota"] == "TEST-NOTA-001"

    def test_filter_jenis(self, admin_session):
        r = admin_session.get(f"{API}/nota?jenis=pendapatan", timeout=15)
        assert r.status_code == 200
        for n in r.json():
            assert n["jenis"] == "pendapatan"


# ---------------- reports ----------------
class TestReports:
    def test_summary(self, admin_session):
        r = admin_session.get(f"{API}/reports/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_pendapatan", "total_pengeluaran", "saldo", "jumlah_nota"):
            assert k in d
        assert d["total_pendapatan"] >= 1000000
        assert d["total_pengeluaran"] >= 55000

    def test_pendapatan_pengeluaran(self, admin_session):
        r = admin_session.get(f"{API}/reports/pendapatan-pengeluaran", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["pendapatan"]) >= 1 and len(d["pengeluaran"]) >= 1
        assert d["saldo"] == round(d["total_pendapatan"] - d["total_pengeluaran"], 2)

    def test_item_per_sumber_dana(self, admin_session):
        r = admin_session.get(f"{API}/reports/item-per-sumber-dana", timeout=15)
        assert r.status_code == 200
        groups = {g["sumber_dana"]: g for g in r.json()["groups"]}
        assert "kasir" in groups
        assert groups["kasir"]["total"] >= 55000


# ---------------- user mgmt + role enforcement ----------------
class TestUserMgmt:
    def test_create_user(self, admin_session, created_ids):
        uname = f"testuser_{int(time.time())}"
        r = admin_session.post(f"{API}/users",
                               json={"username": uname, "password": "secret123", "name": "TEST User", "role": "user"},
                               timeout=15)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        created_ids["users"].append((uid, uname))
        # verify via GET
        lst = admin_session.get(f"{API}/users").json()
        assert any(u["id"] == uid for u in lst)

    def test_non_admin_cannot_list_users(self, created_ids):
        uid, uname = created_ids["users"][-1]
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"username": uname, "password": "secret123"}, timeout=15)
        assert r.status_code == 200
        s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        r2 = s.get(f"{API}/users", timeout=15)
        assert r2.status_code == 403

    def test_update_user(self, admin_session, created_ids):
        uid, _ = created_ids["users"][-1]
        r = admin_session.put(f"{API}/users/{uid}", json={"name": "TEST User Updated"}, timeout=15)
        assert r.status_code == 200

    def test_delete_user(self, admin_session, created_ids):
        uid, _ = created_ids["users"][-1]
        r = admin_session.delete(f"{API}/users/{uid}", timeout=15)
        assert r.status_code == 200


# ---------------- cleanup ----------------
class TestZCleanup:
    def test_delete_test_data(self, admin_session, created_ids):
        for nid in created_ids["notas"]:
            admin_session.delete(f"{API}/nota/{nid}")
        # delete masters prefixed TEST
        for kind in ("kode-rekening", "kegiatan", "item-barang"):
            lst = admin_session.get(f"{API}/master/{kind}").json()
            for d in lst:
                nama = d.get("nama", "")
                kode = d.get("kode", "")
                if nama.startswith("TEST") or kode.startswith("TEST"):
                    admin_session.delete(f"{API}/master/{kind}/{d['id']}")
