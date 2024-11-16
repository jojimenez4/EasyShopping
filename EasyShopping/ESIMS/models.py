from django.db import models

class TipoMedida(models.Model):
    id_type = models.AutoField(primary_key=True, unique=True, null = False, blank = False)
    name = models.CharField(max_length=5, unique=True, null = False, blank = False)

    def __str__(self):
        return self.name
    
class Product(models.Model):
    id_product = models.AutoField(primary_key=True, unique=True, null = False, blank = False)
    name = models.CharField(max_length=25, null = False, blank = False)
    medida = models.ForeignKey(TipoMedida, on_delete=models.CASCADE, null = False, blank = False)
    price = models.IntegerField(null = False, blank = False)
    stock = models.IntegerField(null = False, blank = False)

    def __str__(self):
        return self.name
    
class Ventas(models.Model):
    id_venta = models.AutoField(primary_key=True, unique=True,null = False, blank = False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null = False, blank = False)
    quantity = models.IntegerField(null = False, blank = False)
    total = models.DecimalField(max_digits=7, decimal_places=2, null = False, blank = False)
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.product.name

# class ChatBot(models.Model):
#     name = models.CharField(max_length=100, null = False, blank = False)
#     message = models.CharField(max_length=100, null = False, blank = False)
#     response = models.CharField(max_length=100, null = False, blank = False)

#     def __str__(self):
#         return self.name

