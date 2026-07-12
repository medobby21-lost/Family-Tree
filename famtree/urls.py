from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('add-first/', views.add_first_member, name='add_first_member'),
    path('add-relative/<int:relative_to_id>/', views.add_relative, name='add_relative'),
    path('edit-member/<int:member_id>/', views.edit_member, name='edit_member'),
    path('api/graph/', views.api_graph_data, name='api_graph_data'),
    path('api/relation/', views.api_relation, name='api_relation'),
    path('api/save_positions/', views.api_save_positions, name='api_save_positions'),
]