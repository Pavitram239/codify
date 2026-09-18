"""
Custom password hasher that can verify legacy bcrypt hashes from MongoDB.

Django's password hashing framework checks hashers in order. This hasher
identifies hashes that start with '$2b$' (bcrypt) and handles them.
On the next successful login, Django automatically re-hashes using PBKDF2
(the second hasher in settings.PASSWORD_HASHERS).

Full bcrypt hasher implementation in Phase 4.
For Phase 2 bootstrap, this is a minimal stub that satisfies the import.
"""

import bcrypt
from django.contrib.auth.hashers import BasePasswordHasher
from django.utils.crypto import get_random_string


class BCryptHasher(BasePasswordHasher):
    """
    Wraps the bcrypt library to verify existing hashes from MongoDB.
    Produces hashes in the format:   bcrypt$$<bcrypt_hash>
    """

    algorithm = "bcrypt"
    rounds = 10

    def salt(self):
        bcrypt_salt = bcrypt.gensalt(rounds=self.rounds)
        return bcrypt_salt.decode("utf-8")

    def encode(self, password, salt):
        password_b = password.encode("utf-8")
        salt_b = salt.encode("utf-8")
        hashed = bcrypt.hashpw(password_b, salt_b)
        return f"{self.algorithm}$${hashed.decode('utf-8')}"

    def verify(self, password, encoded):
        # Handle raw bcrypt hashes stored directly from MongoDB (no prefix)
        if encoded.startswith("$2b$") or encoded.startswith("$2a$"):
            try:
                return bcrypt.checkpw(
                    password.encode("utf-8"), encoded.encode("utf-8")
                )
            except Exception:
                return False

        # Handle our prefixed format: bcrypt$$<hash>
        algorithm, _, hash_str = encoded.partition("$$")
        if algorithm != self.algorithm:
            return False
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"), hash_str.encode("utf-8")
            )
        except Exception:
            return False

    def safe_summary(self, encoded):
        return {"algorithm": self.algorithm}

    def must_update(self, encoded):
        # Signal Django to re-hash with PBKDF2 after successful verification
        return True
