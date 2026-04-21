from bson import ObjectId


def object_id_to_str(value: ObjectId | str | None) -> str | None:
    if value is None:
        return None
    return str(value)
