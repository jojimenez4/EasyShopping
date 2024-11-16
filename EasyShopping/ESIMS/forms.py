from django.forms import ModelForm
from .models import Product

class AñadirProductoForm(ModelForm):
    class Meta:
        model = Product
        fields = ['name', 'medida', 'price', 'stock']

class EditarProductoForm(ModelForm):
    class Meta:
        model = Product
        fields = ['price', 'stock']