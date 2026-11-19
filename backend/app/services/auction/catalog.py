import math
import random
from typing import Any

ITEM_NAMES: tuple[str, ...] = (
    "Dragon Scale Shield", "Elven Longbow", "Dwarven War Hammer", "Phoenix Feather",
    "Crystal Staff", "Shadow Cloak", "Amulet of Dawn", "Ring of Whispers",
    "Goblin King's Crown", "Mithril Chainmail", "Enchanted Lantern", "Basilisk Fang",
    "Wyvern Saddle", "Moonstone Pendant", "Griffin Talon", "Runed Greatsword",
    "Potion of Giants", "Siren's Harp", "Orb of Storms", "Troll Bone Club",
    "Unicorn Horn", "Witch's Cauldron", "Banshee's Veil", "Golem Core",
    "Frostbite Dagger", "Sunfire Gauntlets", "Necromancer's Tome", "Kraken Eye",
    "Hydra Venom Vial", "Silver Stake", "Mermaid's Comb", "Titan's Belt",
    "Cursed Mirror", "Starlight Compass", "Ember Crown", "Thunder Spear",
    "Spirit Lantern", "Oakheart Wand", "Vampire's Goblet", "Minotaur Axe",
    "Pegasus Bridle", "Obsidian Mask", "Fae Lantern", "Chimera Horn",
    "Alchemist's Satchel", "Boots of Swiftness", "Helm of the Deep", "Seer's Crystal Ball",
    "Cerberus Collar", "Lich's Phylactery", "Golden Fleece", "Nymph's Flute",
    "Sandstorm Scimitar", "Rune Stone Tablet", "Warlock's Grimoire", "Ghost Ship Bell",
    "Treant Seed", "Angel's Halo", "Demon Contract", "Sphinx Riddle Scroll",
    "Pixie Dust Pouch", "Leviathan Pearl", "Giant's Harp", "Valkyrie Spear",
)

_ROMAN = (
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
    (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
)


def _roman(number: int) -> str:
    result = ""
    for value, symbol in _ROMAN:
        while number >= value:
            result += symbol
            number -= value
    return result


def _type_name(index: int) -> str:
    cycle, position = divmod(index, len(ITEM_NAMES))
    name = ITEM_NAMES[position]
    return name if cycle == 0 else f"{name} {_roman(cycle + 1)}"


def generate_lots(lots_count: int, seed: int) -> tuple[list[dict[str, Any]], list[str]]:
    rng = random.Random(seed)
    k = max(1, math.ceil(lots_count * 0.6))
    order = list(range(len(ITEM_NAMES)))
    rng.shuffle(order)
    names: list[str] = []
    for i in range(k):
        cycle, position = divmod(i, len(ITEM_NAMES))
        names.append(_type_name(cycle * len(ITEM_NAMES) + order[position]))

    required_count = max(1, round(k * 0.7))
    required = set(rng.sample(names, required_count))

    types = list(names)
    types.extend(rng.choice(names) for _ in range(max(0, lots_count - k)))
    types = types[:max(lots_count, 1)]
    rng.shuffle(types)

    lots: list[dict[str, Any]] = [
        {
            "number": number,
            "item": item,
            "quality": rng.randint(1, 10),
            "required": item in required,
            "status": "pending",
            "sold_to": None,
            "sold_to_name": None,
            "price": None,
            "sold_in_round": None,
        }
        for number, item in enumerate(types, start=1)
    ]
    return lots, sorted(required)
