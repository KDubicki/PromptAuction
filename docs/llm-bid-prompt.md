# Przykładowy prompt wysyłany do LLM

W każdej rundzie licytacji silnik wysyła **osobne zapytanie dla każdego gracza**, wszystkie naraz. Każde zapytanie ma dwie części:

- **prompt systemowy:** tylko podstawy — czym jest gra, zasady licytacji i format odpowiedzi. Taki sam dla wszystkich graczy i rund. **Nie mówi, jak wygrać** ani co oznaczają pola przedmiotów (np. `required`).
- **wiadomość użytkownika:** prompt agenta napisany przez gracza oraz aktualne dane gry w JSON.

**Prompt agenta pisze gracz i to on jest całą strategią.** Musi zawierać:
- **personę** agenta (kim jest, jaki ma charakter),
- **co agent ma sprawdzać** w danych gry (np. czy przedmiot ma `required: true`, ile zostało budżetu, co mają rywale),
- **na podstawie czego licytować** (kiedy podbijać, do jakiej kwoty, kiedy pasować).

Gracz, który nie wyjaśni agentowi, że liczą się tylko przedmioty `required: true`, ryzykuje wydanie budżetu na przedmioty bez wartości.

Poniżej pełny przykład dla gracza **Aurelia**: przedmiot 3 z 12, runda 4 z 10.

---

## 1. Prompt systemowy

```text
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
{"bid": <whole number, 0 to pass>, "reason": "<at most 100 characters>"}
```

## 2. Wiadomość użytkownika

````text
Your player's instructions:
<<<
You are Aurelia, a patient, calculating collector who hates wasting money.
Check every lot: only items with "required": true help me win, so pass on anything else.
Also check "required_items" and my own "items": if I already own this item, only bid
when the new copy has higher quality, and never more than 50.
Until I own 3 different required items, never bid more than 15% of my budget on one lot.
After that, go up to 40% for quality 7 or higher.
If a rival has much more budget than me, stop early and save for the next lot.
>>>

Game state:
```json
{
  "lot": {"number": 3, "of": 12, "item": "Crystal Fox", "quality": 7, "required": true},
  "auction": {"current_round": 4, "max_rounds": 10, "highest_bid": 120, "leader": "Kestrel"},
  "you": "Aurelia",
  "required_items": ["Crystal Fox", "Echo Blade", "Nebula Coin", "Ember Crown", "Moon Lantern"],
  "players": [
    {"name": "Aurelia", "budget": 870, "items": [{"item": "Echo Blade", "quality": 5, "required": true}]},
    {"name": "Kestrel", "budget": 640, "items": [
      {"item": "Rusty Gear", "quality": 3, "required": false},
      {"item": "Nebula Coin", "quality": 8, "required": true}
    ]},
    {"name": "Morrow", "budget": 1000, "items": []}
  ],
  "remaining_lots": 9
}
```
````

## 3. Oczekiwana odpowiedź modelu

```json
{"bid": 125, "reason": "Required, new for me; under 15% cap (130) while I own fewer than 3"}
```

---

## Jak silnik traktuje odpowiedź

| Odpowiedź | Co się dzieje |
|---|---|
| `bid` większy niż `highest_bid` i nie większy niż `budget` | Oferta ważna. Najwyższa ważna oferta w rundzie obejmuje prowadzenie; przy remisie wygrywa szybsza odpowiedź. |
| `bid` równy 0 | Pas. |
| `bid` nie większy niż `highest_bid` | Ignorowana (nie przebija ceny). |
| `bid` większy niż `budget` | Ignorowana (ponad budżet). |
| Niepoprawny JSON, błąd lub brak odpowiedzi | Gracz nie licytuje w tej rundzie („pech”). |
| `reason` dłuższy niż 100 znaków | Przycięty do 100 znaków. |
| `bid` z częścią ułamkową | Zaokrąglony w dół do pełnych punktów. |

Prowadzący może przebić sam siebie. Licytacja toczy się wtedy dalej.

## Pola JSON (wyjaśnienie dla graczy — model tego opisu nie dostaje)

| Pole | Znaczenie |
|---|---|
| `lot.number` / `lot.of` | Który to przedmiot w sesji i ile jest wszystkich. |
| `lot.item` | Typ przedmiotu (może się powtarzać w sesji). |
| `lot.quality` | Jakość tego egzemplarza, 1–10. |
| `lot.required` | Czy typ liczy się do zwycięstwa. |
| `auction.current_round` / `auction.max_rounds` | Runda licytacji tego przedmiotu i ich maksymalna liczba. |
| `auction.highest_bid` | Obecna najwyższa oferta (0, gdy nikt jeszcze nie licytował). |
| `auction.leader` | Kto prowadzi (`null`, gdy nikt). |
| `you` | Nazwa gracza, w którego imieniu licytuje model. |
| `required_items` | Wszystkie wymagane typy w tej sesji (bez kolejności i liczby powtórzeń). |
| `players[].budget` | Pozostały budżet gracza. |
| `players[].items` | Kupione przedmioty z jakością i flagą `required`. |
| `remaining_lots` | Ile przedmiotów zostało do licytacji po bieżącym. |
