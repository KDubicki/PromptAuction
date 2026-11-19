import json
from pathlib import Path
from typing import Any

from app.services.auction.prompt import (
    SYSTEM_PROMPT,
    build_state,
    build_user_message,
)

DOC = Path(__file__).resolve().parents[2] / "docs" / "llm-bid-prompt.md"


def _doc_text() -> str:
    return DOC.read_text(encoding="utf-8")


def test_system_prompt_matches_doc() -> None:
    text = _doc_text()
    start = text.index("```text\n") + len("```text\n")
    end = text.index("\n```", start)
    assert SYSTEM_PROMPT == text[start:end]


def test_system_prompt_has_no_goal_or_required_semantics() -> None:
    assert "required" not in SYSTEM_PROMPT
    assert "GOAL" not in SYSTEM_PROMPT


def _lot(number: int, item: str, quality: int, required: bool) -> dict[str, Any]:
    return {
        "number": number,
        "item": item,
        "quality": quality,
        "required": required,
        "status": "pending",
        "sold_to": None,
        "sold_to_name": None,
        "price": None,
        "sold_in_round": None,
    }


def _session() -> dict[str, Any]:
    return {
        "lots": [
            _lot(1, "Rusty Gear", 3, False),
            _lot(2, "Nebula Coin", 8, True),
            _lot(3, "Crystal Fox", 7, True),
        ]
        + [_lot(n, "Moon Lantern", 5, True) for n in range(4, 13)],
        "required_items": [
            "Crystal Fox",
            "Echo Blade",
            "Ember Crown",
            "Moon Lantern",
            "Nebula Coin",
        ],
        "settings": {"budget": 1000, "lots_count": 12, "max_rounds": 10},
        "auction": {
            "lot_number": 3,
            "current_round": 4,
            "highest_bid": 120,
            "leader_ref": "p-kestrel",
            "leader_name": "Kestrel",
            "void_rounds": 0,
        },
        "roster": [
            {
                "player_ref": "p-aurelia",
                "name": "Aurelia",
                "prompt_text": "x",
                "budget": 870,
                "items": [
                    {
                        "item": "Echo Blade",
                        "quality": 5,
                        "required": True,
                        "lot_number": 1,
                        "price": 130,
                    }
                ],
            },
            {
                "player_ref": "p-kestrel",
                "name": "Kestrel",
                "prompt_text": "y",
                "budget": 640,
                "items": [
                    {
                        "item": "Rusty Gear",
                        "quality": 3,
                        "required": False,
                        "lot_number": 2,
                        "price": 10,
                    },
                    {
                        "item": "Nebula Coin",
                        "quality": 8,
                        "required": True,
                        "lot_number": 4,
                        "price": 20,
                    },
                ],
            },
            {
                "player_ref": "p-morrow",
                "name": "Morrow",
                "prompt_text": "z",
                "budget": 1000,
                "items": [],
            },
        ],
    }


EXPECTED_STATE: dict[str, Any] = {
    "lot": {
        "number": 3,
        "of": 12,
        "item": "Crystal Fox",
        "quality": 7,
        "required": True,
    },
    "auction": {
        "current_round": 4,
        "max_rounds": 10,
        "highest_bid": 120,
        "leader": "Kestrel",
    },
    "you": "Aurelia",
    "required_items": [
        "Crystal Fox",
        "Echo Blade",
        "Ember Crown",
        "Moon Lantern",
        "Nebula Coin",
    ],
    "players": [
        {
            "name": "Aurelia",
            "budget": 870,
            "items": [{"item": "Echo Blade", "quality": 5, "required": True}],
        },
        {
            "name": "Kestrel",
            "budget": 640,
            "items": [
                {"item": "Rusty Gear", "quality": 3, "required": False},
                {"item": "Nebula Coin", "quality": 8, "required": True},
            ],
        },
        {"name": "Morrow", "budget": 1000, "items": []},
    ],
    "remaining_lots": 9,
}


def test_build_state_matches_doc_example() -> None:
    state = build_state(_session(), "p-aurelia")
    assert state == EXPECTED_STATE
    assert list(state) == list(EXPECTED_STATE)
    assert list(state["lot"]) == list(EXPECTED_STATE["lot"])


def test_build_state_without_leader() -> None:
    session = _session()
    session["auction"]["leader_ref"] = None
    session["auction"]["leader_name"] = None
    session["auction"]["highest_bid"] = 0
    state = build_state(session, "p-morrow")
    assert state["auction"]["leader"] is None
    assert state["you"] == "Morrow"


def test_user_message_shape() -> None:
    state = build_state(_session(), "p-aurelia")
    message = build_user_message("Be bold.", state)
    expected = (
        "Your player's instructions:\n<<<\nBe bold.\n>>>\n\n"
        "Game state:\n```json\n"
        + json.dumps(state, indent=2, ensure_ascii=False)
        + "\n```"
    )
    assert message == expected
