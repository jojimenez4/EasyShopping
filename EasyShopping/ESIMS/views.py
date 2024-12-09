from django.shortcuts import redirect, render, get_object_or_404
from .models import Product, Sale,SaleDetail, Product, ProductSize, ProductCategory
from django.contrib.auth.decorators import login_required
from .forms import AñadirProductoForm,CrearCategoriaForm, CrearMedidaForm, SaleForm, SaleDetailForm, Product,ProductCategory,ProductSize
from django.db.models import Q,F
from django.contrib import messages
from django.http import JsonResponse

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
    if ordenar_por in ['id', 'name', 'price', 'stock', 'id_categoria', 'medida']:
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
    producto = get_object_or_404(Product, pk=pk)
    producto.is_active = False
    producto.save()
    messages.success(request, f"Producto {producto.name} desactivado con éxito.")
    return redirect('inventario')

@login_required
def eliminar_categoria(request, pk):
    categoria = get_object_or_404(ProductCategory, pk=pk)
    categoria.is_active = False
    categoria.save()
    messages.success(request, f"Categoría {categoria.nombre_categoria} desactivada con éxito.")
    return redirect('inventario')

@login_required
def eliminar_tamaño(request, pk):
    categoria = get_object_or_404(ProductSize, pk=pk)
    categoria.is_active = False
    categoria.save()
    messages.success(request, f"Categoría {categoria.nombre_categoria} desactivada con éxito.")
    return redirect('inventario')


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
    productos = Product.objects.filter(is_active=True)  # Solo productos activos

    if request.method == 'POST':
        sale_form = SaleForm(request.POST)
        productos_ids = request.POST.getlist('products[]')
        cantidades = request.POST.getlist('cantidades[]')

        # Filtrar productos_ids y cantidades para eliminar valores vacíos
        productos_ids = [product_id for product_id in productos_ids if product_id.strip()]
        cantidades = [cantidad for cantidad in cantidades if cantidad.strip()]

        # Verificar si hay productos y cantidades válidos
        if not productos_ids or not cantidades:
            messages.error(request, "Debes seleccionar al menos un producto y su cantidad.")
            return render(request, 'pedidos/generar_pedido.html', {
                'sale_form': sale_form,
                'productos': productos,
            })

        # Validar que los productos seleccionados están activos
        for product_id in productos_ids:
            producto = Product.objects.filter(id=product_id, is_active=True).first()
            if not producto:
                messages.error(request, f"El producto con ID {product_id} no está activo o no existe.")
                return render(request, 'pedidos/generar_pedido.html', {
                    'sale_form': sale_form,
                    'productos': productos,
                })

        # Si el formulario y los productos son válidos, procesar el pedido
        if sale_form.is_valid():
            sale = sale_form.save()

            # Crear detalles de venta
            for product_id, cantidad in zip(productos_ids, cantidades):
                if product_id and cantidad:
                    producto = get_object_or_404(Product, id=product_id, is_active=True)
                    SaleDetail.objects.create(
                        id_venta=sale,
                        id_product=producto,
                        cantidad=int(cantidad),
                        precio_unitario=producto.price,
                    )

            messages.success(request, "Pedido generado exitosamente.")
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

@login_required
def activar_producto(request, pk):
    producto = get_object_or_404(Product, pk=pk, is_active=False)
    producto.is_active = True
    producto.save()
    messages.success(request, f"Producto {producto.name} activado con éxito.")
    return redirect('inventario')

@login_required
def generar_pedido(request):
    if request.method == 'POST':
        sale_form = SaleForm(request.POST)
        
        # Procesamos el formulario de la venta
        if sale_form.is_valid():
            # Obtenemos los productos seleccionados y las cantidades
            productos_seleccionados = request.POST.getlist('products[]')
            cantidades = request.POST.getlist('cantidades[]')

            # Lista de productos con stock insuficiente
            productos_sin_stock = []

            # Verificamos si hay suficiente stock para cada producto
            for product_id, cantidad in zip(productos_seleccionados, cantidades):
                producto = Product.objects.get(id=product_id)
                cantidad = int(cantidad)

                if producto.stock < cantidad:
                    # Si no hay suficiente stock, agregamos el producto a la lista
                    productos_sin_stock.append(producto.nombre)

            # Si hay productos sin stock, mostramos el mensaje de error y redirigimos
            if productos_sin_stock:
                messages.error(request, f"No hay suficiente stock para los siguientes productos: {', '.join(productos_sin_stock)}")
                return redirect('generar_pedido')

            # Si todo está bien, guardamos la venta
            sale = sale_form.save()

            # Reducimos el stock y creamos los detalles de la venta
            for product_id, cantidad in zip(productos_seleccionados, cantidades):
                producto = Product.objects.get(id=product_id)
                cantidad = int(cantidad)

                # Reducimos el stock
                producto.stock -= cantidad
                producto.save()

                # Creamos el detalle de la venta
                SaleDetail.objects.create(
                    id_venta=sale,  # Relacionamos la venta con el producto
                    id_product=producto,  # Relacionamos el producto
                    cantidad=cantidad,
                    precio_unitario=producto.price,  # Precio del producto
                    total=producto.price * cantidad  # Total por el producto
                )

            # Si todo ha ido bien, mostramos un mensaje de éxito
            messages.success(request, "Pedido generado exitosamente.")
            return redirect('pedidos')  # Redirigir al listado de pedidos

    else:
        sale_form = SaleForm()

    # Cargar productos para mostrarlos en el formulario
    productos = Product.objects.filter(is_active=True)  # Mostrar solo productos activos

    return render(request, 'pedidos/generar_pedido.html', {'sale_form': sale_form, 'productos': productos})

@login_required
def get_product_precios(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
        return JsonResponse({'success': True, 'precio': str(product.price)})
    except Product.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Product not found'})
    
@login_required
def cambiar_estado_pedido(request, id):
    pedido = get_object_or_404(Sale, id=id)
    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado_pedido')
        if nuevo_estado in dict(Sale.ESTADO_CHOICES).keys():
            pedido.estado_pedido = nuevo_estado
            pedido.save()
            messages.success(request, f'El estado del pedido ha sido actualizado a "{nuevo_estado}".')
        else:
            messages.error(request, 'El estado seleccionado no es válido.')
        return redirect('detalle_pedido', id=id)
    else:
        messages.error(request, 'Solicitud inválida.')
        return redirect('detalle_pedido', id=id)