# Generated by Django 5.1.3 on 2024-11-24 16:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ESIMS', '0002_alter_sale_id_contacto'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='productcategory',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='productsize',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
    ]