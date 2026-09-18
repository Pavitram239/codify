"""
Custom exception handler for Django REST Framework.

Returns errors in the same JSON shape as the Node.js backend:
  { "success": false, "message": "<error message>" }

This ensures the frontend (which expects that shape) works without modification.
Full implementation in Phase 4.
"""

from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """Wrap DRF's default exception handler to match Node.js response shape."""
    response = exception_handler(exc, context)

    if response is not None:
        # Flatten DRF's nested detail/non_field_errors into a single message
        data = response.data
        if isinstance(data, dict):
            message = (
                data.get("detail")
                or data.get("message")
                or str(next(iter(data.values()), "An error occurred."))
            )
        elif isinstance(data, list):
            message = str(data[0]) if data else "An error occurred."
        else:
            message = str(data)

        response.data = {
            "success": False,
            "message": message,
        }

    return response
