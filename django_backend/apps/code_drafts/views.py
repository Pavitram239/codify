from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.code_drafts.models import CodeDraft
from apps.code_drafts.serializers import CodeDraftModelSerializer, CodeDraftSaveSerializer
from apps.problems.models import Problem


class SaveCodeDraftView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CodeDraftSaveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid data", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        problem_id = serializer.validated_data["problemId"]
        code_by_language = serializer.validated_data["codeByLanguage"]

        # Ensure problem exists
        if not Problem.objects.filter(id=problem_id).exists():
            return Response(
                {"success": False, "message": "Problem not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        code_draft, _ = CodeDraft.objects.update_or_create(
            user=request.user,
            problem_id=problem_id,
            defaults={"code_by_language": code_by_language},
        )

        return Response(
            {
                "success": True,
                "message": "Code saved successfully",
                "code": CodeDraftModelSerializer(code_draft).data,
            },
            status=status.HTTP_200_OK,
        )


class GetCodeDraftView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get("problemId")
        if not problem_id:
            return Response(
                {"success": False, "message": "problemId query param is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            code_draft = CodeDraft.objects.get(user=request.user, problem_id=problem_id)
            return Response(
                {"success": True, "code": code_draft.code_by_language},
                status=status.HTTP_200_OK,
            )
        except CodeDraft.DoesNotExist:
            return Response(
                {"success": True, "code": {}},
                status=status.HTTP_200_OK,
            )
