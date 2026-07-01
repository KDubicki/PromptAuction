from __future__ import annotations

from bson import ObjectId

from app.models import GameSessionModel, PlayerBidModel
from app.schemas.common import object_id_to_str


def test_game_session_model_defaults() -> None:
    session = GameSessionModel(name="Test")
    assert session.status == "pending"
    assert session.accepted_prompt_ids == []
    assert session.current_round == 0
    assert session.current_iteration == 0


def test_player_bid_model_defaults() -> None:
    bid = PlayerBidModel(player_id="p1", item_name="Sword", bid_amount=10.0)
    assert bid.won is False


def test_object_id_to_str_with_none() -> None:
    assert object_id_to_str(None) is None


def test_object_id_to_str_with_objectid() -> None:
    oid = ObjectId()
    assert object_id_to_str(oid) == str(oid)


def test_object_id_to_str_with_str() -> None:
    assert object_id_to_str("abc123") == "abc123"
