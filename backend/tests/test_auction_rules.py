import copy

from app.services.auction.decision import Decision
from app.services.auction.rules import (
    Answer,
    classify,
    compute_standings,
    resolve_round,
)


def lot(number, item="Fox", quality=5, required=True, status="open"):
    return {
        "number": number,
        "item": item,
        "quality": quality,
        "required": required,
        "status": status,
        "sold_to": None,
        "sold_to_name": None,
        "price": None,
        "sold_in_round": None,
    }


def player(ref, budget=100, items=None):
    return {"player_ref": ref, "name": ref.upper(), "budget": budget, "items": items or []}


def session(lots_count=2, current_round=1, highest=0, leader=None, void=0, max_rounds=3):
    return {
        "settings": {"budget": 100, "lots_count": lots_count, "max_rounds": max_rounds},
        "lots": [lot(i + 1, item=f"Item{i + 1}") for i in range(lots_count)],
        "auction": {
            "lot_number": 1,
            "current_round": current_round,
            "highest_bid": highest,
            "leader_ref": leader,
            "leader_name": leader.upper() if leader else None,
            "void_rounds": void,
        },
        "roster": [player("a"), player("b"), player("c")],
    }


def ans(ref, bid, ms=100.0):
    decision = None if bid is None else Decision(bid=bid, reason="r")
    return Answer(player_ref=ref, name=ref.upper(), decision=decision, response_ms=ms)


def buyer(result, ref):
    return next(p for p in result.roster if p["player_ref"] == ref)


def test_classify_bid_equal_to_budget_is_valid_and_one_over_is_over_budget():
    assert classify(Decision(50, "x"), 10, 50) == "valid"
    assert classify(Decision(51, "x"), 10, 50) == "over_budget"


def test_classify_pass_and_not_higher():
    assert classify(Decision(0, "x"), 10, 50) == "pass"
    assert classify(Decision(10, "x"), 10, 50) == "not_higher"
    assert classify(Decision(5, "x"), 10, 50) == "not_higher"
    assert classify(None, 10, 50) == "no_answer"


def test_highest_valid_bid_leads_and_round_advances():
    s = session()
    r = resolve_round(s, [ans("a", 10), ans("b", 20), ans("c", 0)])
    assert r.outcomes == {"a": "outbid", "b": "leading", "c": "pass"}
    assert r.sale is None and not r.unsold and not r.void and not r.finished
    assert r.auction["highest_bid"] == 20
    assert r.auction["leader_ref"] == "b"
    assert r.auction["leader_name"] == "B"
    assert r.auction["current_round"] == 2
    assert r.auction["lot_number"] == 1


def test_tie_goes_to_faster_answer():
    r = resolve_round(session(), [ans("a", 20, 300), ans("b", 20, 100)])
    assert r.outcomes == {"a": "outbid", "b": "leading"}
    assert r.auction["leader_ref"] == "b"


def test_no_new_bid_sells_to_leader_and_charges_budget():
    s = session(current_round=2, highest=30, leader="a")
    r = resolve_round(s, [ans("a", 0), ans("b", 30), ans("c", None)])
    assert r.outcomes == {"a": "pass", "b": "not_higher", "c": "no_answer"}
    assert r.sale == {"buyer_ref": "a", "buyer_name": "A", "price": 30, "round": 2}
    assert buyer(r, "a")["budget"] == 70
    assert buyer(r, "a")["items"] == [
        {"item": "Item1", "quality": 5, "required": True, "lot_number": 1, "price": 30}
    ]
    sold = r.lots[0]
    assert (sold["status"], sold["sold_to"], sold["sold_to_name"]) == ("sold", "a", "A")
    assert (sold["price"], sold["sold_in_round"]) == (30, 2)
    assert r.auction == {
        "lot_number": 2,
        "current_round": 1,
        "highest_bid": 0,
        "leader_ref": None,
        "leader_name": None,
        "void_rounds": 0,
    }
    assert not r.finished


def test_leader_outbidding_self_keeps_lot_open():
    s = session(current_round=2, highest=30, leader="a")
    r = resolve_round(s, [ans("a", 40), ans("b", 0)])
    assert r.outcomes["a"] == "leading"
    assert r.sale is None
    assert r.auction["highest_bid"] == 40
    assert r.auction["leader_ref"] == "a"
    assert r.auction["current_round"] == 3


def test_last_round_sells_to_round_winner():
    s = session(current_round=3, highest=30, leader="a")
    r = resolve_round(s, [ans("a", 0), ans("b", 45), ans("c", 40)])
    assert r.outcomes == {"a": "pass", "b": "leading", "c": "outbid"}
    assert r.sale == {"buyer_ref": "b", "buyer_name": "B", "price": 45, "round": 3}
    assert buyer(r, "b")["budget"] == 55
    assert r.auction["lot_number"] == 2


def test_no_bids_without_leader_is_unsold_and_moves_on():
    r = resolve_round(session(), [ans("a", 0), ans("b", 0), ans("c", 500)])
    assert r.outcomes == {"a": "pass", "b": "pass", "c": "over_budget"}
    assert r.unsold and r.sale is None and not r.void
    assert r.lots[0]["status"] == "unsold"
    assert [p["budget"] for p in r.roster] == [100, 100, 100]
    assert r.auction["lot_number"] == 2
    assert r.auction["current_round"] == 1


def test_last_lot_sale_finishes_game():
    s = session(lots_count=1, current_round=2, highest=10, leader="a")
    r = resolve_round(s, [ans("a", 0)])
    assert r.sale is not None
    assert r.auction is None
    assert r.finished


def test_last_lot_unsold_finishes_game():
    r = resolve_round(session(lots_count=1), [ans("a", 0)])
    assert r.unsold and r.auction is None and r.finished


def test_all_no_answer_is_void_and_increments_counter():
    s = session(current_round=2, highest=30, leader="a", void=1)
    before = copy.deepcopy(s)
    r = resolve_round(s, [ans("a", None), ans("b", None), ans("c", None)])
    assert r.void and r.sale is None and not r.unsold and not r.finished
    assert set(r.outcomes.values()) == {"no_answer"}
    assert r.auction == {**before["auction"], "void_rounds": 2}
    assert r.lots == before["lots"]
    assert r.roster == before["roster"]


def test_answer_after_void_resets_counter():
    s = session(void=2)
    r = resolve_round(s, [ans("a", None), ans("b", 10)])
    assert r.auction["void_rounds"] == 0
    s = session(void=2, current_round=2, highest=10, leader="a")
    r = resolve_round(s, [ans("a", 0)])
    assert r.auction["void_rounds"] == 0


def test_inputs_are_not_mutated():
    s = session(current_round=2, highest=30, leader="a")
    before = copy.deepcopy(s)
    resolve_round(s, [ans("a", 0)])
    assert s == before


def item(name, quality, required=True):
    return {"item": name, "quality": quality, "required": required, "lot_number": 1, "price": 1}


def test_standings_duplicates_count_once_with_best_quality():
    roster = [player("a", 10, [item("Fox", 3), item("Fox", 8), item("Owl", 2)])]
    [row] = compute_standings(roster)
    assert (row["unique_required"], row["quality"], row["budget"]) == (2, 10, 10)
    assert row["rank"] == 1


def test_standings_tiebreak_quality_then_budget_and_shared_rank():
    roster = [
        player("a", 10, [item("Fox", 5)]),
        player("b", 10, [item("Fox", 7)]),
        player("c", 20, [item("Fox", 5)]),
        player("d", 20, [item("Fox", 5)]),
        player("e", 0, [item("Fox", 1), item("Owl", 1)]),
    ]
    rows = compute_standings(roster)
    assert [r["player_ref"] for r in rows] == ["e", "b", "c", "d", "a"]
    assert [r["rank"] for r in rows] == [1, 2, 3, 3, 5]


def test_not_required_items_do_not_score():
    roster = [player("a", 5, [item("Fox", 9, required=False)])]
    [row] = compute_standings(roster)
    assert (row["unique_required"], row["quality"]) == (0, 0)
