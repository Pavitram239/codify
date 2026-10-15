from rest_framework import serializers
from apps.contests.models import Contest
from apps.problems.models import Problem
from apps.users.models import User


class ContestProblemSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    name = serializers.CharField(source="title")
    maxMarks = serializers.IntegerField(source="total_marks")
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Problem
        fields = [
            "_id",
            "id",
            "title",
            "name",
            "difficulty",
            "maxMarks",
            "createdAt",
        ]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return str(obj.id)


class ContestCreatorSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["_id", "id", "username", "email", "role"]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return obj.student_id or str(obj.id)


class ContestSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    problems = ContestProblemSerializer(many=True, read_only=True)
    assignedStudents = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = Contest
        fields = [
            "_id",
            "id",
            "name",
            "description",
            "created_by",
            "problems",
            "assignedStudents",
            "start_time",
            "end_time",
            "status",
            "createdAt",
            "updatedAt",
        ]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return str(obj.id)

    def get_created_by(self, obj):
        if obj.created_by:
            return ContestCreatorSerializer(obj.created_by).data
        return None

    def get_assignedStudents(self, obj):
        return [str(s.id) for s in obj.assigned_students.all()]

    def get_status(self, obj):
        return obj.computed_status


class ContestCreateUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    description = serializers.CharField(required=True)
    created_by = serializers.CharField(required=False, allow_blank=True)
    problems = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    start_time = serializers.DateTimeField(required=True)
    end_time = serializers.DateTimeField(required=True)

    def validate(self, data):
        start = data.get("start_time", getattr(self.instance, "start_time", None))
        end = data.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError({"error": "Start time must be before end time"})
        return data
