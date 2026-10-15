from rest_framework.exceptions import ValidationError


def pagination_params(data):
    try:
        page = int(data.get("page", 1))
        limit = int(data.get("limit", 10))
    except (TypeError, ValueError):
        raise ValidationError("Page and limit must be positive integers.")
    if page < 1 or limit < 1 or limit > 1000:
        raise ValidationError("Page must be positive and limit must be between 1 and 1000.")
    return page, limit
