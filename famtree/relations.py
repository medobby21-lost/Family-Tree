from collections import deque
from django.db.models import Q
from .models import Person

def get_person_neighbors(person):
    """
    Returns a list of tuples (neighbor, relation_type) for direct relations.
    """
    neighbors = []
    if not person:
        return neighbors
        
    # 1. Father & Mother
    if person.father:
        neighbors.append((person.father, 'father'))
    if person.mother:
        neighbors.append((person.mother, 'mother'))
        
    # 2. Spouse
    if person.spouse:
        neighbors.append((person.spouse, 'spouse'))
        
    # 3. Children (people who have this person as father or mother)
    children = Person.objects.filter(Q(father=person) | Q(mother=person))
    for child in children:
        rel = 'son' if child.gender == 'M' else 'daughter' if child.gender == 'F' else 'child'
        neighbors.append((child, rel))
        
    # 4. Siblings (sharing father or mother, excluding self)
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
            shares_father = (person.father and sib.father == person.father)
            shares_mother = (person.mother and sib.mother == person.mother)
            
            is_full = False
            if person.father and person.mother:
                is_full = shares_father and shares_mother
            elif person.father:
                is_full = shares_father
            elif person.mother:
                is_full = shares_mother
                
            prefix = "" if is_full else "half-"
            rel = f"{prefix}brother" if sib.gender == 'M' else f"{prefix}sister" if sib.gender == 'F' else f"{prefix}sibling"
            neighbors.append((sib, rel))

    # Explicit siblings
    for sibling in person.siblings.exclude(id=person.id):
        if (sibling, 'brother') not in neighbors and (sibling, 'sister') not in neighbors and (sibling, 'half-brother') not in neighbors and (sibling, 'half-sister') not in neighbors:
            neighbors.append((sibling, 'brother' if sibling.gender == 'M' else 'sister'))
            
    return neighbors

def find_all_relationships(person_a, person_b, max_depth=5):
    """
    BFS to find all simple paths (up to max_depth steps) between person_a and person_b.
    Returns sorted list of paths with their translation and chains.
    """
    if person_a.id == person_b.id:
        return [{
            'chain': f"{person_a.name} {person_a.surname}",
            'relation': 'Self',
            'steps': [],
            'length': 0
        }]
        
    paths = []
    # Queue stores: (current_node, path_history)
    # where path_history is list of (Person, relation_to_this_node_from_prev)
    queue = deque([(person_a, [(person_a, None)])])
    
    while queue:
        curr, path_nodes = queue.popleft()
        
        if len(path_nodes) - 1 >= max_depth:
            continue
            
        neighbors = get_person_neighbors(curr)
        for nbh, rel_type in neighbors:
            # Check if already visited
            visited_ids = [p.id for p, _ in path_nodes]
            if nbh.id in visited_ids:
                continue
                
            new_path = path_nodes + [(nbh, rel_type)]
            
            if nbh.id == person_b.id:
                paths.append(new_path)
            else:
                queue.append((nbh, new_path))
                
    # Sort paths by length so shorter paths are processed first
    paths.sort(key=len)
    
    # Helper to get cached edges for a node to quickly check for shortcuts
    neighbors_cache = {}
    def get_edges(u):
        if u.id not in neighbors_cache:
            neighbors_cache[u.id] = get_person_neighbors(u)
        return neighbors_cache[u.id]

    results = []
    seen_chains = set() # Avoid exact duplicate chains
    
    for path in paths:
        # Check for chords (shortcuts) to eliminate redundant paths
        is_redundant = False
        n = len(path)
        for i in range(n):
            for j in range(i + 2, n):
                u = path[i][0]
                v = path[j][0]
                
                # Is there a direct edge between u and v?
                shortcut_rel = None
                for nbh, rel in get_edges(u):
                    if nbh.id == v.id:
                        shortcut_rel = rel
                        break
                        
                if shortcut_rel:
                    if shortcut_rel == 'spouse':
                        # If shortcut is spouse, it's a chord if the subpath has a spouse edge,
                        # OR if the subpath is length 2 (trivial detour through a single child)
                        subpath_length = j - i
                        subpath_has_spouse = any(path[k][1] == 'spouse' for k in range(i + 1, j + 1))
                        if subpath_has_spouse or subpath_length == 2:
                            is_redundant = True
                            break
                    else:
                        # Blood shortcut exists -> path is a detour
                        is_redundant = True
                        break
            if is_redundant:
                break
                
        if is_redundant:
            continue
            
        chain_steps = []
        relations_list = []
        
        for i, (p, rel) in enumerate(path):
            if i == 0:
                chain_steps.append(f"{p.name} {p.surname}")
            else:
                chain_steps.append(f" ➔ ({rel.replace('-', ' ')}) ➔ {p.name} {p.surname}")
                relations_list.append(rel)
                
        chain_str = "".join(chain_steps)
        if chain_str in seen_chains:
            continue
        seen_chains.add(chain_str)
        
        relation_name = translate_relation_path(path)
        
        path_ids = [step[0].id for step in path]
        
        results.append({
            'chain': chain_str,
            'relation': relation_name,
            'steps': relations_list,
            'length': len(relations_list),
            'path_ids': path_ids
        })
        
    return results

def translate_relation_path(path_steps):
    if len(path_steps) < 2:
        return "Self (Self)"
        
    rels = tuple(step[1] for step in path_steps[1:])
    
    def get_year(p):
        return p.dob.year if p and p.dob else 1980
        
    english = ""
    telugu = ""
    
    if rels == ('father',):
        english, telugu = "Father", "Nanna"
    elif rels == ('mother',):
        english, telugu = "Mother", "Amma"
    elif rels == ('son',):
        english, telugu = "Son", "Koduku"
    elif rels == ('daughter',):
        english, telugu = "Daughter", "Koothuru"
    elif rels == ('husband',) or (rels == ('spouse',) and path_steps[1][0].gender == 'M'):
        english, telugu = "Husband", "Bhartha"
    elif rels == ('wife',) or (rels == ('spouse',) and path_steps[1][0].gender == 'F'):
        english, telugu = "Wife", "Bharya"
    elif rels == ('brother',) or rels == ('half-brother',):
        is_half = "Half-" if rels == ('half-brother',) else ""
        if get_year(path_steps[1][0]) <= get_year(path_steps[0][0]):
            english, telugu = f"{is_half}Elder Brother", "Anna"
        else:
            english, telugu = f"{is_half}Younger Brother", "Thammudu"
    elif rels == ('sister',) or rels == ('half-sister',):
        is_half = "Half-" if rels == ('half-sister',) else ""
        if get_year(path_steps[1][0]) <= get_year(path_steps[0][0]):
            english, telugu = f"{is_half}Elder Sister", "Akka"
        else:
            english, telugu = f"{is_half}Younger Sister", "Chelli"
    elif rels == ('father', 'father'):
        english, telugu = "Father's Father", "Thaatha"
    elif rels == ('father', 'mother'):
        english, telugu = "Father's Mother", "Naanamma"
    elif rels == ('mother', 'father'):
        english, telugu = "Mother's Father", "Thaatha"
    elif rels == ('mother', 'mother'):
        english, telugu = "Mother's Mother", "Ammamma"
    elif rels in [('son', 'son'), ('daughter', 'son')]:
        english, telugu = "Grandson", "Manavadu"
    elif rels in [('son', 'daughter'), ('daughter', 'daughter')]:
        english, telugu = "Granddaughter", "Manavaralu"
    elif len(rels) == 3 and rels[0] in ('father', 'mother') and rels[1] in ('father', 'mother') and rels[2] == 'father':
        english, telugu = "Great Grandfather", "Muththaatha"
    elif len(rels) == 3 and rels[0] in ('father', 'mother') and rels[1] in ('father', 'mother') and rels[2] == 'mother':
        english, telugu = "Great Grandmother", "Muththavva"
    elif rels == ('spouse', 'father'):
        english, telugu = "Father-in-law", "Maamayya"
    elif rels == ('spouse', 'mother'):
        english, telugu = "Mother-in-law", "Aththa"
    elif rels == ('daughter', 'spouse'):
        english, telugu = "Son-in-law", "Alludu"
    elif rels == ('son', 'spouse'):
        english, telugu = "Daughter-in-law", "Kodalu"
    elif rels == ('spouse', 'brother'):
        me_gender = path_steps[0][0].gender
        if me_gender == 'M':
            english, telugu = "Wife's Brother", "Baava"
        else:
            english, telugu = "Husband's Brother", "Baava"
    elif rels == ('spouse', 'sister'):
        me_gender = path_steps[0][0].gender
        if me_gender == 'M':
            english, telugu = "Wife's Sister", "Maradalu"
        else:
            english, telugu = "Husband's Sister", "Aadabidda"
    elif rels == ('brother', 'spouse'):
        if get_year(path_steps[1][0]) <= get_year(path_steps[0][0]):
            english, telugu = "Elder Brother's Wife", "Vadina"
        else:
            english, telugu = "Younger Brother's Wife", "Maradalu"
    elif rels == ('sister', 'spouse'):
        english, telugu = "Sister's Husband", "Baava"
    elif rels == ('father', 'brother'):
        if get_year(path_steps[2][0]) <= get_year(path_steps[1][0]):
            english, telugu = "Father's Elder Brother", "Pedananna"
        else:
            english, telugu = "Father's Younger Brother", "Baabai"
    elif rels == ('father', 'sister'):
        english, telugu = "Father's Sister", "Aththa"
    elif rels == ('father', 'sister', 'spouse'):
        english, telugu = "Father's Sister's Husband", "Maamayya"
    elif rels == ('mother', 'brother'):
        english, telugu = "Mother's Brother", "Maamayya"
    elif rels == ('mother', 'sister'):
        english, telugu = "Mother's Sister", "Pinni"
    elif rels == ('mother', 'sister', 'spouse'):
        english, telugu = "Mother's Sister's Husband", "Baabai"
    elif rels in [('brother', 'son'), ('sister', 'son')]:
        english, telugu = "Brother/Sister's Son", "Alludu"
    elif rels in [('brother', 'daughter'), ('sister', 'daughter')]:
        english, telugu = "Brother/Sister's Daughter", "Kodalu"
    
    if not english:
        # Fallback to direct mapping for complex/unknown relations
        english = " -> ".join([r.capitalize() for r in rels])
        telugu = english
        
    return f"{english} - {telugu}"
