from django.core.management.base import BaseCommand
from famtree.models import Person


class Command(BaseCommand):
    help = 'Make the siblings relationship transitive: if A~B and B~C then A~C.'

    def handle(self, *args, **options):
        people = list(Person.objects.all())
        # Build adjacency
        adj = {p.id: set(s.id for s in p.siblings.all()) for p in people}

        visited = set()
        total_added = 0
        for p in people:
            if p.id in visited:
                continue
            # BFS component
            comp = set()
            stack = [p.id]
            while stack:
                cur = stack.pop()
                if cur in comp:
                    continue
                comp.add(cur)
                visited.add(cur)
                for nb in adj.get(cur, set()):
                    if nb not in comp:
                        stack.append(nb)

            if len(comp) <= 1:
                continue

            # For each member, ensure siblings include all others in comp
            comp_list = list(comp)
            for pid in comp_list:
                person = Person.objects.get(id=pid)
                to_add = [Person.objects.get(id=x) for x in comp_list if x != pid]
                before_count = person.siblings.count()
                for other in to_add:
                    person.siblings.add(other)
                after_count = person.siblings.count()
                total_added += max(0, after_count - before_count)

        self.stdout.write(self.style.SUCCESS(f'Siblings transitive closure applied. Total sibling links added: {total_added}'))
