from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import jwt
import bcrypt
import io
import pandas as pd

# ---------------------------------------------------------------------------
# DB setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mongo helpers
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        return cls(**doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data


def now_utc() -> datetime:
    return datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Auth utils
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, username: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "username": username, "ver": token_version,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User tidak ditemukan")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengakses")
    return user

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "user"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class KodeRekening(BaseModel):
    kode: str
    nama: str
    jenis: str  # pendapatan | pengeluaran


class Kegiatan(BaseModel):
    nama: str
    keterangan: Optional[str] = ""


class ItemBarang(BaseModel):
    nama: str
    satuan: Optional[str] = "pcs"
    harga_default: Optional[float] = 0


class NotaItem(BaseModel):
    item_barang_id: Optional[str] = None
    nama: str
    unit: float = 1
    harga_per_unit: float = 0
    total: float = 0


class NotaCreate(BaseModel):
    nomor_nota: str
    tanggal_nota: str
    tanggal_bayar: Optional[str] = ""
    kode_rekening: str
    kode_rekening_nama: Optional[str] = ""
    jenis: str  # pendapatan | pengeluaran (derived from kode rekening)
    sumber_dana: str
    kegiatan: str
    items: List[NotaItem]
    total_nota: float = 0
    keterangan: Optional[str] = ""

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@api_router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    username = payload.username.strip().lower()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token(str(user["_id"]), username, user.get("token_version", 0))
    set_auth_cookie(response, token)
    return {"id": str(user["_id"]), "username": user["username"], "name": user.get("name", ""),
            "role": user.get("role", "user"), "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logout berhasil"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["_id"], "username": user["username"], "name": user.get("name", ""),
            "role": user.get("role", "user")}

# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------

@api_router.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"password_hash": 0}).to_list(500)
    return [{"id": str(u["_id"]), "username": u["username"], "name": u.get("name", ""),
             "role": u.get("role", "user")} for u in users]


@api_router.post("/users")
async def create_user(payload: UserCreate, admin: dict = Depends(require_admin)):
    username = payload.username.strip().lower()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    doc = {"username": username, "password_hash": hash_password(payload.password),
           "name": payload.name, "role": payload.role if payload.role in ("admin", "user") else "user",
           "token_version": 0, "created_at": now_utc().isoformat()}
    res = await db.users.insert_one(doc)
    return {"id": str(res.inserted_id), "username": username, "name": payload.name, "role": doc["role"]}


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin: dict = Depends(require_admin)):
    update = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.role in ("admin", "user"):
        update["role"] = payload.role
    if payload.password:
        update["password_hash"] = hash_password(payload.password)
        update["token_version"] = (await db.users.find_one({"_id": ObjectId(user_id)})).get("token_version", 0) + 1
    if update:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return {"message": "User diperbarui"}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["_id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"message": "User dihapus"}

# ---------------------------------------------------------------------------
# Master data: generic CRUD factory
# ---------------------------------------------------------------------------

MASTER_COLLECTIONS = {
    "kode-rekening": ("kode_rekening", KodeRekening),
    "kegiatan": ("kegiatan", Kegiatan),
    "item-barang": ("item_barang", ItemBarang),
}


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@api_router.get("/master/{kind}")
async def list_master(kind: str, user: dict = Depends(get_current_user)):
    if kind not in MASTER_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Jenis master data tidak dikenal")
    coll = MASTER_COLLECTIONS[kind][0]
    docs = await db[coll].find({}).sort("nama", 1).to_list(5000)
    return [_serialize(d) for d in docs]


@api_router.post("/master/{kind}")
async def create_master(kind: str, payload: dict, user: dict = Depends(get_current_user)):
    if kind not in MASTER_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Jenis master data tidak dikenal")
    coll, model = MASTER_COLLECTIONS[kind]
    obj = model(**payload)
    doc = obj.model_dump()
    doc["created_at"] = now_utc().isoformat()
    res = await db[coll].insert_one(doc)
    return _serialize({**doc, "_id": res.inserted_id})


@api_router.put("/master/{kind}/{item_id}")
async def update_master(kind: str, item_id: str, payload: dict, user: dict = Depends(get_current_user)):
    if kind not in MASTER_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Jenis master data tidak dikenal")
    coll, model = MASTER_COLLECTIONS[kind]
    obj = model(**payload)
    await db[coll].update_one({"_id": ObjectId(item_id)}, {"$set": obj.model_dump()})
    return {"message": "Data diperbarui"}


@api_router.delete("/master/{kind}/{item_id}")
async def delete_master(kind: str, item_id: str, user: dict = Depends(get_current_user)):
    if kind not in MASTER_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Jenis master data tidak dikenal")
    coll = MASTER_COLLECTIONS[kind][0]
    await db[coll].delete_one({"_id": ObjectId(item_id)})
    return {"message": "Data dihapus"}


@api_router.post("/master/{kind}/import")
async def import_master(kind: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if kind not in MASTER_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Jenis master data tidak dikenal")
    coll, model = MASTER_COLLECTIONS[kind]
    content = await file.read()
    try:
        if file.filename.lower().endswith(".csv"):
            dfr = pd.read_csv(io.BytesIO(content))
        else:
            dfr = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file: {e}")

    dfr.columns = [str(c).strip().lower().replace(" ", "_") for c in dfr.columns]
    inserted = 0
    errors = []
    for idx, row in dfr.iterrows():
        row = {k: ("" if pd.isna(v) else v) for k, v in row.to_dict().items()}
        try:
            if kind == "kode-rekening":
                jenis = str(row.get("jenis", "")).strip().lower()
                if jenis not in ("pendapatan", "pengeluaran"):
                    jenis = "pengeluaran"
                doc = {"kode": str(row.get("kode", "")).strip(), "nama": str(row.get("nama", "")).strip(), "jenis": jenis}
                if not doc["kode"] and not doc["nama"]:
                    continue
            elif kind == "kegiatan":
                doc = {"nama": str(row.get("nama", "")).strip(), "keterangan": str(row.get("keterangan", "")).strip()}
                if not doc["nama"]:
                    continue
            else:  # item-barang
                harga = row.get("harga_default", row.get("harga", 0))
                try:
                    harga = float(harga) if harga != "" else 0
                except Exception:
                    harga = 0
                doc = {"nama": str(row.get("nama", "")).strip(),
                       "satuan": str(row.get("satuan", "pcs")).strip() or "pcs",
                       "harga_default": harga}
                if not doc["nama"]:
                    continue
            doc["created_at"] = now_utc().isoformat()
            await db[coll].insert_one(doc)
            inserted += 1
        except Exception as e:
            errors.append(f"Baris {idx + 2}: {e}")
    return {"inserted": inserted, "errors": errors[:10],
            "message": f"{inserted} data berhasil diimport"}

# ---------------------------------------------------------------------------
# Nota endpoints
# ---------------------------------------------------------------------------

@api_router.post("/nota")
async def create_nota(payload: NotaCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    # recompute totals server-side
    total = 0.0
    for it in doc["items"]:
        it["total"] = round((it.get("unit") or 0) * (it.get("harga_per_unit") or 0), 2)
        total += it["total"]
    doc["total_nota"] = round(total, 2)
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = user.get("name") or user.get("username")
    res = await db.notas.insert_one(doc)
    return _serialize({**doc, "_id": res.inserted_id})


def _nota_filter(start, end, jenis, sumber_dana, kegiatan, kode_rekening):
    q = {}
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        q["tanggal_nota"] = rng
    if jenis and jenis != "all":
        q["jenis"] = jenis
    if sumber_dana and sumber_dana != "all":
        q["sumber_dana"] = sumber_dana
    if kegiatan and kegiatan != "all":
        q["kegiatan"] = kegiatan
    if kode_rekening and kode_rekening != "all":
        q["kode_rekening"] = kode_rekening
    return q


@api_router.get("/nota")
async def list_nota(user: dict = Depends(get_current_user),
                    start: Optional[str] = Query(None), end: Optional[str] = Query(None),
                    jenis: Optional[str] = Query(None), sumber_dana: Optional[str] = Query(None),
                    kegiatan: Optional[str] = Query(None), kode_rekening: Optional[str] = Query(None)):
    q = _nota_filter(start, end, jenis, sumber_dana, kegiatan, kode_rekening)
    docs = await db.notas.find(q).sort("tanggal_nota", -1).to_list(5000)
    return [_serialize(d) for d in docs]


@api_router.get("/nota/{nota_id}")
async def get_nota(nota_id: str, user: dict = Depends(get_current_user)):
    doc = await db.notas.find_one({"_id": ObjectId(nota_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Nota tidak ditemukan")
    return _serialize(doc)


@api_router.delete("/nota/{nota_id}")
async def delete_nota(nota_id: str, user: dict = Depends(get_current_user)):
    await db.notas.delete_one({"_id": ObjectId(nota_id)})
    return {"message": "Nota dihapus"}

# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@api_router.get("/reports/summary")
async def report_summary(user: dict = Depends(get_current_user),
                         start: Optional[str] = Query(None), end: Optional[str] = Query(None)):
    q = _nota_filter(start, end, None, None, None, None)
    docs = await db.notas.find(q).to_list(10000)
    pendapatan = sum(d["total_nota"] for d in docs if d.get("jenis") == "pendapatan")
    pengeluaran = sum(d["total_nota"] for d in docs if d.get("jenis") == "pengeluaran")
    return {"total_pendapatan": round(pendapatan, 2), "total_pengeluaran": round(pengeluaran, 2),
            "saldo": round(pendapatan - pengeluaran, 2), "jumlah_nota": len(docs)}


@api_router.get("/reports/pendapatan-pengeluaran")
async def report_pp(user: dict = Depends(get_current_user),
                    start: Optional[str] = Query(None), end: Optional[str] = Query(None),
                    sumber_dana: Optional[str] = Query(None), kegiatan: Optional[str] = Query(None)):
    q = _nota_filter(start, end, None, sumber_dana, kegiatan, None)
    docs = await db.notas.find(q).sort("tanggal_nota", 1).to_list(10000)
    pendapatan = [_serialize(d) for d in docs if d.get("jenis") == "pendapatan"]
    pengeluaran = [_serialize(d) for d in docs if d.get("jenis") == "pengeluaran"]
    total_p = sum(d["total_nota"] for d in pendapatan)
    total_e = sum(d["total_nota"] for d in pengeluaran)
    return {"pendapatan": pendapatan, "pengeluaran": pengeluaran,
            "total_pendapatan": round(total_p, 2), "total_pengeluaran": round(total_e, 2),
            "saldo": round(total_p - total_e, 2)}


@api_router.get("/reports/item-per-sumber-dana")
async def report_item_sumber(user: dict = Depends(get_current_user),
                             start: Optional[str] = Query(None), end: Optional[str] = Query(None)):
    q = _nota_filter(start, end, None, None, None, None)
    docs = await db.notas.find(q).to_list(10000)
    groups = {}
    for d in docs:
        sd = d.get("sumber_dana", "lainnya")
        g = groups.setdefault(sd, {"sumber_dana": sd, "items": [], "total": 0})
        for it in d.get("items", []):
            g["items"].append({
                "nomor_nota": d.get("nomor_nota"),
                "tanggal_nota": d.get("tanggal_nota"),
                "jenis": d.get("jenis"),
                "kegiatan": d.get("kegiatan"),
                "nama": it.get("nama"),
                "unit": it.get("unit"),
                "harga_per_unit": it.get("harga_per_unit"),
                "total": it.get("total"),
            })
            g["total"] += it.get("total", 0)
    result = sorted(groups.values(), key=lambda x: x["sumber_dana"])
    for g in result:
        g["total"] = round(g["total"], 2)
    return {"groups": result}

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    admin_username = os.environ.get("ADMIN_USERNAME", "admin").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"username": admin_username})
    if existing is None:
        await db.users.insert_one({
            "username": admin_username, "password_hash": hash_password(admin_password),
            "name": "Administrator", "role": "admin", "token_version": 0,
            "email": os.environ.get("ADMIN_EMAIL", ""), "created_at": now_utc().isoformat()})
        logger.info("Admin user seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"username": admin_username},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    # seed default kegiatan & kode rekening if empty
    if await db.kegiatan.count_documents({}) == 0:
        for n in ["Operasional", "Pengembangan", "Lainnya"]:
            await db.kegiatan.insert_one({"nama": n, "keterangan": "", "created_at": now_utc().isoformat()})


@api_router.get("/")
async def root():
    return {"message": "FinNota API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
