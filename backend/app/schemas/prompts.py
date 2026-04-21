from pydantic import BaseModel, Field


class PromptSubmissionCreate(BaseModel):
    player_id: str = Field(..., description="External player identifier from form")
    prompt_text: str = Field(..., min_length=3)


class PromptSubmissionStatusUpdate(BaseModel):
    status: str


class PromptSubmissionOut(BaseModel):
    id: str
    player_id: str
    prompt_text: str
    status: str
