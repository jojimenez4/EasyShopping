from django import forms
from django.forms import ModelForm
from django.forms import modelformset_factory
from .models import Product, ProductSize, ProductCategory, Sale, SaleDetail

class AñadirProductoForm(ModelForm):
    medida_id = forms.ModelChoiceField(
        queryset=ProductSize.objects.all(),
        widget=forms.Select(),
        label="Medida"
    )
    id_categoria = forms.ModelChoiceField(
        queryset=ProductCategory.objects.all(),
        widget=forms.Select(),
        label="Categoría"
    )

    class Meta:
        model = Product
        fields = ['name', 'medida_id', 'price', 'stock', 'id_categoria']

class EditarProductoForm(ModelForm):
    class Meta:
        model = Product
        fields = ['price', 'stock']
        
class CrearCategoriaForm(forms.ModelForm):
    class Meta:
        model = ProductCategory
        fields = ['nombre_categoria']
        widgets = {
            'nombre_categoria': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre de la Categoría'}),
        }

class CrearMedidaForm(forms.ModelForm):
    class Meta:
        model = ProductSize
        fields = ['name']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre de la Unidad de Medida'}),
        }

class SaleForm(forms.ModelForm):
    class Meta:
        model = Sale
        fields = ['id_contacto', 'estado_pedido']  
        widgets = {
            'id_contacto': forms.Select(attrs={'class': 'form-control'}),
            'estado_pedido': forms.Select(attrs={'class': 'form-control'}),
        }


class SaleDetailForm(forms.ModelForm):
    class Meta:
        model = SaleDetail
        fields = ['id_product', 'cantidad']
        widgets = {
            'id_product': forms.Select(attrs={'class': 'form-control'}),
            'cantidad': forms.NumberInput(attrs={'class': 'form-control', 'min': 1}),
        }

SaleDetailFormSet = modelformset_factory(
    SaleDetail,
    form=SaleDetailForm,
    extra=1,
    can_delete=True
)