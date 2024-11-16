from django.urls import path
from .views import inventario, añadir_producto, eliminar_producto, editar_producto

urlpatterns = [
    path('', inventario, name='inventario'),
    path('añadir_producto/', añadir_producto, name='añadir_producto'),
    path('eliminar_producto/<int:pk>/', eliminar_producto, name='eliminar_producto'),
    path('editar_producto/<int:pk>/', editar_producto, name='editar_producto'),
]