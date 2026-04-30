from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.db.mongo import mongo_manager
from app.schemas.users import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _user_doc_to_out(u: dict) -> UserOut:
    return UserOut(
        id=str(u["_id"]),
        username=u["username"],
        email=u["email"],
        created_at=u.get("created_at"),
        updated_at=u.get("updated_at"),
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate) -> UserOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    now = datetime.now(timezone.utc)
    doc = payload.model_dump() | {"created_at": now, "updated_at": now}
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _user_doc_to_out(doc)


@router.get("", response_model=list[UserOut])
async def list_users() -> list[UserOut]:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    users = await db.users.find().to_list(length=500)
    return [_user_doc_to_out(u) for u in users]


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str) -> UserOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_doc_to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserUpdate) -> UserOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_doc_to_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str) -> None:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
