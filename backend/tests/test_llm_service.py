from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.llm.manager import llm_manager
from app.services.llm_service import llm_service


async def test_llm_service_delegates_to_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_bids = [{"player_id": "p1", "bid_amount": 5.0}]
    monkeypatch.setattr(llm_manager, "generate_bids", AsyncMock(return_value=fake_bids))

    result = await llm_service.generate_bids(context={"foo": "bar"})

    assert result == [{"player_id": "p1", "bid_amount": 5.0}]
    llm_manager.generate_bids.assert_awaited_once_with({"foo": "bar"})
