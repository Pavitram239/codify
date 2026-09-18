from rest_framework import serializers
from apps.code_drafts.models import CodeDraft


class CodeDraftSaveSerializer(serializers.Serializer):
    problemId = serializers.UUIDField(required=True)
    codeByLanguage = serializers.DictField(required=True)


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
