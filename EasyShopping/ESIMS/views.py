from django.shortcuts import redirect, render, get_object_or_404
from .models import Product, Sale,SaleDetail, Product
from django.contrib.auth.decorators import login_required
from .forms import AñadirProductoForm,CrearCategoriaForm, CrearMedidaForm, SaleForm, SaleDetailForm
from django.db.models import Q,F
from .models import Product, ProductSize, ProductCategory
from django.forms import modelformset_factory

@login_required
def inventario(request):
    # Obtener parámetros de búsqueda
    id_producto = request.GET.get('id', '')
    nombre = request.GET.get('nombre', '')
    precio_min = request.GET.get('precio_min', '')
    precio_max = request.GET.get('precio_max', '')
    stock_min = request.GET.get('stock_min', '')
    stock_max = request.GET.get('stock_max', '')
    categoria = request.GET.get('categoria', '')
    medida = request.GET.get('medida', '')

    # Consulta base
    productos = Product.objects.all()

    # Filtros aplicados
    if id_producto:
        productos = productos.filter(id=id_producto)

    if nombre:
        productos = productos.filter(name__icontains=nombre)

    if precio_min:
        productos = productos.filter(price__gte=precio_min)

    if precio_max:
        productos = productos.filter(price__lte=precio_max)

    if stock_min:
        productos = productos.filter(stock__gte=stock_min)

    if stock_max:
        productos = productos.filter(stock__lte=stock_max)

    if categoria:
        productos = productos.filter(id_categoria_id=categoria)

    if medida:
        productos = productos.filter(medida_id=medida)
        
    # Ordenación
    ordenar_por = request.GET.get('ordenar_por', 'id')  # Orden predeterminado por ID
    orden = request.GET.get('orden', 'asc')  # Ascendente por defecto
    if ordenar_por in ['id','name', 'price', 'stock']:
        if orden == 'desc':
            productos = productos.order_by(f"-{ordenar_por}")
        else:
            productos = productos.order_by(ordenar_por)

    # Determina el orden invertido para el template
    nuevo_orden = 'desc' if orden == 'asc' else 'asc'
    # Contexto para filtros y resultados
    context = {
        'producto': productos,
        'categorias': ProductCategory.objects.all(),
        'medidas': ProductSize.objects.all(),
        'orden': orden,
        'nuevo_orden': nuevo_orden,
        'ordenar_por': ordenar_por,
    }
    return render(request, 'inventory/index.html', context)

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

@login_required
def pedidos_view(request):
    pedidos = Sale.objects.all()

    for pedido in pedidos:
        # Obtener los detalles de la venta
        detalle_venta = SaleDetail.objects.filter(id_venta=pedido)

        # Agregar el precio total a la venta (sumando todos los totales de los detalles)
        pedido.precio_total = sum(detalle.total for detalle in detalle_venta)

    return render(request, 'pedidos/pedidos.html', {'pedidos': pedidos})


@login_required
def crear_categoria(request):
    if request.method == 'POST':
        form = CrearCategoriaForm(request.POST)
        if form.is_valid():
            form.save()  # Guarda la nueva categoría
            return redirect('inventario')  # Redirige al inventario
    else:
        form = CrearCategoriaForm()
    return render(request, 'inventory/crear_categoria.html', {'form': form})



@login_required
def crear_medida(request):
    if request.method == 'POST':
        form = CrearMedidaForm(request.POST)
        if form.is_valid():
            form.save()  # Guarda la nueva unidad de medida
            return redirect('inventario')  # Redirige al inventario
    else:
        form = CrearMedidaForm()
    return render(request, 'inventory/crear_medida.html', {'form': form})

@login_required
def generar_pedido(request):
    productos = Product.objects.all()  # Todos los productos

    if request.method == 'POST':
        sale_form = SaleForm(request.POST)
        productos_ids = request.POST.getlist('products[]')
        cantidades = request.POST.getlist('cantidades[]')

        if sale_form.is_valid() and productos_ids and cantidades:
            sale = sale_form.save()

            for product_id, cantidad in zip(productos_ids, cantidades):
                if product_id and cantidad:
                    producto = Product.objects.get(id=product_id)
                    SaleDetail.objects.create(
                        id_venta=sale,
                        id_product=producto,
                        cantidad=int(cantidad),
                        precio_unitario=producto.price,
                    )

            return redirect('pedidos')  # Redirige a la lista de pedidos

    else:
        sale_form = SaleForm()

    return render(request, 'pedidos/generar_pedido.html', {
        'sale_form': sale_form,
        'productos': productos,
    })
    
@login_required
def detalle_pedido_view(request, id):
    pedido = get_object_or_404(Sale, id=id)
    detalles = SaleDetail.objects.filter(id_venta=pedido)
    return render(request, 'pedidos/detalle_pedido.html', {
        'pedido': pedido,
        'detalles': detalles,
    })
