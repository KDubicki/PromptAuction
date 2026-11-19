# Aukcja rosnąca z budżetem, jakością i przedmiotami wymaganymi: projekt

Data: 2026-11-19 · Baza: `main` (`9424a27`) · Przykładowy prompt: [`docs/llm-bid-prompt.md`](../../llm-bid-prompt.md)

## Cel i powód

Dziś jeden „lot” to jedna ślepa oferta, a zwycięzca nic nie płaci. Rundy i liczba licytacji są globalne. Budżet istnieje w konfiguracji, ale nie działa. Model nie wie nic o stanie gry.

Gra ma się stać aukcją angielską, w której gracze licytują swoimi promptami strategii:
- admin ustawia **na sesję**: budżet gracza, liczbę przedmiotów i maksymalną liczbę rund na przedmiot,
- przedmioty idą pod młotek po kolei, cena rośnie z rundy na rundę,
- zwycięzca płaci swoją ofertę z budżetu,
- wygrywa gracz z największą liczbą unikatowych przedmiotów wymaganych, a przy remisie z wyższą jakością.

## Cele

1. Sesja ma ustawienia: `budget` (punkty na gracza), `lots_count` (liczba przedmiotów), `max_rounds` (maks. rund na przedmiot). Liczba licytacji to maksymalnie `lots_count × max_rounds`.
2. Przy starcie sesja losuje przedmioty (typ, jakość 1–10, `required`) i daje każdemu graczowi budżet.
3. Jeden krok silnika to jedna runda bieżącej licytacji: osobne zapytanie dla każdego gracza, równolegle, z promptem z `docs/llm-bid-prompt.md`.
4. Reguły rundy, sprzedaży i budżetu zgodne z sekcją „Zasady”.
5. Odpowiedź modelu to JSON `{"bid", "reason"}`. Oferta i uzasadnienie są zapisywane.
6. Ranking sesji liczony według celu gry, widoczny w API i w panelu admina.

## Poza zakresem

- Strony Live game i Leaderboard w UI nadal pokazują dane przykładowe. Panel admina pokazuje stan gry i ranking.
- Sprzątanie globalnej konfiguracji gry (`game_rounds`, `game_iterations_per_round`, `bid_min`, `bid_max`, `starting_budget`, `item_categories`). Pola zostają, ale silnik ich już nie używa, z wyjątkiem `game_engine_sleep_seconds` i `item_theme` (motyw nazw).
- Kategorie przedmiotów (świadomie pominięte).
- Logowanie (BE-10).

## Czego nie wolno zepsuć

- Gracz nie może wydać więcej, niż ma. Budżet nigdy nie spada poniżej 0.
- Przedmiot nie może zostać sprzedany dwa razy ani komuś, kto nie prowadził.
- Prompt gracza nie może zmienić reguł. Silnik waliduje każdą ofertę niezależnie od tego, co napisał model.
- Przypięte wersje promptów (poprzedni projekt) nadal obowiązują.

## Rozważone podejścia

| | Podejście | Zyski | Koszty |
|---|---|---|---|
| **1 ✅ wybrane** | Cały stan gry w dokumencie sesji: `lots`, stan licytacji, `budget` i `items` w każdym wpisie `roster`. | Jedna atomowa aktualizacja na rundę, spójność, UI czyta jeden dokument. | Dokument sesji rośnie z liczbą przedmiotów (setki, nie tysiące, więc OK). |
| 2 | Osobna kolekcja `lots`. | Czytelna historia per przedmiot. | Zapisy w dwóch kolekcjach na krok; trzeba pilnować spójności budżetów. |
| 3 | Stan wyliczany z historii ofert. | Brak niespójności. | Coraz droższe kroki, najtrudniejsza logika. |

## Model danych (`game_sessions`)

Nowe pola:

| Pole | Typ | Uwagi |
|---|---|---|
| `settings.budget` | int, 1–1 000 000 | domyślnie 1000 |
| `settings.lots_count` | int, 1–500 | domyślnie 12 |
| `settings.max_rounds` | int, 1–100 | domyślnie 10 |
| `required_items` | list[str] | wymagane typy w sesji, ustawiane przy starcie |
| `lots` | list | ustawiane przy starcie, patrz niżej |
| `auction` | obiekt \| null | stan bieżącej licytacji, patrz niżej |
| `roster[].budget` | int | ustawiane przy starcie na `settings.budget` |
| `roster[].items` | list | kupione egzemplarze `{item, quality, required, lot_number, price}` |
| `standings` | list | liczone po każdej sprzedaży, patrz „Ranking” |

`settings` można zmieniać tylko w statusie `pending` (`PATCH`). Tworzenie sesji przyjmuje je opcjonalnie.

`lots[i]`: `{number, item, quality, required, status: "pending"|"sold"|"unsold", sold_to (player_ref|null), sold_to_name, price, sold_in_round}`.

`auction`: `{lot_number, current_round, highest_bid, leader_ref, leader_name}`. `highest_bid = 0` i `leader_ref = null`, gdy nikt nie licytował. `null` po zakończeniu gry.

Pola `current_round` i `current_iteration` z sesji przestają mieć znaczenie, a zastępuje je `auction`. Zostają w dokumencie tylko dla zgodności.

### Oferty (`player_bids`)

Każda odpowiedź gracza w rundzie, także pas i ignorowana, to jeden dokument:
`{session_id, lot_number, item, round, player_id (nazwa), player_ref, bid (int|null), reason (≤100), response_ms, outcome, created_at}`.

`outcome` ∈ `"leading"` (objęła prowadzenie), `"outbid"` (ważna, ale przegrała rundę), `"pass"`, `"not_higher"`, `"over_budget"`, `"no_answer"` (błąd, zły JSON). Pole `won: true` dostaje oferta, za którą przedmiot został kupiony.

## Zasady

### Start sesji (rozszerza obecny `POST /start`)

Do warunków startu z poprzedniego projektu dochodzi generowanie przedmiotów:
1. Pula typów: `k = max(1, ceil(lots_count × 0.6))`, nazwy losowane bez powtórzeń z wbudowanej listy dla `item_theme` (lista ≥ 60 nazw; dla motywu nieznanego używamy listy „fantasy”). Gdy `k` przekracza długość listy, nazwy dostają przyrostek „ II”, „ III”.
2. `required`: losowo ok. 70% typów jest wymaganych, zawsze co najmniej jeden.
3. Egzemplarze: pierwsze `k` przedmiotów to po jednym egzemplarzu każdego typu, a pozostałe `lots_count − k` to losowe typy z puli (losowa liczba powtórzeń). Całość jest tasowana i numerowana od 1.
4. Jakość każdego egzemplarza: losowa liczba całkowita 1–10.
5. `required_items`: posortowana alfabetycznie lista wymaganych typów.
6. Każdy gracz w składzie: `budget = settings.budget`, `items = []`.
7. `auction = {lot_number: 1, current_round: 1, highest_bid: 0, leader_ref: null, leader_name: null}`.

Losowanie korzysta z `random.Random(seed)`, a `seed` zapisujemy w sesji, żeby wynik dało się odtworzyć w testach.

### Runda (krok silnika dla sesji `running`)

1. Dla każdego gracza w składzie, równolegle: prompt systemowy i wiadomość użytkownika dokładnie jak w `docs/llm-bid-prompt.md`, z JSON-em stanu z punktu widzenia tego gracza. Mierzymy `response_ms`.
   - **Prompt systemowy zawiera tylko podstawy** (decyzja właściciela): czym jest gra, zasady licytacji i format odpowiedzi. Nie opisuje celu gry, punktacji ani znaczenia pól przedmiotów (np. `required`). To gracz w swoim prompcie nadaje agentowi personę i pisze, co sprawdzać i na podstawie czego licytować.
2. Parsowanie odpowiedzi: pierwszy obiekt JSON w tekście, `bid` jako liczba zaokrąglona w dół do int, a `reason` jako tekst przycięty do 100 znaków. Brak lub błąd oznacza `no_answer`.
3. Walidacja: `bid == 0` → `pass`; `bid <= highest_bid` → `not_higher`; `bid > budget gracza` → `over_budget`; w przeciwnym razie oferta jest ważna.
4. Jeśli są ważne oferty: zwycięzca rundy to najwyższa oferta, a przy remisie najmniejsze `response_ms`. Dostaje `outcome = "leading"`, pozostałe ważne `"outbid"`. Stan licytacji: `highest_bid` i prowadzący ustawiani na zwycięzcę rundy.
   - Jeśli `current_round == max_rounds`: sprzedaż prowadzącemu.
   - W przeciwnym razie `current_round += 1`.
5. Jeśli nie ma ważnych ofert:
   - jest prowadzący → sprzedaż prowadzącemu za `highest_bid`,
   - nie ma prowadzącego → przedmiot `unsold`.
6. Sprzedaż: `lots[i].status = "sold"` (+ `sold_to`, `price`, `sold_in_round`), budżet kupującego `-= price`, egzemplarz dopisany do `items` kupującego, oferta kupującego z tego przedmiotu, która ustaliła cenę, dostaje `won: true`, przeliczenie `standings`.
7. Po sprzedaży albo braku sprzedaży: następny przedmiot (`lot_number += 1`, `current_round = 1`, `highest_bid = 0`, brak prowadzącego). Po ostatnim przedmiocie `status = "completed"`, `auction = null`.
8. Cały wynik rundy zapisujemy jednym `update_one` z warunkiem na `auction.lot_number` i `auction.current_round` sprzed rundy, żeby dwa nakładające się kroki nie rozliczyły rundy dwa razy. Oferty zapisujemy po udanym update.

Gracz z budżetem 0 nadal dostaje zapytanie (może tylko spasować), dzięki czemu zasady są jednolite.

### Awaria dostawcy LLM (decyzja projektanta)

- Każde zapytanie ma limit czasu **30 s**. Po jego przekroczeniu odpowiedź gracza to `no_answer`.
- Jeśli w rundzie **wszyscy** gracze mają `no_answer`, runda **się nie liczy**: stan licytacji zostaje bez zmian, nic nie jest sprzedawane, a oferty `no_answer` są zapisywane do wglądu. Licznik `auction.void_rounds` rośnie o 1. Po pierwszej rundzie z co najmniej jedną odpowiedzią wraca do 0.
- Po **3** kolejnych nieważnych rundach sesja przechodzi w `paused` z `pause_reason = "LLM provider failed 3 rounds in a row"`. Admin wznawia ją przez `PATCH status: running` (przejście już dozwolone), co zeruje licznik i czyści `pause_reason`.
- Pojedynczy gracz z `no_answer` przy działających pozostałych to nadal „pech” tego gracza, zgodnie z wcześniejszą decyzją.
- Brak limitu równoległości: liczba graczy w sesji jest mała (zapytania na rundę = liczba graczy).

#### Stare dane (decyzja projektanta)

- Sesja `running` bez pola `auction` (sprzed tej zmiany) jest przez silnik **pomijana** z ostrzeżeniem w logu, nie przerywa pętli pozostałych sesji. Admin może ją zakończyć ręcznie (`PATCH status: completed`). Nic nie jest zmieniane automatycznie.
- Sesja `pending` bez `settings` dostaje wartości domyślne przy odczycie i przy starcie.
- `GET /game-sessions/{id}/bids` zwraca tylko oferty w nowym kształcie (z polem `lot_number`). Stare dokumenty `player_bids` zostają w bazie nietknięte.

### Ranking (`standings`)

Dla każdego gracza:
- `unique_required` = liczba różnych typów `required: true` w jego `items`,
- `quality` = suma najwyższej jakości z każdego takiego typu,
- `budget` = pozostały budżet.

Sortowanie: `unique_required` malejąco, potem `quality` malejąco, potem `budget` malejąco, a na końcu nazwa alfabetycznie (żeby kolejność była stabilna). Pole `rank` zaczyna się od 1, a gracze równi we wszystkich trzech wartościach dostają ten sam `rank`.

## Warstwa LLM

Dostawcy (`openai`, `anthropic`, `ollama`, `gemini`) dostają jedną nową metodę protokołu:

`async def complete_json(self, system: str, user: str) -> str` — zwraca surowy tekst odpowiedzi; tam, gdzie API to wspiera, prosi o odpowiedź JSON (Gemini `response_mime_type`, OpenAI `response_format={"type": "json_object"}`, Ollama `format: "json"`; Anthropic zwykły tekst). Wyjątki się propagują.

`LLMServiceManager.complete_json(system, user)` wywołuje głównego dostawcę, a przy wyjątku albo pustym tekście zapasowego.

Budowa promptu, parsowanie odpowiedzi i mierzenie czasu są w nowym module `app/services/auction/` (patrz niżej), nie w dostawcach. Stare `generate_bids` i `generate_bids_per_player` zostają usunięte razem z testami, które ich dotyczą. Silnik przestaje ich używać.

## API

| Metoda | Ścieżka | Zmiana |
|---|---|---|
| POST | `/api/game-sessions` | przyjmuje opcjonalne `settings: {budget, lots_count, max_rounds}` |
| PATCH | `/api/game-sessions/{id}` | przyjmuje `settings` (tylko `pending`, inaczej 409) |
| POST | `/api/game-sessions/{id}/start` | dodatkowo generuje przedmioty i budżety |
| GET | `/api/game-sessions/{id}` | `GameSessionOut` dostaje `settings`, `required_items`, `lots`, `auction`, `standings`, a `roster[]` dostaje `budget` i `items` |
| GET | `/api/game-sessions/{id}/bids` | nowe: oferty sesji, opcjonalny filtr `?lot_number=`, sortowane po `lot_number`, `round`, `response_ms` |

## Interfejs admina

- **Nowa sesja:** pola „Budget”, „Items” i „Rounds per item” (z wartościami domyślnymi) obok nazwy. Te same pola można edytować, dopóki sesja czeka na start.
- **Panel sesji po starcie:** bieżący przedmiot (`Lot 3 of 12 · Crystal Fox · quality 7 · required`), runda, najwyższa oferta i prowadzący. W składzie przy każdym graczu: budżet i liczba unikatowych wymaganych przedmiotów.
- **Ranking** (po starcie): tabela `DataTable` z kolumnami: miejsce, gracz, unikatowe wymagane, jakość, budżet. Pierwsze miejsce oznaczone mosiądzem, zgodnie z konwencją „mosiądz = wygrana”.
- Odświeżanie sesji co kilka sekund, dopóki status to `running`.
- **Pole promptu gracza** (okno „Add player” / „Edit player”): etykieta „Agent prompt” i podpowiedź „Give your agent a persona and tell it what to check and how to bid.” Strona „Submit a prompt” dostaje taki sam krótki opis nad formularzem. Limit 2000 znaków bez zmian.

## Moduły backendu

- `app/services/auction/catalog.py` — generowanie przedmiotów (`generate_lots(settings, theme, seed) -> (lots, required_items)`).
- `app/services/auction/prompt.py` — `SYSTEM_PROMPT` (tekst z `docs/llm-bid-prompt.md`, bez celu gry i bez znaczenia pól), `build_user_message(instructions, state) -> str`, `build_state(session, player) -> dict`.
- `app/services/auction/decision.py` — `parse_decision(text) -> Decision | None` (`bid: int`, `reason: str`).
- `app/services/auction/rules.py` — czyste funkcje: walidacja oferty, rozstrzygnięcie rundy, sprzedaż, ranking. Bez I/O, testowane bez bazy.
- `app/services/game_engine.py` — orkiestracja kroku: stan → równoległe zapytania → `rules` → jeden `update_one` → zapis ofert.

## Decyzje podjęte przez projektanta (do sprawdzenia przez właściciela)

1. Limit czasu zapytania do LLM: 30 s.
2. Runda, w której nikt nie odpowiedział, się nie liczy. Po 3 takich rundach z rzędu sesja się pauzuje.
3. Stare uruchomione sesje są pomijane przez silnik, a nie automatycznie kończone.
4. Pula typów to ok. 60% liczby przedmiotów, z czego ok. 70% jest wymaganych. Jakość jest losowana z zakresu 1–10.
5. Oferty z częścią ułamkową są zaokrąglane w dół, a uzasadnienie jest przycinane do 100 znaków.
6. Gdy w rundzie 1 (albo później, bez prowadzącego) nikt nie złoży ważnej oferty, przedmiot jest niesprzedany.
7. Przy remisie w rankingu po liczbie unikatowych wymaganych przedmiotów i jakości decyduje pozostały budżet, a potem kolejność alfabetyczna.

## Co zostaje do decyzji budującego

- Dokładna lista nazw przedmiotów dla motywu „fantasy”.
- Rozmieszczenie pól w UI (zgodnie z `frontend/AGENTS.md`, działa przy szerokości 390 px).
- Interwał odświeżania sesji w UI (2–5 s).
- Kształt typów TS mapujących nowe pola.
