from app.services.auction.catalog import ITEM_NAMES, generate_lots


def test_item_names_unique_and_enough() -> None:
    assert len(ITEM_NAMES) >= 60
    assert len(set(ITEM_NAMES)) == len(ITEM_NAMES)


def test_lot_count_numbering_and_quality_range() -> None:
    lots, _ = generate_lots(12, seed=1)
    assert [lot["number"] for lot in lots] == list(range(1, 13))
    assert all(1 <= lot["quality"] <= 10 for lot in lots)
    first = lots[0]
    assert first["status"] == "pending"
    assert first["sold_to"] is None
    assert first["sold_to_name"] is None
    assert first["price"] is None
    assert first["sold_in_round"] is None


def test_every_type_appears_and_pool_size() -> None:
    lots, _ = generate_lots(12, seed=2)
    types = {lot["item"] for lot in lots}
    assert len(types) == 8


def test_required_share() -> None:
    lots, required = generate_lots(12, seed=3)
    assert len({lot["item"] for lot in lots}) == 8
    assert len(required) == 6
    lots, required = generate_lots(1, seed=3)
    assert len(lots) == 1
    assert required == [lots[0]["item"]]
    assert lots[0]["required"] is True


def test_required_items_sorted_and_match_lots() -> None:
    lots, required = generate_lots(20, seed=4)
    assert required == sorted(required)
    assert {lot["item"] for lot in lots if lot["required"]} == set(required)


def test_same_seed_same_lots_different_seed_differs() -> None:
    assert generate_lots(15, seed=7) == generate_lots(15, seed=7)
    assert generate_lots(15, seed=7) != generate_lots(15, seed=8)


def test_more_types_than_names_get_suffixes() -> None:
    lots, _ = generate_lots(200, seed=5)
    types = {lot["item"] for lot in lots}
    assert len(types) == 120
    assert any(t.endswith(" II") for t in types)
