from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PromptAuction API"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "promptauction"
    game_rounds: int = 50
    game_iterations_per_round: int = 45
    game_engine_sleep_seconds: float = 1.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
