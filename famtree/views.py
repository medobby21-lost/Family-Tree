from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.contrib.auth import logout as auth_logout
from django.views.decorators.csrf import csrf_exempt
import json

from .models import Person, Address
from .relations import find_all_relationships
from .forms import MemberForm

def get_viewer(request):
    """
    Helper to get the current authorized person who is viewing/editing.
    Returns either a Person object, the string "admin", or None.
    """
    if request.user.is_authenticated and (request.user.is_superuser or request.user.is_staff):
        first_person = Person.objects.first()
        return first_person or "admin"
        
    person_id = request.session.get('person_id')
    if person_id:
        try:
            return Person.objects.get(id=person_id)
        except Person.DoesNotExist:
            return None
    return None

def login_view(request):
    if get_viewer(request):
        return redirect('home')
        
    if not Person.objects.exists():
        return redirect('add_first_member')
        
    error = None
    if request.method == 'POST':
        phone = request.POST.get('phone', '').strip()
        if phone:
            try:
                person = Person.objects.get(phone=phone)
                request.session['person_id'] = person.id
                return redirect('home')
            except Person.DoesNotExist:
                error = "Phone number not found in family tree. Please contact administration."
        else:
            error = "Please enter a valid phone number."
            
    return render(request, 'famtree/login.html', {'error': error})

def logout_view(request):
    auth_logout(request)
    if 'person_id' in request.session:
        del request.session['person_id']
    return redirect('login')

def home(request):
    if not Person.objects.exists():
        return redirect('add_first_member')
        
    viewer = get_viewer(request)
    if not viewer:
        return redirect('login')
        
    all_people = Person.objects.all().order_by('name')
    is_admin = False
    
    if viewer == "admin" or (request.user.is_authenticated and (request.user.is_superuser or request.user.is_staff)):
        is_admin = True
        viewer_person = Person.objects.first()
    else:
        viewer_person = viewer
        
    context = {
        'viewer': viewer_person,
        'all_people': all_people,
        'is_admin': is_admin,
    }
    return render(request, 'famtree/home.html', context)

def api_graph_data(request):
    if not get_viewer(request):
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    people = list(Person.objects.all())
    
    # 1. Resolve generations (top-down: ancestors at top, i.e. 0, youngers below)
    generations = {}
    
    # Base case: people with no parents are generation 0
    for p in people:
        if not p.father and not p.mother:
            generations[p.id] = 0
            
    # Iterative propagation: Parents push to children, spouses balance each other
    changed = True
    iterations = 0
    while changed and iterations < 30:
        changed = False
        iterations += 1
        for p in people:
            current_gen = generations.get(p.id)
            new_gen = current_gen
            
            # Inherit from parents
            father_gen = generations.get(p.father.id) if p.father else None
            mother_gen = generations.get(p.mother.id) if p.mother else None
            parent_gens = [g for g in [father_gen, mother_gen] if g is not None]
            
            if parent_gens:
                calc_gen = max(parent_gens) + 1
                if new_gen is None or calc_gen > new_gen:
                    new_gen = calc_gen
                    
            # Inherit from spouse
            if p.spouse:
                spouse_gen = generations.get(p.spouse.id)
                if spouse_gen is not None:
                    if new_gen is None or spouse_gen > new_gen:
                        new_gen = spouse_gen
                        
            # Apply update if changed
            if new_gen != current_gen and new_gen is not None:
                generations[p.id] = new_gen
                changed = True
                
            # Push our new generation to our spouse if ours is higher
            if p.spouse and new_gen is not None:
                spouse_gen = generations.get(p.spouse.id)
                if spouse_gen is None or new_gen > spouse_gen:
                    generations[p.spouse.id] = new_gen
                    changed = True
                
    # Fallback to keep everything valid
    for p in people:
        if p.id not in generations:
            generations[p.id] = 0

    # Build equivalence classes for spouse and sibling relationships.
    # All people in the same class must share the same generation.
    parent = {p.id: p.id for p in people}
    def find(u):
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u
    def union(u, v):
        ru = find(u)
        rv = find(v)
        if ru != rv:
            parent[rv] = ru

    for p in people:
        if p.spouse:
            union(p.id, p.spouse.id)
        for sibling in p.siblings.all():
            union(p.id, sibling.id)

    for p in people:
        parent[p.id] = find(p.id)

    comp_gen = {root: 0 for root in set(parent.values())}
    comp_of = lambda pid: parent[pid]

    changed = True
    while changed:
        changed = False
        for p in people:
            child_comp = comp_of(p.id)
            for parent_obj in (p.father, p.mother):
                if parent_obj:
                    parent_comp = comp_of(parent_obj.id)
                    if parent_comp == child_comp:
                        continue
                    required = comp_gen[parent_comp] + 1
                    if comp_gen[child_comp] < required:
                        comp_gen[child_comp] = required
                        changed = True

    for p in people:
        generations[p.id] = comp_gen[comp_of(p.id)]

    nodes = []
    links = []
    seen_spouse_links = set()
    
    for p in people:
        photo_url = p.photo.url if p.photo else None
        dob_year = p.dob.year if p.dob else 1980
        
        layout_dob = dob_year
        if p.spouse:
            spouse_dob = p.spouse.dob.year if p.spouse.dob else 1980
            layout_dob = (dob_year + spouse_dob) / 2.0
            
        nodes.append({
            'id': p.id,
            'name': p.name,
            'surname': p.surname,
            'gender': p.gender,
            'photo': photo_url,
            'dob': p.dob.strftime('%Y-%m-%d') if p.dob else None,
            'dod': p.dod.strftime('%Y-%m-%d') if p.dod else None,
            'dob_year': dob_year,
            'layout_dob': layout_dob,
            'phone': p.phone or "",
            'email': p.email or "",
            'native_place': p.native_place or "",
            'address': str(p.address) if p.address else "",
            'generation': generations.get(p.id, 0)
        })
        # include server-saved positions if present
        if p.x is not None:
            nodes[-1]['x'] = float(p.x)
        if p.y is not None:
            nodes[-1]['y'] = float(p.y)
        
        if p.father:
            links.append({
                'source': p.father.id,
                'target': p.id,
                'type': 'father-child'
            })
        if p.mother:
            links.append({
                'source': p.mother.id,
                'target': p.id,
                'type': 'mother-child'
            })
            
        if p.spouse:
            pair = tuple(sorted([p.id, p.spouse.id]))
            if pair not in seen_spouse_links:
                seen_spouse_links.add(pair)
                links.append({
                    'source': p.id,
                    'target': p.spouse.id,
                    'type': 'spouse'
                })
                
        # Explicit sibling links for parentless nodes
        for sibling in p.siblings.all():
            if p.id < sibling.id: # Avoid duplicates
                shares_parent = (p.father and sibling.father and p.father.id == sibling.father.id) or \
                                (p.mother and sibling.mother and p.mother.id == sibling.mother.id)
                if not shares_parent:
                    links.append({
                        'source': p.id,
                        'target': sibling.id,
                        'type': 'sibling'
                    })
                
    return JsonResponse({'nodes': nodes, 'links': links})


@csrf_exempt
def api_save_positions(request):
    """Accept POST requests to save node positions.

    Accepts either:
      - JSON body with {"positions": {"<id>": {"x":..., "y":...}, ...}}
      - JSON body with {"id": <id>, "x":..., "y":...}

    Requires authenticated viewer (same check as other APIs).
    """
    if not get_viewer(request):
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method != 'POST':
        return HttpResponseBadRequest('POST required')

    try:
        body = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return HttpResponseBadRequest('Invalid JSON')

    updates = {}
    if 'positions' in body and isinstance(body['positions'], dict):
        updates = body['positions']
    elif 'id' in body and ('x' in body or 'y' in body):
        updates = {str(body['id']): {'x': body.get('x'), 'y': body.get('y')}}
    else:
        return HttpResponseBadRequest('Missing position data')

    # Validate and apply updates
    applied = []
    for sid, coords in updates.items():
        try:
            pid = int(sid)
        except Exception:
            continue
        try:
            p = Person.objects.get(id=pid)
            changed = False
            if 'x' in coords and coords['x'] is not None:
                p.x = float(coords['x'])
                changed = True
            if 'y' in coords and coords['y'] is not None:
                p.y = float(coords['y'])
                changed = True
            if changed:
                p.save()
                applied.append(pid)
        except Person.DoesNotExist:
            continue

    return JsonResponse({'status': 'ok', 'updated': applied})

def api_relation(request):
    if not get_viewer(request):
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    p1_id = request.GET.get('p1')
    p2_id = request.GET.get('p2')
    
    if not p1_id or not p2_id:
        return JsonResponse({'error': 'Missing parameters'}, status=400)
        
    try:
        p1 = Person.objects.get(id=p1_id)
        p2 = Person.objects.get(id=p2_id)
    except Person.DoesNotExist:
        return JsonResponse({'error': 'Person not found'}, status=404)
        
    relations = find_all_relationships(p1, p2)
    return JsonResponse({'relations': relations})

def add_relative(request, relative_to_id):
    if not get_viewer(request):
        return redirect('login')
        
    rel_person = get_object_or_404(Person, id=relative_to_id)
    relation_type = request.GET.get('type', 'child')  # father, mother, spouse, child, sibling
    existing_people = Person.objects.exclude(id=relative_to_id).order_by('name')
    
    if request.method == 'POST':
        # Check if linking an existing member
        if 'link_member' in request.POST:
            link_id = request.POST.get('link_member_id')
            if link_id:
                linked_member = get_object_or_404(Person, id=link_id)
                
                # Apply relation to existing member
                if relation_type == 'father':
                    rel_person.father = linked_member
                    rel_person.save()
                elif relation_type == 'mother':
                    rel_person.mother = linked_member
                    rel_person.save()
                elif relation_type == 'spouse':
                    rel_person.spouse = linked_member
                    rel_person.save()
                elif relation_type == 'child':
                    if rel_person.gender == 'M':
                        linked_member.father = rel_person
                    elif rel_person.gender == 'F':
                        linked_member.mother = rel_person
                    linked_member.save()
                elif relation_type == 'sibling':
                    linked_member.father = rel_person.father
                    linked_member.mother = rel_person.mother
                    linked_member.save()
                    rel_person.siblings.add(linked_member)
                    linked_member.siblings.add(rel_person)
                    
                return redirect('home')
        
        # Otherwise, registering a new member
        form = MemberForm(request.POST, request.FILES)
        if form.is_valid():
            new_person = form.save(commit=False)
            
            if relation_type == 'father':
                new_person.gender = 'M'
                new_person.save()
                rel_person.father = new_person
                rel_person.save()
            elif relation_type == 'mother':
                new_person.gender = 'F'
                new_person.save()
                rel_person.mother = new_person
                rel_person.save()
            elif relation_type == 'spouse':
                new_person.save()
                rel_person.spouse = new_person
                rel_person.save()
            elif relation_type == 'child':
                new_person.save()
                if rel_person.gender == 'M':
                    new_person.father = rel_person
                elif rel_person.gender == 'F':
                    new_person.mother = rel_person
                new_person.save()
            elif relation_type == 'sibling':
                new_person.father = rel_person.father
                new_person.mother = rel_person.mother
                new_person.save()
                rel_person.siblings.add(new_person)
                new_person.siblings.add(rel_person)
            else:
                new_person.save()
                
            form.save_m2m()
            return redirect('home')
    else:
        initial_data = {}
        if relation_type in ['father', 'sibling', 'child']:
            initial_data['surname'] = rel_person.surname
            initial_data['native_place'] = rel_person.native_place
            
        initial_gender = 'O'
        if relation_type == 'father':
            initial_gender = 'M'
        elif relation_type == 'mother':
            initial_gender = 'F'
        elif relation_type == 'spouse':
            initial_gender = 'F' if rel_person.gender == 'M' else 'M'
            
        initial_data['gender'] = initial_gender
        form = MemberForm(initial=initial_data)
        
    context = {
        'form': form,
        'title': f"Add {relation_type.capitalize()} for {rel_person.name} {rel_person.surname}",
        'rel_person': rel_person,
        'relation_type': relation_type,
        'existing_people': existing_people,
    }
    return render(request, 'famtree/manage_member.html', context)


def edit_member(request, member_id):
    if not get_viewer(request):
        return redirect('login')

    person = get_object_or_404(Person, id=member_id)
    is_modal = bool(request.GET.get('modal') or request.POST.get('modal'))

    if request.method == 'POST':
        form = MemberForm(request.POST, request.FILES, instance=person)
        if form.is_valid():
            form.save()
            if is_modal:
                return JsonResponse({'status': 'ok'})
            return redirect('home')
        if is_modal:
            return render(request, 'famtree/member_form_fragment.html', {
                'form': form,
                'person': person,
                'is_edit': True,
            })
    else:
        form = MemberForm(instance=person)

    if is_modal:
        return render(request, 'famtree/member_form_fragment.html', {
            'form': form,
            'person': person,
            'is_edit': True,
        })

    context = {
        'form': form,
        'title': f"Edit Profile: {person.name} {person.surname}",
        'person': person,
        'is_edit': True,
    }
    return render(request, 'famtree/manage_member.html', context)

def add_first_member(request):
    if Person.objects.exists() and not (request.user.is_authenticated and request.user.is_superuser):
        return redirect('login')
        
    if request.method == 'POST':
        form = MemberForm(request.POST, request.FILES)
        if form.is_valid():
            person = form.save()
            # Set the viewer session automatically
            request.session['person_id'] = person.id
            return redirect('home')
    else:
        form = MemberForm()
        
    context = {
        'form': form,
        'title': "Create First Family Member",
        'is_first': True
    }
    return render(request, 'famtree/manage_member.html', context)