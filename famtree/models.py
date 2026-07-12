from django.db import models

class Address(models.Model):
    building = models.CharField(max_length=255, blank=True)
    locality = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True, default='India')
    pincode = models.CharField(max_length=20, blank=True)

    def __str__(self):
        parts = [self.building, self.locality, self.city, self.state, self.country]
        return ", ".join([p for p in parts if p])

class Person(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    surname = models.CharField(max_length=100)
    name = models.CharField(max_length=100)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    dob = models.DateField(null=True, blank=True, verbose_name="Date of Birth")
    dod = models.DateField(null=True, blank=True, verbose_name="Date of Death")
    
    father = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='children_father'
    )
    mother = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='children_mother'
    )
    spouse = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='spouse_relation'
    )
    siblings = models.ManyToManyField(
        'self', blank=True
    )
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    address = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, blank=True)
    photo = models.ImageField(upload_to='photos/', null=True, blank=True)
    native_place = models.CharField(max_length=255, null=True, blank=True)
    # Optional layout override saved by users (server-side persistence)
    x = models.FloatField(null=True, blank=True)
    y = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} {self.surname}"

    def save(self, *args, **kwargs):
        # Prevent self-marriage
        if self.spouse == self:
            self.spouse = None
        
        # Save first to get ID
        super().save(*args, **kwargs)
        
        # Symmetrical spouse handling
        if self.spouse:
            # If our spouse's spouse is not us, update them
            if self.spouse.spouse != self:
                self.spouse.spouse = self
                # Use update to prevent infinite recursion
                Person.objects.filter(id=self.spouse.id).update(spouse=self)
        else:
            # If we had a spouse previously, break the link
            Person.objects.filter(spouse=self).exclude(id=self.id).update(spouse=None)