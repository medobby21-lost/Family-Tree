from collections import deque
from django.db.models import Q
from .models import Person

# =========================
# RELATION REDUCTION RULES
# =========================

RULES = {
    ("Amma", "Amma"): "Ammamma",
    ("Nanna", "Amma"): "Nannamma",
    ("Amma", "Nanna"): "Tatha",
    ("Nanna", "Nanna"): "Tatha",

    ("Amma", "Anna"): "Mama",
    ("Amma", "Tamudu"): "Mama",

    ("Amma", "Akka"): "Pedhamma",
    ("Amma", "Chellelu"): "Pinni",

    ("Nanna", "Anna"): "Pedhananna",
    ("Nanna", "Tamudu"): "Babai",

    ("Nanna", "Akka"): "Atha",
    ("Nanna", "Chellelu"): "Atha",

    ("Mama", "Bharya"): "Pinni",
    ("Babai", "Bharya"): "Pinni",

    ("Pedhananna", "Bharya"): "Pedhamma",
    ("Anna", "Bharya"): "Vadina",

    ("Akka", "Bhartha"): "Bava",
    ("Chellelu", "Bhartha"): "Bava",

    ("Bharya", "Anna"): "Bava",
    ("Bharya", "Tamudu"): "Maridi",

    ("Bhartha", "Akka"): "Adapaduchu",
    ("Bhartha", "Chellelu"): "Maradalu",

    ("Koduku", "Bharya"): "Kodalu",
    ("Koothuru", "Bhartha"): "Alludu",

    ("Koduku", "Koduku"): "Manavadu",
    ("Koduku", "Koothuru"): "Manavaralu",
    ("Koothuru", "Koduku"): "Manavadu",
    ("Koothuru", "Koothuru"): "Manavaralu",
}

def reduce_relations(path):
    path = path[:]
    changed = True
    while changed:
        changed = False
        for i in range(len(path) - 1):
            pair = (path[i], path[i + 1])
            if pair in RULES:
                new_rel = RULES[pair]
                path = path[:i] + [new_rel] + path[i + 2:]
                changed = True
                break
    return path[0] if len(path) == 1 else " -> ".join(path)


# =========================
# FAMILY GRAPH HELPERS
# =========================

def get_person_neighbors(person):
    neighbors = []
    if not person:
        return neighbors

    # Parents
    if person.father:
        neighbors.append((person.father, "Nanna"))
    if person.mother:
        neighbors.append((person.mother, "Amma"))

    # Spouse
    if person.spouse:
        neighbors.append((person.spouse, "Bharya" if person.spouse.gender == "F" else "Bhartha"))

    # Children
    children = Person.objects.filter(Q(father=person) | Q(mother=person))
    for child in children:
        rel = "Koduku" if child.gender == "M" else "Koothuru" if child.gender == "F" else "Child"
        neighbors.append((child, rel))

    # Siblings
    sibling_queries = []
    if person.father:
        sibling_queries.append(Q(father=person.father))
    if person.mother:
        sibling_queries.append(Q(mother=person.mother))

    if sibling_queries:
        query = sibling_queries[0]
        for q in sibling_queries[1:]:
            query = query | q

        siblings = Person.objects.filter(query).exclude(id=person.id)
        for sib in siblings:
            rel = "Anna" if sib.gender == "M" else "Akka" if sib.gender == "F" else "Sibling"
            # Younger/elder logic can be added if DOB available
            neighbors.append((sib, rel))

    return neighbors


# =========================
# BFS RELATION FINDER
# =========================

def find_all_relationships(person_a, person_b, max_depth=5):
    if person_a.id == person_b.id:
        return [{
            'chain': f"{person_a.name} {person_a.surname}",
            'relation': 'Self',
            'steps': [],
            'length': 0
        }]

    paths = []
    queue = deque([(person_a, [(person_a, None)])])

    while queue:
        curr, path_nodes = queue.popleft()
        if len(path_nodes) - 1 >= max_depth:
            continue

        neighbors = get_person_neighbors(curr)
        for nbh, rel_type in neighbors:
            visited_ids = [p.id for p, _ in path_nodes]
            if nbh.id in visited_ids:
                continue

            new_path = path_nodes + [(nbh, rel_type)]
            if nbh.id == person_b.id:
                paths.append(new_path)
            else:
                queue.append((nbh, new_path))

    results = []
    seen_chains = set()
    best_relations = {}

    for path in paths:
        chain_steps = []
        relations_list = []
        for i, (p, rel) in enumerate(path):
            if i == 0:
                chain_steps.append(f"{p.name} {p.surname}")
            else:
                chain_steps.append(f" ➔ ({rel}) ➔ {p.name} {p.surname}")
                relations_list.append(rel)

        chain_str = "".join(chain_steps)
        if chain_str in seen_chains:
            continue
        seen_chains.add(chain_str)

        relation_name = reduce_relations(relations_list)

        results.append({
            'chain': chain_str,
            'relation': relation_name,
            'steps': relations_list,
            'length': len(relations_list),
            'path_ids': [step[0].id for step in path]
        })

    return results
