from app.services.auction.decision import Decision, parse_decision


def test_parses_plain_json() -> None:
    assert parse_decision('{"bid": 125, "reason": "ok"}') == Decision(125, "ok")


def test_extracts_json_from_prose() -> None:
    text = 'Sure! Here you go: {"bid": 10, "reason": "cheap"} hope it helps'
    assert parse_decision(text) == Decision(10, "cheap")


def test_numeric_string_and_float_are_floored() -> None:
    assert parse_decision('{"bid": "120"}') == Decision(120, "")
    assert parse_decision('{"bid": 125.9}') == Decision(125, "")
    assert parse_decision('{"bid": "99.5"}') == Decision(99, "")


def test_negative_or_non_numeric_bid_is_none() -> None:
    assert parse_decision('{"bid": -1}') is None
    assert parse_decision('{"bid": "abc"}') is None
    assert parse_decision('{"reason": "x"}') is None
    assert parse_decision('{"bid": null}') is None
    assert parse_decision('{"bid": true}') is None
    assert parse_decision('{"bid": [1]}') is None
    assert parse_decision('{"bid": "nan"}') is None
    assert parse_decision('{"bid": 1e999}') is None


def test_reason_cut_to_100() -> None:
    decision = parse_decision('{"bid": 1, "reason": "' + "a" * 150 + '"}')
    assert decision is not None
    assert len(decision.reason) == 100


def test_non_string_reason_becomes_empty() -> None:
    assert parse_decision('{"bid": 1, "reason": 5}') == Decision(1, "")


def test_invalid_json_is_none() -> None:
    assert parse_decision("no json here") is None
    assert parse_decision("{not json}") is None
    assert parse_decision("") is None
    assert parse_decision("[1, 2]") is None
