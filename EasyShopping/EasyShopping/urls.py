# Version: 1.0
from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('inventario/', include('ESIMS.urls')),
    path('', auth_views.LoginView.as_view(template_name='auth/login.html'), name='login', ),
    path('logout/', auth_views.LogoutView.as_view(template_name='auth/logout.html'), name='logout', ),
]
