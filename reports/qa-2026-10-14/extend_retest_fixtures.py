import json
from pathlib import Path
from apps.users.models import User
from apps.problems.models import Problem, TestCase

p=Path('/tmp/codify-live-audit-fixtures.json')
data=json.loads(p.read_text())
admin=User.objects.get(id=data['users']['admin']['id'])
admin.email=None
admin.save(update_fields=['email'])
faculty=User.objects.get(id=data['users']['faculty']['id'])
student=User.objects.get(id=data['users']['student']['id'])
problem=Problem.objects.create(title='QA temporary memory limit',description='Memory budget verification',created_by=faculty,total_marks=10)
problem.assigned_students.add(student)
TestCase.objects.create(problem=problem,inputs='',outputs='1',marks=10,memory_limit=8,cpu_time_limit=1)
data['memoryProblemId']=str(problem.id)
p.write_text(json.dumps(data))
print('Added memory-budget fixture and email-null temporary profile.')
