from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from app.schemas.google_forms import (
    GoogleFormConnectRequest,
    GoogleFormStatus,
    GoogleFormSyncResult,
    PublicEntryForm,
)
from app.services.google_forms import GoogleFormsError, google_forms_service

router = APIRouter(tags=["google-forms"])


def _http_error(e: GoogleFormsError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/admin/google-form", response_model=GoogleFormStatus)
async def get_google_form_status() -> GoogleFormStatus:
    return await google_forms_service.status()


@router.put("/admin/google-form", response_model=GoogleFormStatus)
async def connect_google_form(payload: GoogleFormConnectRequest) -> GoogleFormStatus:
    try:
        return await google_forms_service.connect(payload.url)
    except GoogleFormsError as e:
        raise _http_error(e) from e


@router.post("/admin/google-form/sync", response_model=GoogleFormSyncResult)
async def sync_google_form() -> GoogleFormSyncResult:
    try:
        return await google_forms_service.sync_once()
    except GoogleFormsError as e:
        raise _http_error(e) from e


@router.delete("/admin/google-form", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_google_form() -> Response:
    try:
        await google_forms_service.disconnect()
    except GoogleFormsError as e:
        raise _http_error(e) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/entry-form", response_model=PublicEntryForm)
async def get_public_entry_form() -> PublicEntryForm:
    form = await google_forms_service.public_entry_form()
    if form is None:
        raise HTTPException(status_code=404, detail="No entry form is connected")
    return form
