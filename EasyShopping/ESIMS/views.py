from django.shortcuts import redirect, render, get_object_or_404
from .models import Product
from django.contrib.auth.decorators import login_required
from .forms import AñadirProductoForm

@login_required
def inventario(request):
    productos = Product.objects.all()
    context = {
        "title": "Inventario",
        "producto": productos,
    }
    return render(request, 'inventory/index.html', context=context,)

@login_required
def añadir_producto(request):
    if request.method == 'POST':
        form = AñadirProductoForm(request.POST)
        if form.is_valid():
            new_product = form.save(commit=False)
            new_product.save()
            return redirect('/inventario/')
    else:
        form = AñadirProductoForm()
    return render(request, 'inventory/añadir_producto.html', {'form': form})

@login_required
def eliminar_producto(request, pk):
    product = get_object_or_404(Product, pk=pk)
    product.delete()
    return redirect('/inventario/')

@login_required
def editar_producto(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method == 'POST':
        form = AñadirProductoForm(request.POST, instance=product)
        if form.is_valid():
            product.price = form.cleaned_data['price']
            product.stock = form.cleaned_data['stock']
            product.save()
            return redirect('/inventario/')
    else:
        form = AñadirProductoForm(instance=product)
    return render(request, 'inventory/editar_producto.html', {'form': form})

