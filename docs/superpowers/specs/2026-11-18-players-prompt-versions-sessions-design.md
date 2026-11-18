# Gracze, wersje promptów i sesje gry: projekt

Data: 2026-11-18 · Gałąź: `feat/google-forms-pull` (lub nowa, od niej)

## Cel i powód

Admin ma prowadzić grę od sesji. Tworzy sesję i dodaje do niej graczy. Graczy pozyskuje na dwa sposoby, które może łączyć: pobiera ich z formularza Google albo wpisuje ręcznie.

Gracz to stały byt z własnym promptem. Każda zmiana promptu tworzy nową wersję, a stare wersje zostają w historii. Ten sam gracz może wziąć udział w wielu sesjach. Każda sesja zaczyna rozgrywkę od zera, czyli z własnymi ofertami i wynikami. Gra się wersją promptu przypiętą w chwili startu sesji.

Dziś tak to nie działa:
- prompt to luźny dokument z nickiem (`player_id`) bez pojęcia gracza ani wersji,
- silnik gry bierze **wszystkie** zaakceptowane prompty z bazy, bez względu na sesję,
- sesja ma nieużywane pole `accepted_prompt_ids`,
- panel admina pokazuje tylko kolejkę promptów oczekujących.

## Cele

1. Admin tworzy gracza ręcznie (nick, opcjonalny email, prompt). Taki prompt jest od razu zaakceptowany i staje się wersją 1.
2. Admin edytuje prompt gracza, a każda edycja tworzy nową, zaakceptowaną wersję. Admin może też zmienić nick i email gracza.
3. Historia wersji każdego gracza jest widoczna: numer, tekst, źródło, status i data.
4. Formularz Google i webhook dalej działają. Zgłoszenie od nowej osoby tworzy gracza, a od znanej osoby dodaje jej nową wersję. Obie trafiają do kolejki do akceptacji.
5. Admin tworzy sesję, dodaje do niej graczy z listy i usuwa ich. Startuje sesję.
6. Przy starcie każdy gracz w sesji dostaje przypiętą swoją aktualną wersję i gra nią do końca sesji.
7. Silnik gry używa wyłącznie graczy i promptów przypiętych w danej sesji.

## Poza zakresem

- Logowanie i ochrona panelu admina (osobny punkt BE-10).
- Podłączenie stron Live game i Leaderboard do prawdziwych danych. Nadal pokazują dane przykładowe.
- Ten sam gracz z innym promptem w różnych sesjach poza mechanizmem wersji. Wersja jest jedna na raz.
- Edycja promptu działającej sesji.

## Czego nie wolno zepsuć

- Edycja albo nowa wersja **nie może** zmienić strategii agenta w trwającej sesji.
- Żadna wersja promptu nie może zniknąć przez edycję. Edycja zawsze dopisuje nową.
- Ta sama osoba wysyłająca formularz drugi raz nie może stać się drugim graczem.
- Istniejące dane, czyli dzisiejsze prompty, muszą przetrwać migrację i trafić do graczy.

## Ograniczenia

- Stos: FastAPI + Motor (MongoDB, bez ODM, bezpośrednie operacje na kolekcjach), React 19 + MUI 9 + TanStack Query. Konwencje w `AGENTS.md` i `frontend/AGENTS.md`: mosiądz oznacza „wygrane”, liczby w foncie mono, tabele przez `DataTable`, etykiety pisane normalnie, nie wersalikami.
- Pokrycie testami: backend ≥ 90% (`fail_under`), frontend ≥ 90% (progi Vitest). CI uruchamia ruff, mypy, tsc i eslint.
- Testy backendu działają na `mongomock-motor` bez indeksów produkcyjnych. Testy sprawdzające unikalność muszą same utworzyć indeks, tak jak `test_webhook_accepts_many_submissions_without_form_response_id`.

## Rozważone podejścia

| | Podejście | Zyski | Koszty |
|---|---|---|---|
| **1 ✅ wybrane** | Kolekcja `prompts` staje się historią wersji (jeden dokument = jedna wersja), obok nowa kolekcja `players`. Sesja ma listę graczy i przy starcie kopiuje do siebie przypiętą wersję. | Kolejka do akceptacji, import z Google, ochrona przed duplikatami, webhook i strona statusu dla gracza działają na tej samej kolekcji. Wersje łatwo przeszukiwać. | Migracja istniejących promptów do graczy. |
| 2 | Wersje zapisane w tablicy wewnątrz dokumentu gracza. | Historia gracza w jednym odczycie. | Kolejka wymaga przeszukiwania wnętrza wszystkich graczy. Ochronę przed duplikatami i import trzeba przepisać. Dokument rośnie. |
| 3 | Sesja trzyma tylko ID graczy i zawsze czyta ich aktualny prompt. | Najprostsze. | Łamie wymóg przypięcia wersji przy starcie. Odrzucone. |

Wybór należał do właściciela projektu: wariant 1, a wcześniej „każda sesja od zera” i „wersja z chwili startu”.

## Model danych

### `players` (nowa kolekcja)

| Pole | Typ | Uwagi |
|---|---|---|
| `_id` | ObjectId | |
| `name` | str, 1–100 | wyświetlany nick |
| `name_key` | str | `name.strip().casefold()`, **unikalny indeks**, porównania bez względu na wielkość liter |
| `email` | str \| brak | opcjonalny, max 320 |
| `email_key` | str \| brak | `email.strip().casefold()`. Unikalny indeks z `partialFilterExpression: {email_key: {$type: "string"}}`, bo `sparse` nie pomija `null` (lekcja z poprawki webhooka). Pola nie zapisujemy, gdy emaila brak. |
| `former_name_keys` | list[str] | `name_key` z poprzednich nicków, dopisywane przy zmianie nicku. Zwykły indeks (multikey). Dzięki temu zgłoszenie pod starym nickiem trafia do tego samego gracza. |
| `current_version_id` | str \| null | ID wersji (`prompts._id`) będącej aktualnym promptem: **zaakceptowana wersja o najwyższym numerze**. `null`, gdy żadna nie jest zaakceptowana. |
| `created_at`, `updated_at` | datetime | |

### `prompts` (istniejąca kolekcja, dokument = wersja)

Pola dotychczasowe zostają: `player_id`, `prompt_text`, `email`, `form_response_id`, `status`, `created_at`, `updated_at`, `source`, `source_form_id`. Dochodzą:

| Pole | Typ | Uwagi |
|---|---|---|
| `player_ref` | str | `players._id` jako string. Indeks. |
| `version` | int ≥ 1 | numer kolejny w obrębie gracza. Unikalny indeks złożony `(player_ref, version)`. |
| `source` | `"admin" \| "google_forms" \| "webhook" \| "migration"` | dziś ustawiane tylko przez import z Google, teraz zawsze |
| `identity_warning` | `"email_mismatch"` \| brak | ustawiane, gdy zgłoszenie z zewnątrz trafiło do gracza po nicku, a gracz ma email inny niż w zgłoszeniu (także gdy zgłoszenie nie ma emaila). Pole pomijamy, gdy ostrzeżenia brak. |

`player_id` w wersji zostaje jako **nick w chwili utworzenia wersji**. Korzysta z niego strona „Check your submission” i to jest zgodność wstecz.

Numer wersji nadaje backend: `max(version) + 1` dla gracza. Przy kolizji, czyli dwóch jednoczesnych zapisach, unikalny indeks rzuca `DuplicateKeyError` i zapis ponawiamy maksymalnie 3 razy.

### `game_sessions` (istniejąca kolekcja)

Usuwamy `accepted_prompt_ids` ze schematów i odpowiedzi, a stare dokumenty mogą je mieć i są ignorowane. Dochodzi:

```
roster: [
  {
    player_ref: str,
    name: str,                 # nick w chwili dodania; odświeżany przy starcie
    # Poniższe ustawiane dopiero przy starcie (pinned):
    version_id: str | null,
    version: int | null,
    prompt_text: str | null,
  }
]
started_at: datetime | null
```

Statusy bez zmian: `pending → running → (paused ↔ running) → completed`.

### `ignored_form_responses` (nowa kolekcja)

`{_id: form_response_id, player_name, deleted_at}`. Zapisujemy tu ID odpowiedzi z formularza usuniętego gracza, żeby synchronizacja z Google (która co 30 s czyta wszystkie odpowiedzi formularza) ani webhook go nie odtworzyły.

### `users` (istniejąca kolekcja): bez zmian

Gra z niej nie korzysta. Zostaje nietknięta razem z `/api/users`. W `AGENTS.md` dopisujemy, że graczy w grze opisuje `players`, a `users` nie jest używane przez rozgrywkę.

## Zasady działania

### Gracze i wersje

- **Utworzenie przez admina:** `name` (wymagany, unikalny bez względu na wielkość liter, inaczej `409`), `email` (opcjonalny, unikalny, inaczej `409`) i `prompt_text` (3–2000 znaków, jak dziś). Powstaje gracz i wersja 1 ze statusem `accepted` i źródłem `admin`, która od razu staje się aktualna.
- **Nowa wersja od admina:** `prompt_text` tworzy wersję N+1 ze statusem `accepted` i źródłem `admin`, która staje się aktualna.
- **Zmiana nicku lub emaila:** dotyczy tylko gracza. Wersje zachowują nick z chwili powstania. Unikalność jak wyżej. Stary `name_key` dopisujemy do `former_name_keys`. Nowy nick nie może kolidować z `name_key` ani z `former_name_keys` innego gracza (`409`).
- **Akceptacja lub odrzucenie wersji** (`PATCH /api/prompts/{id}/status`, jak dziś): po każdej zmianie statusu przeliczamy `current_version_id` gracza jako zaakceptowaną wersję o najwyższym numerze. Akceptacja starszej wersji nie wypiera więc nowszej, a odrzucenie aktualnej cofa do poprzedniej zaakceptowanej.
- **Usunięcie gracza:** zabronione (`409`), jeśli gracz jest w składzie sesji `pending`, `running` albo `paused`. Inaczej usuwamy gracza i wszystkie jego wersje, a `form_response_id` tych wersji zapisujemy w `ignored_form_responses`. Zakończone sesje mają skopiowany tekst w `roster`, więc nic im nie ginie.

### Formularz Google i webhook

Wspólna funkcja `submit_from_outside(name, email, prompt_text, form_response_id, source)`:
1. Jeśli `form_response_id` już istnieje w `prompts`, nic nie rób i zwróć istniejącą wersję. Ochrona przed duplikatami działa jak dziś. Jeśli jest w `ignored_form_responses`, pomiń zgłoszenie: import z Google go nie liczy, a webhook odpowiada `200` z informacją, że zgłoszenie zignorowano.
2. Znajdź gracza: najpierw po `email_key` (jeśli email jest), potem po `name_key`, na końcu po `former_name_keys`.
3. Brak gracza: utwórz go (`current_version_id = null`) i dodaj mu wersję 1 ze statusem `pending`.
4. Gracz istnieje: dodaj mu wersję N+1 ze statusem `pending`. Gdy gracz nie miał emaila, a zgłoszenie go ma, uzupełnij email. Istniejącego emaila nie nadpisujemy.
5. Gdy email wskazuje gracza A, a nick gracza B, wygrywa email. Nick w wersji to ten wpisany w formularzu.
6. **Decyzja właściciela (wariant A):** gdy gracz został znaleziony po nicku (krok 2, bez dopasowania emaila), a ma email inny niż zgłoszenie albo zgłoszenie nie ma emaila, wersja trafia do tego gracza normalnie jako `pending`, z `identity_warning = "email_mismatch"`. Gdy gracz nie ma emaila, ostrzeżenia nie ma, bo nie ma z czym porównać.

Kolejka „Review queue” to wersje ze statusem `pending`, bez zmian. Pokazuje dodatkowo, czy to nowy gracz, czy kolejna wersja istniejącego, oraz wyraźne ostrzeżenie przy `identity_warning`, np. „Inny email niż u gracza (aurelia@x.pl → ktos@y.pl)”.

### Sesje

- **Tworzenie:** `POST /api/game-sessions` jak dziś, `{name}`. Status `pending`, pusty `roster`.
- **Dodanie gracza do składu:** tylko gdy status to `pending`, inaczej `409`. Gracz musi istnieć (inaczej `404`), a ten sam gracz dwa razy daje `409`. Gracz bez zaakceptowanej wersji **może** zostać dodany, ale blokuje start (patrz niżej).
- **Usunięcie ze składu:** tylko gdy status to `pending`.
- **Start:** `POST /api/game-sessions/{id}/start`, tylko ze statusu `pending`.
  - Warunki: co najmniej 2 graczy w składzie (aukcja potrzebuje konkurencji) i każdy ma `current_version_id`. Inaczej `409` z listą graczy, którzy blokują start.
  - Efekt: dla każdego gracza przepisujemy `version_id`, `version`, `prompt_text` i aktualny `name`, ustawiamy `status = running` i `started_at`. Całość jednym `update_one` z warunkiem `status: "pending"`, żeby dwa kliknięcia nie wystartowały sesji dwa razy.
- **Zmiana statusu przez `PATCH /api/game-sessions/{id}`:** nie pozwala już ustawić `running` z `pending`, bo to omijałoby przypięcie. Dozwolone są: `running → paused`, `paused → running`, `running|paused → completed`. Pozostałe przejścia dają `409`.
- **Usunięcie sesji:** jak dziś, ale zabronione dla `running` (`409`).

### Silnik gry

`GameEngineService._run_iteration` buduje `context["accepted_prompts"]` z `session["roster"]`: `[{"player_id": r["name"], "prompt_text": r["prompt_text"]} ...]`, zamiast zapytania `db.prompts.find({"status": "accepted"})`. Format kontekstu dla dostawców LLM się nie zmienia. Oferty (`player_bids`) dostają dodatkowo `player_ref` z odpowiadającego wpisu składu, dopasowanego po `name`.

### Migracja istniejących danych

Funkcja idempotentna uruchamiana w `lifespan` po `connect()` i `_ensure_indexes()`:
1. Weź prompty bez `player_ref`, posortowane po `created_at`.
2. Grupuj po `player_id.strip().casefold()`. Dla każdej grupy znajdź albo utwórz gracza (nick z najnowszego promptu, email z najnowszego, który go ma, o ile nie jest zajęty).
3. Nadaj kolejne numery wersji, ustaw `player_ref` i `source` (zostaw istniejący `source`, w przeciwnym razie `migration`).
4. Przelicz `current_version_id`.

Sesje z polem `accepted_prompt_ids` bez `roster` traktujemy jak puste składy.

## API: podsumowanie

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/players` | lista graczy z aktualną wersją (numer + tekst) i liczbą wersji oczekujących |
| POST | `/api/players` | utworzenie gracza z wersją 1 (`{name, email?, prompt_text}`) |
| GET | `/api/players/{id}` | gracz + pełna historia wersji (od najnowszej) |
| PATCH | `/api/players/{id}` | `{name?, email?}` |
| DELETE | `/api/players/{id}` | patrz zasady |
| POST | `/api/players/{id}/versions` | nowa wersja od admina (`{prompt_text}`) |
| PATCH | `/api/prompts/{id}/status` | bez zmian w kontrakcie, dochodzi przeliczenie aktualnej wersji |
| POST | `/api/prompts/webhook` | bez zmian w kontrakcie, logika przez `submit_from_outside` |
| GET | `/api/prompts` | bez zmian. Odpowiedź dostaje `player_ref`, `version`, `source`. |
| POST | `/api/game-sessions/{id}/players` | `{player_id}`: dodanie do składu |
| DELETE | `/api/game-sessions/{id}/players/{player_id}` | usunięcie ze składu |
| POST | `/api/game-sessions/{id}/start` | przypięcie wersji i start |

`GameSessionOut` dostaje `roster` i `started_at`, a traci `accepted_prompt_ids`.

## Interfejs admina

Strona Admin, od góry:

```
Admin
┌ Sesje ──────────────────────────────────── [Nowa sesja] ┐
│ ▸ Wieczorny mecz   Czeka na start   3 graczy             │
│   Turniej piątkowy Zakończona       8 graczy             │
└──────────────────────────────────────────────────────────┘
┌ Wieczorny mecz ─────────────────── [Dodaj graczy] [Start] ┐
│ Aurelia   aktualnie v3                          Usuń       │
│ Kestrel   aktualnie v1                          Usuń       │
│ Morrow    brak zaakceptowanej wersji ⚠          Usuń       │
│ (po starcie: „gra wersją v3” i bez przycisków)            │
└──────────────────────────────────────────────────────────┘
┌ Gracze ─────────────────────────────────── [Dodaj gracza] ┐
│ Aurelia  v3 „Bid conservatively until…”   Edytuj  Historia │
│ Kestrel  v1 „Never exceed 40%…”           Edytuj  Historia │
└──────────────────────────────────────────────────────────┘
┌ Kolejka do akceptacji (2) ───────────────────────────────┐
│ Morrow · nowy gracz · z formularza   „Shadow…”  Accept Reject │
│ Aurelia · nowa wersja v4 · z formularza „…”     Accept Reject │
│   ⚠ Inny email niż u gracza                                   │
└──────────────────────────────────────────────────────────┘
┌ Formularz zgłoszeń (Google) ─────────────────────────────┐  (bez zmian)
```

- **Dodaj gracza / Edytuj:** okno dialogowe. Przy dodawaniu: nick, email, prompt. Przy edycji: nick, email i pole promptu wypełnione aktualną wersją. Zapis zmienionego promptu tworzy nową wersję, a samą zmianę nicku lub emaila zapisuje bez nowej wersji.
- **Historia:** okno z listą wersji od najnowszej: numer, status, źródło, data i tekst.
- **Dodaj graczy do sesji:** okno z listą graczy, których nie ma jeszcze w składzie (wielokrotny wybór, wyszukiwanie po nicku).
- **Start:** nieaktywny, gdy w składzie są mniej niż 2 osoby albo ktoś nie ma zaakceptowanej wersji. Obok krótko widać powód.
- Błędy z API pokazujemy przez istniejące `apiErrorMessage`.

## Decyzje podjęte przez projektanta (do sprawdzenia przez właściciela)

1. Usunięty gracz nie wraca przez synchronizację: jego odpowiedzi trafiają do `ignored_form_responses`.
2. Zgłoszenie pod poprzednim nickiem trafia do tego samego gracza (`former_name_keys`).
3. `users` i `/api/users` zostają nietknięte. Graczy w grze opisuje `players`.
4. Start sesji wymaga co najmniej 2 graczy.
5. Gracz bez zaakceptowanej wersji może być w składzie, ale blokuje start.
6. Usunięcie gracza jest zabronione, gdy jest w sesji niezakończonej.
7. `PATCH` sesji nie może ustawić `running` z `pending`. Do tego służy tylko `/start`.

## Co zostaje do decyzji budującego

- Dokładny układ okien i komponentów (MUI `Dialog`, `Autocomplete`), byle w zgodzie z konwencjami w `frontend/AGENTS.md` i responsywny do 390 px.
- Czy aktualizacja składu i statusu odświeża się przez `refetchInterval` (jak status formularza, 15 s), czy tylko po mutacjach.
- Podział na pliki: proponowane `routers/players.py`, `services/players.py`, `schemas/players.py`, a logika sesji w `services/game_sessions.py`.
- Nazewnictwo testów i fixture'ów.
