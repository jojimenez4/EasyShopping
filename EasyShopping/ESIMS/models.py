from django.db import models
from django.core.validators import MinValueValidator

class ProductSize(models.Model):
    name = models.CharField(max_length=5, unique=True)
    is_active = models.BooleanField(default=True) 

    def __str__(self):
        return self.name

class Contact(models.Model):
    numero_chatbot = models.CharField(max_length=20, unique=True)
    nombre_comprador = models.CharField(max_length=100)

    def __str__(self):
        return self.nombre_comprador

class ProductCategory(models.Model):
    nombre_categoria = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True) 

    def __str__(self):
        return self.nombre_categoria

class Product(models.Model):
    name = models.CharField(max_length=25)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    stock = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    medida_id = models.ForeignKey(ProductSize, on_delete=models.CASCADE)
    id_categoria = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, null=False, blank=False)  # Obligatorio
    is_active = models.BooleanField(default=True) 

    def __str__(self):
        return self.name


class Sale(models.Model):
    ESTADO_CHOICES = [
        ('Confirmado', 'Confirmado'),
        ('En preparación', 'En preparación'),
        ('Preparado', 'Preparado'),
        ('Cancelado', 'Cancelado'),
    ]

    id_contacto = models.ForeignKey(
        Contact, 
        on_delete=models.CASCADE, 
        null=True,  # Permite valores nulos en la base de datos
        blank=True  # Permite que sea opcional en los formularios
    )
    fecha_venta = models.DateTimeField(auto_now_add=True)
    estado_pedido = models.CharField(
        max_length=20, 
        choices=ESTADO_CHOICES, 
        default='Confirmado'
    )

    def __str__(self):
        return f"Venta {self.id} - {self.id_contacto or 'Sin contacto'}"

class SaleDetail(models.Model):
    id_venta = models.ForeignKey(Sale, on_delete=models.CASCADE)
    id_product = models.ForeignKey(Product, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    total = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    def save(self, *args, **kwargs):
        self.total = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Detalle Venta {self.id_detalle} - Venta {self.id_venta.id_venta}"

