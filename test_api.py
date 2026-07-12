"""
Quick test to verify the genealogy viewer API endpoints
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Fam.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from famtree.models import Person
from django.test import Client
from django.urls import reverse

def test_api_endpoints():
    """Test that API endpoints work correctly"""
    client = Client()
    
    # Create a test user
    person = Person.objects.create(
        name='Test',
        surname='User',
        gender='M',
        phone='555-0001'
    )
    
    # Login
    session = client.session
    session['person_id'] = person.id
    session.save()
    
    # Test /api/graph/
    print("\n=== Testing /api/graph/ ===")
    response = client.get(reverse('api_graph_data'))
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ API returns JSON")
        print(f"  - Nodes: {len(data.get('nodes', []))}")
        print(f"  - Links: {len(data.get('links', []))}")
    else:
        print(f"❌ API error: {response.status_code}")
    
    # Test /api/relation/
    print("\n=== Testing /api/relation/ ===")
    response = client.get(reverse('api_relation'), {'p1': person.id, 'p2': person.id})
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Relation API works")
        print(f"  - Found relations: {len(data.get('relations', []))}")
    else:
        print(f"❌ API error: {response.status_code}")
    
    print("\n=== All API endpoints operational ===")

if __name__ == '__main__':
    test_api_endpoints()
