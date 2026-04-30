from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PromptAuction API"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "promptauction"
    game_rounds: int = 50
    game_iterations_per_round: int = 45
    game_engine_sleep_seconds: float = 1.0

    # Webhook security
    webhook_secret: str = ""

    # LLM Provider
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_temperature: float = 0.7
    llm_fallback_provider: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
