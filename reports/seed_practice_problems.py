import json
from django.db import transaction
from apps.users.models import User
from apps.problems.models import Problem, SampleIO, TestCase

specs = [
    ('Practice: Sum of Two Integers', 'easy', 'Read two integers and print their sum.', 'Two space-separated integers a and b.', 'Print a + b.', '-1000000000 <= a, b <= 1000000000', ['math'], [('2 3','5'), ('-7 4','-3'), ('0 0','0'), ('1000000000 1000000000','2000000000')]),
    ('Practice: Even or Odd', 'easy', 'Determine whether the given integer is even or odd.', 'One integer n.', 'Print EVEN if n is even, otherwise print ODD.', '-1000000000 <= n <= 1000000000', ['math','conditionals'], [('8','EVEN'), ('7','ODD'), ('0','EVEN'), ('-3','ODD')]),
    ('Practice: Maximum in an Array', 'easy', 'Find the largest number in the given array.', 'First line: integer n. Second line: n space-separated integers.', 'Print the largest array element.', '1 <= n <= 100000; -1000000000 <= each element <= 1000000000', ['arrays'], [('5\n3 8 2 9 4','9'), ('4\n-8 -3 -10 -5','-3'), ('1\n42','42'), ('5\n7 7 7 7 7','7')]),
    ('Practice: Palindrome Word', 'easy', 'Check whether a word reads the same forward and backward. Comparison is case-sensitive.', 'One word containing lowercase English letters.', 'Print YES for a palindrome, otherwise print NO.', '1 <= word length <= 100000', ['strings'], [('racecar','YES'), ('hello','NO'), ('a','YES'), ('abba','YES')]),
    ('Practice: Count Target Pairs', 'medium', 'Count pairs of distinct array positions i < j whose values sum to k. Count each position pair separately, including duplicate values.', 'First line: n and k. Second line: n space-separated integers.', 'Print the number of matching pairs.', '1 <= n <= 100000; -1000000000 <= k, each element <= 1000000000. The answer may require a 64-bit integer.', ['arrays','hash-map'], [('5 6\n1 5 3 3 2','2'), ('4 4\n2 2 2 2','6'), ('3 0\n-1 0 1','1'), ('1 10\n5','0')]),
]
owner = User.objects.get(username='codify_admin', role='admin')
result = []
with transaction.atomic():
    for title, difficulty, description, input_format, output_format, constraints, tags, cases in specs:
        problem, created = Problem.objects.get_or_create(created_by=owner, title=title, defaults=dict(description=description, difficulty=difficulty, input_format=input_format, output_format=output_format, constraints=constraints, tags=tags, total_marks=100))
        if created:
            for order, (inputs, outputs) in enumerate(cases):
                TestCase.objects.create(problem=problem, inputs=inputs, outputs=outputs, marks=25, cpu_time_limit=2, memory_limit=128, is_hidden=order >= 2, order=order)
                if order < 2:
                    SampleIO.objects.create(problem=problem, input=inputs, output=outputs, order=order)
        assert problem.test_cases.count() == 4
        assert problem.sample_io.count() == 2
        assert sum(problem.test_cases.values_list('marks', flat=True)) == 100
        result.append(dict(title=title, id=str(problem.pk), created=created))
print(json.dumps(result))
