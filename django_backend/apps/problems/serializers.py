from rest_framework import serializers
from apps.problems.models import Problem, SampleIO, TestCase
from apps.users.models import User
from django.db import transaction
import math


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if not isinstance(data, bool):
            raise serializers.ValidationError("Must be a boolean.")
        return data


class CaseWriteSerializer(serializers.Serializer):
    inputs = serializers.CharField(required=False, default="", allow_blank=True, trim_whitespace=False)
    outputs = serializers.CharField(required=False, default="", allow_blank=True, trim_whitespace=False)
    marks = serializers.IntegerField(required=False, default=0, min_value=0)
    cpu_time_limit = serializers.FloatField(required=False, default=1, min_value=1, max_value=15)
    memory_limit = serializers.IntegerField(required=False, default=128, min_value=1, max_value=256)
    is_hidden = StrictBooleanField(required=False, default=False)

    def validate_cpu_time_limit(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("CPU limit must be finite.")
        return value


class SampleWriteSerializer(serializers.Serializer):
    input = serializers.CharField(required=False, default="", allow_blank=True, trim_whitespace=False)
    output = serializers.CharField(required=False, default="", allow_blank=True, trim_whitespace=False)


class ProblemWriteSerializer(serializers.ModelSerializer):
    inputFormat = serializers.CharField(source="input_format", required=False, default="", allow_blank=True)
    outputFormat = serializers.CharField(source="output_format", required=False, default="", allow_blank=True)
    sampleIO = SampleWriteSerializer(source="sample_io", many=True, required=False)
    testCases = CaseWriteSerializer(source="test_cases", many=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = Problem
        fields = ["title", "description", "difficulty", "inputFormat", "outputFormat", "constraints", "tags", "sampleIO", "testCases"]

    def _save_related(self, problem, samples, cases):
        if samples is not None:
            problem.sample_io.all().delete()
            SampleIO.objects.bulk_create([SampleIO(problem=problem, order=i, **s) for i, s in enumerate(samples)])
        if cases is not None:
            problem.test_cases.all().delete()
            TestCase.objects.bulk_create([TestCase(problem=problem, order=i, **c) for i, c in enumerate(cases)])
            problem.total_marks = sum(c["marks"] for c in cases)
            problem.save(update_fields=["total_marks"])

    @transaction.atomic
    def create(self, validated_data):
        samples = validated_data.pop("sample_io", [])
        cases = validated_data.pop("test_cases", [])
        problem = Problem.objects.create(**validated_data)
        self._save_related(problem, samples, cases)
        return problem

    @transaction.atomic
    def update(self, instance, validated_data):
        samples = validated_data.pop("sample_io", None)
        cases = validated_data.pop("test_cases", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        self._save_related(instance, samples, cases)
        return instance


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
    created_by = serializers.SerializerMethodField()

    def get_created_by(self, obj):
        return {"id": str(obj.created_by_id), "role": obj.created_by.role}

    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Problem
        fields = ["id", "_id", "title", "difficulty", "createdAt", "created_by"]

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
