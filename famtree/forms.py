from django import forms
from .models import Person, Address

class MemberForm(forms.ModelForm):
    # Address fields integrated inline
    building = forms.CharField(max_length=255, required=False, label="Building/House No.")
    locality = forms.CharField(max_length=255, required=False, label="Locality/Street")
    city = forms.CharField(max_length=100, required=False, label="City")
    state = forms.CharField(max_length=100, required=False, label="State")
    country = forms.CharField(max_length=100, required=False, initial='India', label="Country")
    pincode = forms.CharField(max_length=20, required=False, label="Pin Code")

    class Meta:
        model = Person
        fields = [
            'surname', 'name', 'gender', 'dob', 'dod', 'phone', 
            'email', 'photo', 'native_place', 'father', 'mother', 'spouse'
        ]
        widgets = {
            'dob': forms.DateInput(attrs={'type': 'date'}),
            'dod': forms.DateInput(attrs={'type': 'date'}),
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Apply a CSS class helper to style form fields in Obsidian colors
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = 'obsidian-input'
            
        # Refine choice lists for relatives to only show suitable matching People (avoiding self)
        if self.instance and self.instance.pk:
            self.fields['father'].queryset = Person.objects.exclude(id=self.instance.pk).order_by('name')
            self.fields['mother'].queryset = Person.objects.exclude(id=self.instance.pk).order_by('name')
            self.fields['spouse'].queryset = Person.objects.exclude(id=self.instance.pk).order_by('name')
        else:
            self.fields['father'].queryset = Person.objects.all().order_by('name')
            self.fields['mother'].queryset = Person.objects.all().order_by('name')
            self.fields['spouse'].queryset = Person.objects.all().order_by('name')
            
        # Prefill Address fields if instance exists and has address
        if self.instance and self.instance.pk and self.instance.address:
            addr = self.instance.address
            self.fields['building'].initial = addr.building
            self.fields['locality'].initial = addr.locality
            self.fields['city'].initial = addr.city
            self.fields['state'].initial = addr.state
            self.fields['country'].initial = addr.country
            self.fields['pincode'].initial = addr.pincode
            
    def save(self, commit=True):
        building = self.cleaned_data.get('building')
        locality = self.cleaned_data.get('locality')
        city = self.cleaned_data.get('city')
        state = self.cleaned_data.get('state')
        country = self.cleaned_data.get('country')
        pincode = self.cleaned_data.get('pincode')
        
        has_address = any([building, locality, city, state, country, pincode])
        
        if has_address:
            if self.instance.address:
                # Update existing address
                addr = self.instance.address
                addr.building = building
                addr.locality = locality
                addr.city = city
                addr.state = state
                addr.country = country
                addr.pincode = pincode
                addr.save()
            else:
                # Create a new address
                addr = Address.objects.create(
                    building=building,
                    locality=locality,
                    city=city,
                    state=state,
                    country=country,
                    pincode=pincode
                )
                self.instance.address = addr
        else:
            # Clear reference if nothing is provided
            if self.instance.address:
                self.instance.address = None
                
        return super().save(commit=commit)
