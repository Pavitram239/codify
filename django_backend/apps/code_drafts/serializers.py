from rest_framework import serializers
from apps.code_drafts.models import CodeDraft


class CodeDraftSaveSerializer(serializers.Serializer):
    problemId = serializers.UUIDField(required=True)
    codeByLanguage = serializers.DictField(required=True)

    def validate_codeByLanguage(self, value):
        if any(key not in {"python", "cpp", "java", "javascript"} or not isinstance(code, str)
               for key, code in value.items()):
            raise serializers.ValidationError("Code must be text keyed by a supported language.")
        return value


class CodeDraftModelSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    userId = serializers.SerializerMethodField()
    problemId = serializers.SerializerMethodField()
    codeByLanguage = serializers.JSONField(source="code_by_language")

    class Meta:
        model = CodeDraft
        fields = ["_id", "userId", "problemId", "codeByLanguage", "updated_at"]

    def get__id(self, obj):
        return str(obj.id)

    def get_userId(self, obj):
        return str(obj.user_id)

    def get_problemId(self, obj):
        return str(obj.problem_id)
