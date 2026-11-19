import copy
from dataclasses import dataclass
from typing import Any

from app.services.auction.decision import Decision


@dataclass(frozen=True)
class Answer:
    player_ref: str
    name: str
    decision: Decision | None
    response_ms: float


@dataclass
class RoundResult:
    outcomes: dict[str, str]
    void: bool
    sale: dict[str, Any] | None
    unsold: bool
    auction: dict[str, Any] | None
    lots: list[dict[str, Any]]
    roster: list[dict[str, Any]]
    finished: bool


def classify(decision: Decision | None, highest_bid: int, budget: int) -> str:
    if decision is None:
        return "no_answer"
    if decision.bid == 0:
        return "pass"
    if decision.bid <= highest_bid:
        return "not_higher"
    if decision.bid > budget:
        return "over_budget"
    return "valid"


def _next_auction(auction: dict[str, Any], lots_count: int) -> dict[str, Any] | None:
    next_number = auction["lot_number"] + 1
    if next_number > lots_count:
        return None
    return {
        "lot_number": next_number,
        "current_round": 1,
        "highest_bid": 0,
        "leader_ref": None,
        "leader_name": None,
        "void_rounds": 0,
    }


def resolve_round(session: dict[str, Any], answers: list[Answer]) -> RoundResult:
    auction = copy.deepcopy(session["auction"])
    lots = copy.deepcopy(session["lots"])
    roster = copy.deepcopy(session["roster"])
    max_rounds = session["settings"]["max_rounds"]
    budgets = {p["player_ref"]: p["budget"] for p in roster}

    outcomes = {
        a.player_ref: classify(a.decision, auction["highest_bid"], budgets.get(a.player_ref, 0))
        for a in answers
    }

    if answers and all(o == "no_answer" for o in outcomes.values()):
        auction["void_rounds"] += 1
        return RoundResult(outcomes, True, None, False, auction, lots, roster, False)

    auction["void_rounds"] = 0
    valid = [a for a in answers if outcomes[a.player_ref] == "valid"]
    sale_ref: str | None = None
    sale_name: str | None = None
    price = 0

    if valid:
        winner = min(valid, key=lambda a: (-a.decision.bid, a.response_ms))  # type: ignore[union-attr]
        for a in valid:
            outcomes[a.player_ref] = "leading" if a is winner else "outbid"
        auction["highest_bid"] = winner.decision.bid  # type: ignore[union-attr]
        auction["leader_ref"] = winner.player_ref
        auction["leader_name"] = winner.name
        if auction["current_round"] >= max_rounds:
            sale_ref, sale_name, price = winner.player_ref, winner.name, auction["highest_bid"]
        else:
            auction["current_round"] += 1
            return RoundResult(outcomes, False, None, False, auction, lots, roster, False)
    elif auction["leader_ref"] is not None:
        sale_ref = auction["leader_ref"]
        sale_name = auction["leader_name"]
        price = auction["highest_bid"]

    lot = next(lt for lt in lots if lt["number"] == auction["lot_number"])
    sale: dict[str, Any] | None = None
    if sale_ref is not None:
        sale = {
            "buyer_ref": sale_ref,
            "buyer_name": sale_name,
            "price": price,
            "round": auction["current_round"],
        }
        lot.update(
            status="sold",
            sold_to=sale_ref,
            sold_to_name=sale_name,
            price=price,
            sold_in_round=auction["current_round"],
        )
        buyer = next(p for p in roster if p["player_ref"] == sale_ref)
        buyer["budget"] -= price
        buyer["items"] = [
            *buyer["items"],
            {
                "item": lot["item"],
                "quality": lot["quality"],
                "required": lot["required"],
                "lot_number": lot["number"],
                "price": price,
            },
        ]
    else:
        lot["status"] = "unsold"

    next_auction = _next_auction(auction, len(lots))
    return RoundResult(
        outcomes, False, sale, sale is None, next_auction, lots, roster, next_auction is None
    )


def compute_standings(roster: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for p in roster:
        best: dict[str, int] = {}
        for it in p.get("items", []):
            if it["required"]:
                best[it["item"]] = max(best.get(it["item"], 0), it["quality"])
        rows.append(
            {
                "player_ref": p["player_ref"],
                "name": p["name"],
                "unique_required": len(best),
                "quality": sum(best.values()),
                "budget": p["budget"],
            }
        )
    rows.sort(key=lambda r: (-r["unique_required"], -r["quality"], -r["budget"], r["name"]))
    previous: tuple[int, int, int] | None = None
    rank = 0
    for position, row in enumerate(rows, start=1):
        key = (row["unique_required"], row["quality"], row["budget"])
        if key != previous:
            rank = position
            previous = key
        row["rank"] = rank
    return rows
