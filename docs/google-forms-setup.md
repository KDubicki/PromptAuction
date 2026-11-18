# Google Forms → PromptAuction: instrukcja konfiguracji

Backend sam pobiera odpowiedzi graczy z formularza Google i dodaje je do kolejki **Review queue** w panelu admina jako prompty `pending`. Admin tylko wkleja link do formularza. Nie trzeba instalować żadnego Apps Scriptu ani wystawiać backendu do internetu.

Instrukcja ma trzy części:

1. [**Jednorazowo: konfiguracja serwera**](#część-1--jednorazowo-konfiguracja-serwera). Robi ją osoba, która wdraża aplikację. Zajmuje około 15 minut.
2. [**Przed każdą grą: podłączenie formularza**](#część-2--przed-każdą-grą-podłączenie-formularza). Robi to admin. Zajmuje około 2 minut.
3. [**Rozwiązywanie problemów**](#część-3--rozwiązywanie-problemów).

---

## Jak to działa

```
Gracz wypełnia formularz Google
        │
        ▼
Google Forms (odpowiedzi zostają prywatne)
        │  Forms API, co 30 s, uwierzytelnienie kontem usługi
        ▼
Backend PromptAuction ──► MongoDB: kolekcja prompts (status: pending)
        │
        ▼
Panel admina → Review queue → Accept / Reject
```

- Backend loguje się do Google jako **konto usługi**, czyli osobne konto techniczne z własnym adresem email. Widzi tylko te formularze, które mu udostępnisz.
- Każda odpowiedź jest importowana **raz**, rozpoznawana po jej ID w Google. Jeśli gracz później edytuje odpowiedź, zmiana nie trafia do aplikacji, bo prompt mógł już zostać oceniony.
- Gdy formularz jest podłączony, strona **Submit a prompt** sama pokazuje go graczom. Zmienna `VITE_GOOGLE_FORM_URL` nie jest już potrzebna, a jeśli ją ustawisz, ma pierwszeństwo.

---

## Część 1 — Jednorazowo: konfiguracja serwera

### 1.1. Utwórz projekt w Google Cloud

1. Wejdź na <https://console.cloud.google.com/> i zaloguj się kontem Google.
2. Na górnym pasku kliknij listę projektów i wybierz **New project** (Nowy projekt).
3. Nazwa: np. `promptauction`. Kliknij **Create** i poczekaj, aż projekt się utworzy.
4. Upewnij się, że ten projekt jest wybrany na górnym pasku.

> Projekt jest darmowy. Forms API nie wymaga podpinania karty ani płatności.

### 1.2. Włącz Google Forms API

1. Menu ☰ → **APIs & Services** → **Library** (Biblioteka).
2. Wyszukaj **Google Forms API**.
3. Kliknij wynik, a potem **Enable** (Włącz).

### 1.3. Utwórz konto usługi

1. Menu ☰ → **IAM & Admin** → **Service Accounts** (Konta usługi).
2. Kliknij **+ Create service account**.
3. Nazwa: np. `promptauction-forms`. Kliknij **Create and continue**.
4. Krok **Grant this service account access to project**: **pomiń**, bo żadna rola nie jest potrzebna. Kliknij **Continue**, a potem **Done**.
5. Na liście pojawi się adres w stylu:
   `promptauction-forms@promptauction-123456.iam.gserviceaccount.com`
   Panel admina pokazuje go później z przyciskiem do kopiowania, więc nie musisz go zapisywać.

### 1.4. Pobierz klucz JSON

1. Kliknij utworzone konto usługi → zakładka **Keys** (Klucze).
2. **Add key** → **Create new key** → typ **JSON** → **Create**.
3. Przeglądarka pobierze plik `.json`. **To jest hasło do konta usługi.**
   - Nie commituj go do repozytorium i nie wysyłaj na czacie.
   - Jeśli wycieknie, usuń klucz w tej samej zakładce i wygeneruj nowy.

> Jeśli pojawi się błąd *„Service account key creation is disabled”*, to Twoja organizacja Google Workspace blokuje klucze. Zobacz [rozwiązywanie problemów](#część-3--rozwiązywanie-problemów).

### 1.5. Przekaż klucz backendowi

Wybierz **jedną** z dwóch opcji.

**Opcja A — plik (wygodna lokalnie)**

1. Utwórz folder `backend/secrets/` (jest w `.gitignore`) i wrzuć do niego plik jako `google-service-account.json`.
2. W `backend/.env` ustaw:
   ```env
   GOOGLE_SERVICE_ACCOUNT_FILE=secrets/google-service-account.json
   ```
   Ścieżka względna liczy się od folderu, z którego uruchamiasz backend (`backend/`). Na serwerze bezpieczniej podać ścieżkę bezwzględną.

**Opcja B — treść JSON w zmiennej (wygodna na serwerze i w Dockerze)**

1. Zamień plik na jedną linię:
   ```bash
   python3 -c "import json,sys; print(json.dumps(json.load(open(sys.argv[1]))))" ~/Downloads/klucz.json
   ```
2. W `backend/.env` (albo w zmiennych środowiskowych serwera) ustaw:
   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...", ...}
   ```
   Całość musi być w jednej linii i bez dodatkowych cudzysłowów wokół.

Opcjonalnie możesz zmienić, co ile sekund backend sprawdza nowe odpowiedzi (domyślnie 30):

```env
GOOGLE_FORMS_POLL_SECONDS=30
```

### 1.6. Ustaw adres frontendu (CORS)

Przeglądarka wpuści zapytania panelu do API tylko z adresów wpisanych tutaj. Lokalnie domyślna wartość wystarcza. Na serwerze wpisz publiczny adres frontendu:

```env
CORS_ORIGINS=https://promptauction.twojadomena.pl
```

Kilka adresów oddziel przecinkami: `CORS_ORIGINS=http://localhost:5173,https://promptauction.twojadomena.pl`.

### 1.7. Zainstaluj zależności i zrestartuj backend

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt   # doszły google-auth i requests
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Docker / Podman:** `docker-compose.yml` wczytuje dziś `backend/.env.example` zamiast `backend/.env`. Żeby kontener dostał klucz, zmień sekcję `backend`:

```yaml
  backend:
    build:
      context: ./backend
    env_file:
      - ./backend/.env            # zamiast ./backend/.env.example
    volumes:
      - ./backend/secrets:/app/secrets:ro   # tylko dla opcji A (plik)
```

Przy opcji A ustaw w `.env` ścieżkę widzianą z wnętrza kontenera: `GOOGLE_SERVICE_ACCOUNT_FILE=/app/secrets/google-service-account.json`. Potem przebuduj: `docker compose up --build`.

### 1.8. Sprawdź, czy działa

Otwórz panel admina (`/admin`). W sekcji **Player entry form**:

- **„Setup needed”**: backend nie widzi klucza. Komunikat pod spodem mówi dlaczego.
- **„Not connected”** i widoczny adres konta usługi: serwer jest gotowy. Przejdź do części 2.

---

## Część 2 — Przed każdą grą: podłączenie formularza

### 2.1. Przygotuj formularz

Utwórz formularz na <https://forms.google.com> z pytaniami typu **Krótka odpowiedź** lub **Akapit**. Backend rozpoznaje pola **po tytułach pytań**, bez względu na wielkość liter i polskie znaki:

| Pole w aplikacji | Wymagane | Tytuł pytania musi zawierać jedno ze słów | Przykład tytułu |
|---|---|---|---|
| Nick gracza | **tak** | `nick`, `gracz`, `player`, `imię`, `name`, `nazwa`, `login` | „Nick gracza” |
| Prompt | **tak** | `prompt`, `strateg` | „Twój prompt (strategia)” |
| Email | nie | `email`, `e-mail`, `mail` | „Adres e-mail” |

Uwagi:
- Jeśli w ustawieniach formularza włączysz **Zbieraj adresy email**, backend weźmie email stamtąd, gdy nie ma osobnego pytania.
- Nie dawaj dwóch pytań pasujących do tego samego pola, np. „Imię” i „Nick”. Wygra pierwsze z góry.
- Odpowiedzi bez nicku albo z promptem krótszym niż 3 znaki zostaną **pominięte**. Panel pokazuje ich liczbę w polu *Skipped*.
- Prompt może mieć najwyżej 2000 znaków. Warto ustawić to w formularzu: ⋮ przy pytaniu → **Weryfikacja odpowiedzi** → Długość → Maksymalna liczba znaków 2000.

### 2.2. Udostępnij formularz kontu usługi

1. W panelu admina, w sekcji **Player entry form**, kliknij **Copy** przy adresie konta usługi.
2. W edytorze formularza kliknij **⋮** (prawy górny róg) → **Dodaj współpracowników** (*Add collaborators*).
3. Wklej adres jako **Edytor**. Możesz odznaczyć powiadomienie, bo konto usługi i tak nie czyta poczty.
4. Kliknij **Wyślij** / **Udostępnij**.

> Konto usługi potrzebuje roli edytora, bo tylko ona daje w Google Forms dostęp do odpowiedzi. Backend niczego w formularzu nie zmienia, ma wyłącznie uprawnienia do odczytu.

### 2.3. Wklej link do formularza w panelu

1. W edytorze formularza skopiuj adres z **paska przeglądarki**. Wygląda tak:
   `https://docs.google.com/forms/d/1AbC...xyz/edit`
2. W panelu admina wklej go w pole **Form editor link** i kliknij **Connect**.

❗ **Nie** używaj linku z przycisku **Wyślij** (`forms.gle/...` ani `.../forms/d/e/.../viewform`). To link dla graczy i nie da się z niego odczytać odpowiedzi. Panel wyświetli wtedy komunikat z podpowiedzią.

### 2.4. Sprawdź połączenie

Po połączeniu panel pokazuje:
- tytuł formularza (kliknięcie otwiera edytor),
- które pytania czyta (`nick ← „Nick gracza” · prompt ← „…”`),
- **Imported**: ile promptów zaimportowano z tego formularza,
- **Skipped**: ile odpowiedzi pominięto,
- **Last sync**: czas ostatniego sprawdzenia; backend sprawdza formularz automatycznie co 30 s.

Przycisk **Sync now** pobiera odpowiedzi od razu, bez czekania. Nowe zgłoszenia pojawiają się w **Review queue**, gdzie akceptujesz je albo odrzucasz.

### 2.5. Daj graczom link

- Strona **Submit a prompt** w aplikacji sama pokazuje podłączony formularz.
- Możesz też wysłać graczom zwykły link z przycisku **Wyślij** w Google Forms.

### 2.6. Po grze

- **Disconnect** w panelu kończy pobieranie. Zaimportowane prompty zostają w aplikacji.
- Żeby podłączyć formularz na następną grę, kliknij **Disconnect** i wklej nowy link. Nowy formularz też trzeba udostępnić kontu usługi (krok 2.2).
- Możesz też usunąć konto usługi ze współpracowników formularza. Wtedy panel pokaże błąd „No access to this form”.

---

## Część 3 — Rozwiązywanie problemów

| Komunikat w panelu | Przyczyna | Co zrobić |
|---|---|---|
| **Setup needed** — *No Google service account is configured on the server* | Brak `GOOGLE_SERVICE_ACCOUNT_FILE` i `GOOGLE_SERVICE_ACCOUNT_JSON` | Krok 1.5, potem restart backendu |
| *Could not load the Google service account key: …* | Zła ścieżka do pliku albo uszkodzony JSON | Sprawdź ścieżkę względem folderu, z którego uruchamiasz backend. Przy opcji B wszystko musi być w jednej linii. |
| *Google rejected the service account key* | Klucz usunięty lub unieważniony | Wygeneruj nowy klucz (krok 1.4) |
| *The Google Forms API is not enabled…* | API nie jest włączone w projekcie | Krok 1.2. Po włączeniu odczekaj 1–2 minuty. |
| *No access to this form. Share it with the service account…* | Formularz nie jest udostępniony kontu usługi albo dostęp odebrano | Krok 2.2 |
| *This is the players' link…* / *short share link* | Wklejono link dla graczy | Krok 2.3: link z paska adresu w trybie edycji, kończący się na `/edit` |
| *Could not find a question for the player nick / prompt…* | Żaden tytuł pytania nie pasuje do słów kluczowych | Zmień tytuły pytań według tabeli z kroku 2.1. Komunikat wypisuje obecne tytuły. |
| **Unavailable** — *Cannot reach the API server* | Frontend nie łączy się z backendem | Sprawdź, czy backend działa, czy `VITE_API_BASE_URL` wskazuje na API i czy adres frontendu jest w `CORS_ORIGINS` (krok 1.6) |
| Rośnie **Skipped** | Odpowiedzi bez nicku albo ze zbyt krótkim promptem | Ustaw pytania jako **wymagane** w formularzu |
| Przy udostępnianiu: *nie możesz udostępnić poza organizacją* | Formularz należy do Google Workspace z blokadą udostępniania na zewnątrz | Utwórz formularz na prywatnym koncie Google albo poproś administratora Workspace o zgodę na udostępnianie |
| *Service account key creation is disabled* (krok 1.4) | Zasada organizacji `iam.disableServiceAccountKeyCreation` | Użyj projektu Google Cloud na prywatnym koncie albo poproś administratora o wyjątek |

Logi backendu pokazują każdy import (`Imported N new prompt(s) from Google Form …`) i każdy błąd synchronizacji (`Google Form sync failed: …`).

---

## Bezpieczeństwo

- **Panel admina nie ma jeszcze logowania** (punkt BE-10 w planie rozwoju). Każdy, kto otworzy `/admin`, może podłączyć lub odłączyć formularz i akceptować prompty. Dopóki logowania nie ma, ogranicz dostęp do panelu na serwerze, np. hasłem (basic auth) w reverse proxy albo dostępem tylko z VPN.
- Klucz konta usługi trzymaj poza repozytorium (`backend/secrets/` i `.env` są w `.gitignore`).
- Konto usługi widzi wyłącznie formularze, które mu udostępniono, i ma dostęp tylko do odczytu (zakresy `forms.body.readonly` i `forms.responses.readonly`).
