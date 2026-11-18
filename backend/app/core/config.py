from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PromptAuction API"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "promptauction"
    game_rounds: int = 50
    game_iterations_per_round: int = 45
    game_engine_sleep_seconds: float = 1.0

    # Comma-separated browser origins allowed to call the API (the frontend's URL)
    cors_origins: str = "http://localhost:5173"

    # Webhook security
    webhook_secret: str = ""

    # LLM Provider
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_temperature: float = 0.7
    llm_fallback_provider: str = ""

    # Google Forms (service account used to pull form responses)
    google_service_account_file: str = ""
    google_service_account_json: str = ""
    google_forms_poll_seconds: float = 30.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
