from rest_framework import serializers
from apps.problems.models import Problem, SampleIO, TestCase
from apps.users.models import User


class SampleIOSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleIO
        fields = ["input", "output", "order"]


class TestCaseSerializer(serializers.ModelSerializer):
    is_hidden = serializers.BooleanField(default=False)

    class Meta:
        model = TestCase
        fields = [
            "id",
            "inputs",
            "outputs",
            "marks",
            "cpu_time_limit",
            "memory_limit",
            "is_hidden",
            "order",
        ]

    def validate_cpu_time_limit(self, value):
        if value < 1 or value > 15:
            raise serializers.ValidationError("CPU time limit must be between 1 and 15 seconds.")
        return value

    def validate_memory_limit(self, value):
        if value < 1 or value > 256:
            raise serializers.ValidationError("Memory limit must be between 1 and 256 MB.")
        return value


class ProblemListSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Problem
        fields = ["id", "_id", "title", "difficulty", "createdAt"]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return str(obj.id)


class ProblemDetailSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    inputFormat = serializers.CharField(source="input_format")
    outputFormat = serializers.CharField(source="output_format")
    sampleIO = SampleIOSerializer(source="sample_io", many=True)
    testCases = serializers.SerializerMethodField()
    totalMarks = serializers.IntegerField(source="total_marks")
    createdBy = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = [
            "_id",
            "title",
            "description",
            "difficulty",
            "inputFormat",
            "outputFormat",
            "sampleIO",
            "testCases",
            "constraints",
            "tags",
            "totalMarks",
            "createdBy",
        ]

    def get__id(self, obj):
        return str(obj.id)

    def get_createdBy(self, obj):
        return str(obj.created_by_id)

    def get_testCases(self, obj):
        # By default in getProblemById, only visible test cases are exposed for testing/running
        # Hidden test cases are not included for problem viewing
        visible_cases = obj.test_cases.filter(is_hidden=False)
        return TestCaseSerializer(visible_cases, many=True).data


class ProblemUpdateSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    inputFormat = serializers.CharField(source="input_format")
    outputFormat = serializers.CharField(source="output_format")
    sampleIO = SampleIOSerializer(source="sample_io", many=True)
    testCases = TestCaseSerializer(source="test_cases", many=True)
    totalMarks = serializers.IntegerField(source="total_marks")
    createdBy = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = [
            "_id",
            "title",
            "description",
            "difficulty",
            "inputFormat",
            "outputFormat",
            "sampleIO",
            "testCases",
            "constraints",
            "tags",
            "totalMarks",
            "createdBy",
        ]

    def get__id(self, obj):
        return str(obj.id)

    def get_createdBy(self, obj):
        return str(obj.created_by_id)


class StudentListSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["_id", "id", "username", "semester", "batch", "branch"]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return obj.student_id or str(obj.id)
