from rest_framework import serializers
from apps.submissions.models import Submission, TestCaseResult
from apps.users.models import User
from apps.problems.models import Problem


class TestCaseResultSerializer(serializers.ModelSerializer):
    expectedOutput = serializers.CharField(source="expected_output")
    input = serializers.SerializerMethodField()
    output = serializers.SerializerMethodField()

    class Meta:
        model = TestCaseResult
        fields = [
            "input",
            "output",
            "expectedOutput",
            "passed",
            "time",
            "memory",
            "is_hidden",
            "marks",
        ]

    def get_input(self, obj):
        if self.context.get("mask_hidden", False) and obj.is_hidden:
            return "****"
        return obj.input

    def get_output(self, obj):
        if self.context.get("mask_hidden", False) and obj.is_hidden:
            return "****"
        return obj.output or ""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self.context.get("mask_hidden", False) and instance.is_hidden:
            data["expectedOutput"] = "****"
        return data


class UserProblemSubmissionSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Submission
        fields = [
            "_id",
            "status",
            "language",
            "memory_usage",
            "execution_time",
            "createdAt",
        ]

    def get__id(self, obj):
        return str(obj.id)


class ProblemLeaderboardStudentSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["_id", "id", "username", "batch", "branch", "semester", "role"]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return obj.student_id or str(obj.id)


class ProblemSubmissionSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    numberOfTestCase = serializers.IntegerField(source="number_of_test_cases")
    numberOfTestCasePass = serializers.IntegerField(source="number_of_test_cases_pass")
    totalMarks = serializers.IntegerField(source="total_marks")
    createdAt = serializers.DateTimeField(source="created_at")
    user_id = ProblemLeaderboardStudentSerializer(source="user")

    class Meta:
        model = Submission
        fields = [
            "_id",
            "language",
            "status",
            "numberOfTestCase",
            "numberOfTestCasePass",
            "createdAt",
            "totalMarks",
            "user_id",
        ]

    def get__id(self, obj):
        return str(obj.id)


class SubmissionHistoryProblemSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = ["_id", "title"]

    def get__id(self, obj):
        return str(obj.id)


class UserSubmissionHistorySerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    numberOfTestCase = serializers.IntegerField(source="number_of_test_cases")
    numberOfTestCasePass = serializers.IntegerField(source="number_of_test_cases_pass")
    totalMarks = serializers.IntegerField(source="total_marks")
    createdAt = serializers.DateTimeField(source="created_at")
    problem_id = SubmissionHistoryProblemSerializer(source="problem")

    class Meta:
        model = Submission
        fields = [
            "_id",
            "language",
            "status",
            "numberOfTestCase",
            "numberOfTestCasePass",
            "createdAt",
            "totalMarks",
            "problem_id",
        ]

    def get__id(self, obj):
        return str(obj.id)


class SubmissionDetailSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    problem_id = serializers.SerializerMethodField()
    numberOfTestCase = serializers.IntegerField(source="number_of_test_cases")
    numberOfTestCasePass = serializers.IntegerField(source="number_of_test_cases_pass")
    totalMarks = serializers.IntegerField(source="total_marks")
    createdAt = serializers.DateTimeField(source="created_at")
    testCaseResults = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "_id",
            "user_id",
            "problem_id",
            "code",
            "language",
            "status",
            "execution_time",
            "memory_usage",
            "numberOfTestCase",
            "numberOfTestCasePass",
            "totalMarks",
            "testCaseResults",
            "createdAt",
        ]

    def get__id(self, obj):
        return str(obj.id)

    def get_user_id(self, obj):
        return {
            "_id": str(obj.user.id),
            "role": obj.user.role,
            "username": obj.user.username,
        }

    def get_problem_id(self, obj):
        return {
            "_id": str(obj.problem.id),
            "title": obj.problem.title,
        }

    def get_testCaseResults(self, obj):
        mask_hidden = self.context.get("mask_hidden", False)
        return TestCaseResultSerializer(
            obj.test_case_results.all(),
            many=True,
            context={"mask_hidden": mask_hidden},
        ).data
