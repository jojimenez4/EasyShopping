from django.contrib import admin
from .models import ProductSize, Contact, ProductCategory, Product, Sale, SaleDetail

# Registra cada uno de los modelos para que aparezcan en el admin de Django
admin.site.register(ProductSize)
admin.site.register(Contact)
admin.site.register(ProductCategory)
admin.site.register(Product)
admin.site.register(Sale)
admin.site.register(SaleDetail)
