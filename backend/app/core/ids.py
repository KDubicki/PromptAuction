from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def parse_object_id(value: str, not_found: str = "Not found") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=404, detail=not_found) from exc
