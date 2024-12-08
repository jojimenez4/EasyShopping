from django.urls import path
from .views import inventario, añadir_producto, eliminar_producto, editar_producto, pedidos_view,crear_categoria, crear_medida,generar_pedido,detalle_pedido_view, activar_producto, get_product_precios
 # Esto está bien porque importa todas las vistas, incluida pedidos_view




urlpatterns = [
    path('', inventario, name='inventario'),
    path('añadir_producto/', añadir_producto, name='añadir_producto'),
    path('eliminar_producto/<int:pk>/', eliminar_producto, name='eliminar_producto'),
    path('editar_producto/<int:pk>/', editar_producto, name='editar_producto'),
    path('pedidos/', pedidos_view, name='pedidos'),  # Llama a la vista pedidos_view
    path('crear_categoria/', crear_categoria, name='crear_categoria'),  # Crear categoría
    path('crear_medida/', crear_medida, name='crear_medida'),
    path('generar_pedido/', generar_pedido, name='generar_pedido'),
    path('pedidos/<int:id>/', detalle_pedido_view, name='detalle_pedido'),
    path('activar_producto/<int:pk>/', activar_producto, name='activar_producto'),
    path('get-price/<int:product_id>/', get_product_precios, name='get_product_price'),
]