"""Add x,y fields to Person for saving node positions

Generated migration for adding position fields.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('famtree', '0002_person_siblings'),
    ]

    operations = [
        migrations.AddField(
            model_name='person',
            name='x',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='person',
            name='y',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
