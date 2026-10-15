import secrets


def has_predictable_password(user):
    public_values = {user.student_id, user.username, (user.email or "").split("@")[0]}
    return user.first_time_login and any(value and user.check_password(value) for value in public_values)


def prepare_initial_password(user):
    """Preserve chosen passwords; replace legacy/public defaults with a random secret."""
    if user.password and user.has_usable_password() and not has_predictable_password(user):
        return None
    password = secrets.token_urlsafe(24)
    user.set_password(password)
    return {"id": user.student_id or user.username, "username": user.username, "temporaryPassword": password}
