import json
import math
from dataclasses import dataclass
from typing import Any

REASON_MAX_LENGTH = 100


@dataclass(frozen=True)
class Decision:
    bid: int
    reason: str


def _first_json_object(text: str) -> dict[str, Any] | None:
    decoder = json.JSONDecoder()
    index = text.find("{")
    while index != -1:
        try:
            value, _ = decoder.raw_decode(text, index)
        except ValueError:
            index = text.find("{", index + 1)
            continue
        return value
    return None


def _parse_bid(raw: Any) -> int | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, str):
        try:
            raw = float(raw.strip())
        except ValueError:
            return None
    if not isinstance(raw, (int, float)):
        return None
    if isinstance(raw, float) and not math.isfinite(raw):
        return None
    bid = math.floor(raw)
    return bid if bid >= 0 else None


def parse_decision(text: str) -> Decision | None:
    data = _first_json_object(text)
    if data is None:
        return None
    bid = _parse_bid(data.get("bid"))
    if bid is None:
        return None
    reason = data.get("reason")
    if not isinstance(reason, str):
        reason = ""
    return Decision(bid=bid, reason=reason[:REASON_MAX_LENGTH])
