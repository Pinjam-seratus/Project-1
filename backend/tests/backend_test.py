"""Backend API tests for FinNota (restructured) — iteration 2."""
import io
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://invoice-ledger-36.preview.emergentagent.com").rstrip("/")
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
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def created_ids():
    return {"users": [], "kode_rekening": [], "kegiatan": [], "item_barang": [],
            "notas": [], "sumber_dana": []}


# ---------------- auth ----------------
class TestAuth:
    def test_login_wrong(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_login_sets_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        # httpOnly cookie set
        assert "access_token" in s.cookies.get_dict() or any(
            c.name == "access_token" for c in s.cookies
        )

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_ok(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# ---------------- master data ----------------
class TestMasterData:
    def test_seed_sumber_dana(self, admin_session):
        r = admin_session.get(f"{API}/master/sumber-dana", timeout=15)
        assert r.status_code == 200
        codes = {s["kode"] for s in r.json()}
        assert {"K", "TF", "KOP", "PENG"}.issubset(codes)

    def test_seed_kode_rekening(self, admin_session):
        r = admin_session.get(f"{API}/master/kode-rekening", timeout=15)
        assert r.status_code == 200
        kodes = {k["kode"] for k in r.json()}
        assert "1.1" in kodes and "2.2" in kodes and "2.11" in kodes

    def test_jenis_auto_belanja(self, admin_session, created_ids):
        # kode starting with 2 and no jenis → belanja
        r = admin_session.post(f"{API}/master/kode-rekening",
                               json={"kode": "TEST-2.9", "nama": "TEST Belanja Auto"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Note: kode "TEST-2.9" starts with 'T' not '1' or '2', so defaults belanja
        assert d["jenis"] == "belanja"
        created_ids["kode_rekening"].append(d["id"])

        # Real kode "2.9" → belanja
        r = admin_session.post(f"{API}/master/kode-rekening",
                               json={"kode": "TEST29", "nama": "TEST 29"}, timeout=15)
        assert r.status_code == 200
        created_ids["kode_rekening"].append(r.json()["id"])

    def test_jenis_auto_pendapatan(self, admin_session, created_ids):
        # Add actual code starting with "1" (jenis_from_kode checks startswith "1")
        r = admin_session.post(f"{API}/master/kode-rekening",
                               json={"kode": "1.9TEST", "nama": "TEST Pendapatan Auto"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["jenis"] == "pendapatan"
        created_ids["kode_rekening"].append(d["id"])

    def test_jenis_manual_dialokasikan(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/kode-rekening",
                               json={"kode": "2.99TEST", "nama": "TEST Dialokasikan",
                                     "jenis": "dialokasikan"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["jenis"] == "dialokasikan"
        created_ids["kode_rekening"].append(r.json()["id"])

    def test_create_sumber_dana(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/sumber-dana",
                               json={"kode": "TSTSD", "nama": "TEST Sumber Dana"}, timeout=15)
        assert r.status_code == 200
        created_ids["sumber_dana"].append(r.json()["id"])

    def test_create_item_barang_with_kode_rek(self, admin_session, created_ids):
        r = admin_session.post(f"{API}/master/item-barang",
                               json={"nama": "TEST Pensil", "kode_rek": "2.2",
                                     "kategori": "Operasional"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["kode_rek"] == "2.2"
        assert d["kategori"] == "Operasional"
        # enrichment: kode_rek_nama populated from master
        assert "BAHAN BAKU" in (d.get("kode_rek_nama") or "")
        created_ids["item_barang"].append(d["id"])

    def test_import_csv_item_barang_normalized_headers(self, admin_session):
        # Header per spec: NAMA BARANG, KODE REK, SUMBER REK
        csv = "NAMA BARANG,KODE REK,SUMBER REK\nTEST Buku,2.2,Operasional\nTEST Spidol,1.1,Pengembangan\n"
        files = {"file": ("items.csv", io.BytesIO(csv.encode()), "text/csv")}
        r = admin_session.post(f"{API}/master/item-barang/import", files=files, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] >= 2
        lst = admin_session.get(f"{API}/master/item-barang").json()
        buku = next((x for x in lst if x["nama"] == "TEST Buku"), None)
        assert buku is not None
        assert buku["kode_rek"] == "2.2"
        assert buku["kategori"] == "Operasional"

    def test_unknown_master_kind(self, admin_session):
        r = admin_session.get(f"{API}/master/invalid-kind", timeout=15)
        assert r.status_code == 404


# ---------------- nota ----------------
class TestNota:
    def test_create_nota_mixed_items(self, admin_session, created_ids):
        payload = {
            "nomor_nota": "TESTN-001",
            "tanggal_nota": "2026-01-10",
            "tanggal_bayar": "2026-01-11",
            "sumber_dana": "K",
            "items": [
                {"nama": "TEST Bahan Baku", "kode_rekening": "2.2",
                 "kategori": "Operasional", "unit": 10, "harga_per_unit": 5000, "total": 0},
                {"nama": "TEST Penjualan", "kode_rekening": "1.1",
                 "kategori": "Operasional", "unit": 1, "harga_per_unit": 100000, "total": 0},
            ],
            "total_nota": 0,
        }
        r = admin_session.post(f"{API}/nota", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # auto-computed totals per item and nota
        assert d["items"][0]["total"] == 50000
        assert d["items"][1]["total"] == 100000
        assert d["total_nota"] == 150000
        # jenis derived per item from kode_rekening
        assert d["items"][0]["jenis"] == "belanja"
        assert d["items"][1]["jenis"] == "pendapatan"
        created_ids["notas"].append(d["id"])

    def test_list_nota_and_filter_sumber(self, admin_session):
        r = admin_session.get(f"{API}/nota?sumber_dana=K", timeout=15)
        assert r.status_code == 200
        notas = r.json()
        assert len(notas) >= 1
        for n in notas:
            assert n["sumber_dana"] == "K"

    def test_get_nota_detail(self, admin_session, created_ids):
        nid = created_ids["notas"][0]
        r = admin_session.get(f"{API}/nota/{nid}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["nomor_nota"] == "TESTN-001"
        assert len(d["items"]) == 2
        assert d["items"][0]["kode_rekening"] == "2.2"


# ---------------- reports ----------------
class TestReports:
    def test_pendapatan_pengeluaran(self, admin_session):
        r = admin_session.get(f"{API}/reports/pendapatan-pengeluaran", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("pendapatan", "belanja", "dialokasikan",
                  "total_pendapatan", "total_belanja", "total_transaksi"):
            assert k in d
        # total_transaksi = pendapatan - belanja
        assert round(d["total_transaksi"], 2) == round(d["total_pendapatan"] - d["total_belanja"], 2)
        # our test items should contribute
        assert d["total_pendapatan"] >= 100000
        assert d["total_belanja"] >= 50000

    def test_rincian_belanja(self, admin_session):
        r = admin_session.get(f"{API}/reports/rincian-belanja", timeout=15)
        assert r.status_code == 200
        groups = {g["sumber_dana"]: g for g in r.json()["groups"]}
        assert "K" in groups
        # Only belanja items should NOT be filtered (rincian-belanja shows all items by default)
        # Verify structure
        g = groups["K"]
        assert "items" in g and "total" in g
        assert any(i["kode_rekening"] == "2.2" for i in g["items"])

    def test_rincian_belanja_filter_kode(self, admin_session):
        r = admin_session.get(f"{API}/reports/rincian-belanja?kode_rekening=2.2", timeout=15)
        assert r.status_code == 200
        for g in r.json()["groups"]:
            for i in g["items"]:
                assert i["kode_rekening"] == "2.2"

    def test_arus_kas_input_save_and_get(self, admin_session):
        payload = {
            "periode": "2026-01", "sumber_dana": "K",
            "modal_awal": 500000, "penjualan": 200000, "penambahan_modal": 0,
            "kas_bulan_lalu_belum_disetor": 0, "sponsor_sisa": 0, "penambahan_lain": 0,
            "setoran_kas_bulan_lalu": 0, "setoran_kas_bulan_ini": 100000,
        }
        r = admin_session.post(f"{API}/arus-kas-input", json=payload, timeout=15)
        assert r.status_code == 200
        g = admin_session.get(f"{API}/arus-kas-input?periode=2026-01&sumber_dana=K", timeout=15)
        assert g.status_code == 200
        d = g.json()
        assert d.get("modal_awal") == 500000
        assert d.get("penjualan") == 200000

    def test_arus_kas_report(self, admin_session):
        r = admin_session.get(f"{API}/reports/arus-kas?periode=2026-01&sumber_dana=K", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["periode"] == "2026-01"
        assert len(d["groups"]) == 1
        g = d["groups"][0]
        assert g["sumber_dana"] == "K"
        # jumlah_penambahan should include modal_awal + penjualan = 700000
        assert g["jumlah_penambahan"] == 700000
        # belanja from any existing nota with sumber=K
        assert g["total_belanja"] >= 0
        # jumlah_pengeluaran = total_belanja + setoran_lalu + setoran_ini
        expected = g["total_belanja"] + g["setoran_kas_bulan_lalu"] + g["setoran_kas_bulan_ini"]
        assert round(g["jumlah_pengeluaran"], 2) == round(expected, 2)
        # kas_belum_disetor = jumlah_penambahan - jumlah_pengeluaran
        assert round(g["kas_belum_disetor"], 2) == round(g["jumlah_penambahan"] - g["jumlah_pengeluaran"], 2)

    def test_arus_kas_all_sumber(self, admin_session):
        r = admin_session.get(f"{API}/reports/arus-kas?periode=2026-01", timeout=15)
        assert r.status_code == 200
        groups = r.json()["groups"]
        codes = {g["sumber_dana"] for g in groups}
        # should include all seeded sources
        assert {"K", "TF", "KOP", "PENG"}.issubset(codes)

    def test_summary(self, admin_session):
        r = admin_session.get(f"{API}/reports/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_pendapatan", "total_pengeluaran", "saldo", "jumlah_nota"):
            assert k in d


# ---------------- user mgmt ----------------
class TestUserMgmt:
    def test_create_and_role_check(self, admin_session, created_ids):
        uname = f"testuser_{int(time.time())}"
        r = admin_session.post(f"{API}/users",
                               json={"username": uname, "password": "secret123",
                                     "name": "TEST User", "role": "user"}, timeout=15)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        created_ids["users"].append((uid, uname))

        # non-admin cannot list users
        s = requests.Session()
        lr = s.post(f"{API}/auth/login", json={"username": uname, "password": "secret123"}, timeout=15)
        assert lr.status_code == 200
        s.headers.update({"Authorization": f"Bearer {lr.json()['token']}"})
        r2 = s.get(f"{API}/users", timeout=15)
        assert r2.status_code == 403


# ---------------- cleanup ----------------
class TestZCleanup:
    def test_cleanup(self, admin_session, created_ids):
        for nid in created_ids["notas"]:
            admin_session.delete(f"{API}/nota/{nid}")
        for uid, _ in created_ids["users"]:
            admin_session.delete(f"{API}/users/{uid}")
        for kind in ("kode-rekening", "kegiatan", "item-barang", "sumber-dana"):
            lst = admin_session.get(f"{API}/master/{kind}").json()
            for d in lst:
                nama = d.get("nama", "") or ""
                kode = d.get("kode", "") or ""
                if nama.startswith("TEST") or kode.startswith("TEST") or "TEST" in kode:
                    admin_session.delete(f"{API}/master/{kind}/{d['id']}")
