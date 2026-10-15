from pathlib import Path

root=Path(__file__).resolve().parents[2]
p=root/'django_backend/apps/problems/views.py'
s=p.read_text()
s=s.replace('    ProblemUpdateSerializer,','    ProblemUpdateSerializer,\n    ProblemWriteSerializer,')
start=s.index('        data = request.data',s.index('    def post(self, request):'))
end=s.index('\n        serializer = ProblemDetailSerializer(problem)',start)
s=s[:start]+'''        serializer = ProblemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        problem = serializer.save(created_by=request.user)
'''+s[end:]
start=s.index('        data = request.data',s.index('    def put(self, request, id):'))
end=s.index('\n        serializer = ProblemDetailSerializer(problem)',start)
s=s[:start]+'''        serializer = ProblemWriteSerializer(problem, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        problem = serializer.save()
'''+s[end:]
p.write_text(s)
