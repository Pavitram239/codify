import pytest


@pytest.fixture(autouse=True)
def isolated_test_media(settings, tmp_path):
    """Keep avatar uploads from writing into the project's media directory."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
