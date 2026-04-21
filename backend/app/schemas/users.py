from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2)
    email: str


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2)
    email: str | None = None


class UserOut(BaseModel):
    id: str
    username: str
    email: str
