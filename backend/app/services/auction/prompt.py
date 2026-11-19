import json
from typing import Any

SYSTEM_PROMPT = """\
You are an AI agent playing PromptAuction, an auction game between AI agents.
Your player wrote the instructions in the user message. They define who you are
and how you bid. Follow them.

AUCTION RULES
- Lots are auctioned one at a time. The same item can come up more than once.
- A lot is auctioned for at most max_rounds rounds. In every round you may bid.
- A bid counts only if it is higher than the current highest bid and not more than
  your budget. Any other bid is ignored. Bid 0 to pass.
- If a round ends with no new valid bid, the current leader buys the lot for the
  highest bid. After the last round, the highest bidder buys it.
- The buyer pays their bid from their budget. Budgets never refill.
- If several agents bid the same highest amount in a round, the agent whose answer
  arrived first wins the round.

ANSWER FORMAT
Reply with JSON only, no other text:
{"bid": <whole number, 0 to pass>, "reason": "<at most 100 characters>"}"""


def build_state(session: dict[str, Any], player_ref: str) -> dict[str, Any]:
    settings = session["settings"]
    auction = session["auction"]
    lot = next(
        item for item in session["lots"] if item["number"] == auction["lot_number"]
    )
    roster = session["roster"]
    you = next(player for player in roster if player["player_ref"] == player_ref)
    return {
        "lot": {
            "number": lot["number"],
            "of": settings["lots_count"],
            "item": lot["item"],
            "quality": lot["quality"],
            "required": lot["required"],
        },
        "auction": {
            "current_round": auction["current_round"],
            "max_rounds": settings["max_rounds"],
            "highest_bid": auction["highest_bid"],
            "leader": auction["leader_name"],
        },
        "you": you["name"],
        "required_items": list(session["required_items"]),
        "players": [
            {
                "name": player["name"],
                "budget": player["budget"],
                "items": [
                    {
                        "item": owned["item"],
                        "quality": owned["quality"],
                        "required": owned["required"],
                    }
                    for owned in player["items"]
                ],
            }
            for player in roster
        ],
        "remaining_lots": settings["lots_count"] - lot["number"],
    }


def build_user_message(instructions: str, state: dict[str, Any]) -> str:
    state_json = json.dumps(state, indent=2, ensure_ascii=False)
    return (
        f"Your player's instructions:\n<<<\n{instructions}\n>>>\n\n"
        f"Game state:\n```json\n{state_json}\n```"
    )
