from django.contrib import admin
from .models import Person, Address

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('building', 'locality', 'city', 'state', 'country', 'pincode')
    search_fields = ('city', 'state', 'locality')

@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ('name', 'surname', 'gender', 'phone', 'email', 'native_place')
    search_fields = ('name', 'surname', 'phone', 'email', 'native_place')
    list_filter = ('gender',)
